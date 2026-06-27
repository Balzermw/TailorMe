/* eslint-disable @typescript-eslint/no-require-imports */

const path = require("path");
const { spawn, spawnSync } = require("child_process");

const cwd = process.cwd();
const baseURL =
  process.env.E2E_BASE_URL ||
  process.env.NEXT_PUBLIC_APP_URL ||
  "http://127.0.0.1:3100";
const port = new URL(baseURL).port || "3100";
const serverScript = path.join(cwd, "scripts", "qa", "e2e-web-server.cjs");
const playwrightCli = path.join(cwd, "node_modules", "@playwright", "test", "cli.js");
const playwrightArgs = ["test", ...process.argv.slice(2)];

function log(message) {
  console.error(`[e2e-runner] ${message}`);
}

function killProcessTree(child, force = false) {
  if (!child?.pid) return;
  if (process.platform === "win32") {
    const result = spawnSync(
      "taskkill.exe",
      ["/PID", String(child.pid), "/T"].concat(force ? ["/F"] : []),
      { stdio: "ignore" },
    );
    if (result.status === 0) return;
  }
  try {
    child.kill(force ? "SIGKILL" : "SIGTERM");
  } catch {
    // Process already exited.
  }
}

async function waitForServer(url, isServerExited, timeoutMs = 180_000) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    if (isServerExited()) {
      throw new Error("E2E web server exited before becoming ready.");
    }
    try {
      const res = await fetch(url);
      if (res.status < 500) return;
    } catch {
      // Still starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`Timed out waiting for ${url}`);
}

async function main() {
  let stopping = false;
  let serverExitCode = null;
  const server = spawn(process.execPath, [serverScript, port], {
    cwd,
    env: process.env,
    stdio: "inherit",
    windowsHide: true,
  });

  server.on("exit", (code) => {
    serverExitCode = code ?? 0;
  });

  const stopServer = () => {
    if (stopping) return;
    stopping = true;
    killProcessTree(server, false);
    setTimeout(() => killProcessTree(server, true), 2_000).unref();
  };

  process.on("SIGINT", () => {
    stopServer();
    process.exit(130);
  });
  process.on("SIGTERM", () => {
    stopServer();
    process.exit(143);
  });
  process.on("exit", stopServer);

  try {
    log(`waiting for ${baseURL}`);
    await waitForServer(baseURL, () => serverExitCode !== null);
    log(`running playwright ${playwrightArgs.slice(1).join(" ")}`.trim());
    const result = spawnSync(process.execPath, [playwrightCli, ...playwrightArgs], {
      cwd,
      env: {
        ...process.env,
        E2E_SKIP_WEB_SERVER: "1",
        E2E_BASE_URL: baseURL,
        NEXT_PUBLIC_APP_URL: baseURL,
      },
      stdio: "inherit",
      windowsHide: true,
    });
    if (result.error) {
      throw result.error;
    }
    process.exitCode = result.status ?? (result.signal ? 1 : 0);
  } finally {
    stopServer();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
