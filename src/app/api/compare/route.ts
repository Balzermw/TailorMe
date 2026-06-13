import { NextResponse } from "next/server";
import {
  anthropicConfigured,
  compareEnabled,
  openaiConfigured,
} from "@/lib/config";
import { runFull } from "@/lib/apply/pipeline";
import { getUsage, resetUsage, type Provider } from "@/lib/apply/llm";
import { SAMPLE_RESUME } from "@/lib/apply/sample";
import {
  FREE_AUDIT_RULES,
  rateLimitDisabled,
  validateApplyInput,
} from "@/lib/limits";
import { consume, getClientIp, tooManyRequests } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const maxDuration = 120;

// Eval-only: run the same resume + posting through BOTH providers and return
// each result + real token usage + cost. Makes 6 billed calls (3 per provider),
// so it's off unless COMPARE_ENABLED=1 and both keys are set. Not concurrency-
// safe (uses the module usage accumulator) — a dev tool, not a product surface.
export async function POST(request: Request) {
  if (!compareEnabled) {
    return NextResponse.json(
      { error: "Comparison endpoint is disabled. Set COMPARE_ENABLED=1 to use it." },
      { status: 404 },
    );
  }
  if (!anthropicConfigured || !openaiConfigured) {
    return NextResponse.json(
      { error: "Set both ANTHROPIC_API_KEY and OPENAI_API_KEY to compare providers." },
      { status: 400 },
    );
  }
  if (!rateLimitDisabled) {
    const rl = consume(`compare:${getClientIp(request)}`, FREE_AUDIT_RULES);
    if (!rl.allowed) {
      return tooManyRequests("Too many comparison runs — try again later.", rl.resetAt);
    }
  }

  let body: { resumeText?: string; postingText?: string; useSample?: boolean };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  const resumeText = body.useSample
    ? SAMPLE_RESUME
    : (body.resumeText ?? "").trim();
  const postingText = (body.postingText ?? "").trim();
  if (!resumeText || !postingText) {
    return NextResponse.json(
      { error: "Resume and job posting are both required." },
      { status: 400 },
    );
  }
  const sizeError = validateApplyInput(resumeText, postingText);
  if (sizeError) return NextResponse.json({ error: sizeError }, { status: 413 });

  const run = async (provider: Provider) => {
    resetUsage();
    const result = await runFull(resumeText, postingText, provider);
    const usage = getUsage();
    return {
      provider,
      result,
      tokens: { input: usage.inputTokens, output: usage.outputTokens },
      costUsd: Number(usage.costUsd.toFixed(5)),
      perCall: usage.calls,
    };
  };

  try {
    // Sequential (the usage accumulator is shared) — Anthropic first, then OpenAI.
    const anthropic = await run("anthropic");
    const openai = await run("openai");
    return NextResponse.json({ anthropic, openai });
  } catch (err) {
    const message = err instanceof Error ? err.message : "comparison failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
