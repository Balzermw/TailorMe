import fs from "node:fs";
import net from "node:net";
import path from "node:path";

type Provider = "openai" | "anthropic";

loadEnvLocal();

const provider: Provider =
  (process.env.LLM_PROVIDER || "anthropic").toLowerCase() === "openai"
    ? "openai"
    : "anthropic";
const host = provider === "openai" ? "api.openai.com" : "api.anthropic.com";
const keyName = provider === "openai" ? "OPENAI_API_KEY" : "ANTHROPIC_API_KEY";

void main();

async function main() {
  const hasKey = Boolean(process.env[keyName]);
  const tcp = await tcpConnect(host, 443, 8_000);
  console.log(
    JSON.stringify(
      {
        provider,
        host,
        hasKey,
        tcp443: tcp.ok,
        error: tcp.error,
        sdkSmoke: process.env.QA_AI_SMOKE_SDK === "1",
      },
      null,
      2,
    ),
  );

  if (!hasKey) {
    console.error(`${keyName} is not configured.`);
    process.exitCode = 1;
    return;
  }
  if (!tcp.ok) {
    console.error(
      `Cannot open TCP connection to ${host}:443. Fix outbound HTTPS/proxy/firewall before running live AI E2E.`,
    );
    process.exitCode = 1;
    return;
  }

  if (process.env.QA_AI_SMOKE_SDK === "1") {
    await sdkSmoke(provider);
  }
}

function loadEnvLocal() {
  const envPath = path.join(process.cwd(), ".env.local");
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (!match) continue;
    const [, key, raw] = match;
    if (process.env[key]) continue;
    process.env[key] = raw.trim().replace(/^['"]|['"]$/g, "");
  }
}

function tcpConnect(
  hostName: string,
  port: number,
  timeoutMs: number,
): Promise<{ ok: boolean; error?: string }> {
  return new Promise((resolve) => {
    const socket = net.createConnection({ host: hostName, port });
    const done = (ok: boolean, error?: string) => {
      socket.removeAllListeners();
      socket.destroy();
      resolve({ ok, error });
    };
    socket.setTimeout(timeoutMs, () => done(false, "timeout"));
    socket.once("connect", () => done(true));
    socket.once("error", (error) => done(false, error.message));
  });
}

async function sdkSmoke(currentProvider: Provider) {
  try {
    if (currentProvider === "openai") {
      const OpenAI = (await import("openai")).default;
      const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
      const response = await client.chat.completions.create({
        model: process.env.OPENAI_MODEL_FAST || "gpt-4.1-mini",
        max_completion_tokens: 8,
        messages: [{ role: "user", content: "Reply with OK only." }],
      });
      console.log(
        JSON.stringify(
          {
            sdkOk: true,
            model: response.model,
            text: response.choices[0]?.message?.content?.trim() || "",
          },
          null,
          2,
        ),
      );
      return;
    }

    const Anthropic = (await import("@anthropic-ai/sdk")).default;
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const response = await client.messages.create({
      model: process.env.ANTHROPIC_MODEL || "claude-sonnet-4-6",
      max_tokens: 8,
      messages: [{ role: "user", content: "Reply with OK only." }],
    });
    const text = response.content
      .map((block) => (block.type === "text" ? block.text : ""))
      .join("")
      .trim();
    console.log(JSON.stringify({ sdkOk: true, model: response.model, text }, null, 2));
  } catch (error) {
    console.error(
      JSON.stringify(
        {
          sdkOk: false,
          message: error instanceof Error ? error.message : String(error),
        },
        null,
        2,
      ),
    );
    process.exitCode = 1;
  }
}
