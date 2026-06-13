// TailorMe LaTeX compile service.
//
// Contract (matches src/lib/apply/latex.ts -> compileToPdf):
//   POST /  with JSON { tex: string, engine?: "xelatex"|"lualatex"|"pdflatex" }
//   -> 200 application/pdf (the compiled bytes)
//   -> 4xx/5xx application/json { error, log } (caller falls back to the print view)
//
// Set LATEX_COMPILE_URL in the Next app to this service's URL. If COMPILE_TOKEN
// is set here, the app must send "Authorization: Bearer <token>" (it reads
// LATEX_COMPILE_TOKEN) — keep this service private to your infrastructure.
//
// Hardening: no shell-escape (blocks \write18 RCE), per-request temp dir,
// hard timeout, body-size cap, engine allowlist, runs as a non-root user.

const http = require("node:http");
const { execFile } = require("node:child_process");
const { mkdtemp, writeFile, readFile, rm } = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");

const PORT = Number(process.env.PORT || 8080);
const TOKEN = process.env.COMPILE_TOKEN || "";
const MAX_TEX_BYTES = 512 * 1024; // 512 KB of source is plenty for a resume
const TIMEOUT_MS = 25_000;
const ENGINES = new Set(["xelatex", "lualatex", "pdflatex"]);

function readBody(req, limit) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on("data", (c) => {
      size += c.length;
      if (size > limit) {
        reject(new Error("payload too large"));
        req.destroy();
        return;
      }
      chunks.push(c);
    });
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

function run(engine, dir) {
  return new Promise((resolve) => {
    execFile(
      engine,
      [
        "-no-shell-escape",
        "-interaction=nonstopmode",
        "-halt-on-error",
        "main.tex",
      ],
      {
        cwd: dir,
        timeout: TIMEOUT_MS,
        killSignal: "SIGKILL",
        maxBuffer: 8 * 1024 * 1024,
        env: { ...process.env, openout_any: "p", shell_escape: "f" },
      },
      (err, stdout) => resolve({ err, log: String(stdout || "") }),
    );
  });
}

const server = http.createServer(async (req, res) => {
  const json = (code, obj) => {
    res.writeHead(code, { "Content-Type": "application/json" });
    res.end(JSON.stringify(obj));
  };

  if (req.method === "GET" && req.url === "/healthz") return json(200, { ok: true });
  if (req.method !== "POST") return json(405, { error: "POST only" });

  if (TOKEN) {
    const auth = req.headers["authorization"] || "";
    if (auth !== `Bearer ${TOKEN}`) return json(401, { error: "unauthorized" });
  }

  let body;
  try {
    body = await readBody(req, MAX_TEX_BYTES);
  } catch {
    return json(413, { error: "payload too large" });
  }

  let tex, engine;
  try {
    const parsed = JSON.parse(body.toString("utf8"));
    tex = parsed.tex;
    engine = ENGINES.has(parsed.engine) ? parsed.engine : "xelatex";
  } catch {
    return json(400, { error: "invalid JSON" });
  }
  if (typeof tex !== "string" || !tex.trim()) {
    return json(400, { error: "missing tex" });
  }

  let dir;
  try {
    dir = await mkdtemp(path.join(os.tmpdir(), "tex-"));
    await writeFile(path.join(dir, "main.tex"), tex, "utf8");

    // Two passes so moderncv resolves layout/links.
    let last = await run(engine, dir);
    if (!last.err) last = await run(engine, dir);

    let pdf;
    try {
      pdf = await readFile(path.join(dir, "main.pdf"));
    } catch {
      return json(422, {
        error: "compile failed",
        log: last.log.slice(-4000),
      });
    }

    res.writeHead(200, {
      "Content-Type": "application/pdf",
      "Content-Length": pdf.length,
    });
    res.end(pdf);
  } catch (e) {
    return json(500, { error: String((e && e.message) || e) });
  } finally {
    if (dir) rm(dir, { recursive: true, force: true }).catch(() => {});
  }
});

server.listen(PORT, () => {
  console.log(`latex compile service on :${PORT}`);
});
