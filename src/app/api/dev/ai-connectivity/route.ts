import dns from "node:dns/promises";
import net from "node:net";
import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";
import {
  ANTHROPIC_API_KEY,
  ANTHROPIC_MODEL,
  LLM_PROVIDER,
  OPENAI_API_KEY,
  OPENAI_MODEL_FAST,
} from "@/lib/config";

export const runtime = "nodejs";
export const maxDuration = 30;

type Provider = "openai" | "anthropic";

export async function GET(request: Request) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  const url = new URL(request.url);
  const smoke = url.searchParams.get("smoke") === "1";
  const provider: Provider = LLM_PROVIDER === "openai" ? "openai" : "anthropic";
  const host = provider === "openai" ? "api.openai.com" : "api.anthropic.com";
  const hasKey = provider === "openai" ? Boolean(OPENAI_API_KEY) : Boolean(ANTHROPIC_API_KEY);

  const tcp = await tcpConnect(host, 443, 8_000);
  const dnsResults = await lookupHost(host);
  const tcp4 = await tcpConnect(host, 443, 8_000, 4);
  const tcp6 = await tcpConnect(host, 443, 8_000, 6);
  const base = {
    nodeEnv: process.env.NODE_ENV,
    nodeVersion: process.version,
    provider,
    host,
    hasKey,
    dnsDefaultOrder: dns.getDefaultResultOrder(),
    dnsResults,
    tcp443: tcp.ok,
    tcpError: tcp.error ?? null,
    tcp443Ipv4: tcp4.ok,
    tcp443Ipv4Error: tcp4.error ?? null,
    tcp443Ipv6: tcp6.ok,
    tcp443Ipv6Error: tcp6.error ?? null,
    httpsProxy: Boolean(process.env.HTTPS_PROXY),
    httpProxy: Boolean(process.env.HTTP_PROXY),
    allProxy: Boolean(process.env.ALL_PROXY),
    noProxy: process.env.NO_PROXY || null,
    smoke,
  };

  if (!smoke) {
    return NextResponse.json(base);
  }

  if (!hasKey) {
    return NextResponse.json({
      ...base,
      sdkOk: false,
      sdkError: `${provider === "openai" ? "OPENAI_API_KEY" : "ANTHROPIC_API_KEY"} is missing.`,
    });
  }

  try {
    if (provider === "openai") {
      const client = new OpenAI({ apiKey: OPENAI_API_KEY });
      const response = await client.chat.completions.create({
        model: OPENAI_MODEL_FAST || "gpt-4.1-mini",
        max_completion_tokens: 8,
        messages: [{ role: "user", content: "Reply with OK only." }],
      });
      return NextResponse.json({
        ...base,
        sdkOk: true,
        model: response.model,
        text: response.choices[0]?.message?.content?.trim() || "",
      });
    }

    const client = new Anthropic({ apiKey: ANTHROPIC_API_KEY });
    const response = await client.messages.create({
      model: ANTHROPIC_MODEL || "claude-sonnet-4-6",
      max_tokens: 8,
      messages: [{ role: "user", content: "Reply with OK only." }],
    });
    const text = response.content
      .map((block) => (block.type === "text" ? block.text : ""))
      .join("")
      .trim();
    return NextResponse.json({
      ...base,
      sdkOk: true,
      model: response.model,
      text,
    });
  } catch (error) {
    return NextResponse.json({
      ...base,
      sdkOk: false,
      sdkError: error instanceof Error ? error.message : String(error),
      sdkName: error instanceof Error ? error.name : "Error",
    });
  }
}

function tcpConnect(
  hostName: string,
  port: number,
  timeoutMs: number,
  family?: 4 | 6,
): Promise<{ ok: boolean; error?: string }> {
  return new Promise((resolve) => {
    const socket = net.createConnection({ host: hostName, port, family });
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

async function lookupHost(hostName: string): Promise<string[]> {
  try {
    const rows = await dns.lookup(hostName, { all: true });
    return rows.map((row) => `${row.address} (IPv${row.family})`);
  } catch (error) {
    return [error instanceof Error ? error.message : String(error)];
  }
}
