import { NextResponse } from "next/server";
import {
  anthropicConfigured,
  compareEnabled,
  openaiConfigured,
} from "@/lib/config";
import { tailorOnce } from "@/lib/apply/pipeline";
import { judge, type Candidate, type JudgeScore } from "@/lib/apply/judge";
import { getUsage, resetUsage, type Provider } from "@/lib/apply/llm";
import { SAMPLE_RESUME } from "@/lib/apply/sample";
import type { TailoredBullet, TailoredDoc } from "@/lib/types";
import {
  FREE_AUDIT_RULES,
  rateLimitDisabled,
  validateApplyInput,
} from "@/lib/limits";
import { consume, getClientIp, tooManyRequests } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const maxDuration = 300;

interface ModelSpec {
  provider: Provider;
  model: string;
  label: string;
}

// Cheapest → smartest. Models the caller's key may not have are skipped (logged).
const DEFAULT_TIERS: ModelSpec[] = [
  { provider: "openai", model: "gpt-4.1-nano", label: "OpenAI · 4.1-nano (light)" },
  { provider: "openai", model: "gpt-4.1-mini", label: "OpenAI · 4.1-mini (light)" },
  { provider: "anthropic", model: "claude-haiku-4-5", label: "Claude · Haiku 4.5 (light)" },
  { provider: "openai", model: "gpt-4.1", label: "OpenAI · 4.1 (mid)" },
  { provider: "anthropic", model: "claude-sonnet-4-6", label: "Claude · Sonnet 4.6 (mid)" },
  { provider: "anthropic", model: "claude-opus-4-8", label: "Claude · Opus 4.8 (high)" },
  { provider: "openai", model: "gpt-5.4", label: "OpenAI · GPT-5.4 (high)" },
];

// The smartest models judge the rest (cross-provider to limit self-bias).
const DEFAULT_JUDGES: ModelSpec[] = [
  { provider: "anthropic", model: "claude-opus-4-8", label: "Judge · Claude Opus 4.8" },
  { provider: "openai", model: "gpt-5.4", label: "Judge · GPT-5.4" },
];

interface GenResult extends ModelSpec {
  ok?: boolean;
  error?: string;
  doc?: TailoredDoc;
  bullets?: TailoredBullet[];
  tokens?: { input: number; output: number };
  costUsd?: number;
}

interface JudgeResult extends ModelSpec {
  ok?: boolean;
  error?: string;
  rankings?: JudgeScore[];
  winner?: string;
  reasoning?: string;
  costUsd?: number;
}

const configured = (p: Provider) =>
  p === "openai" ? openaiConfigured : anthropicConfigured;
const errMsg = (e: unknown) =>
  (e instanceof Error ? e.message : String(e)).slice(0, 240);

export async function POST(request: Request) {
  if (!compareEnabled) {
    return NextResponse.json(
      { error: "Eval endpoint is disabled. Set COMPARE_ENABLED=1 to use it." },
      { status: 404 },
    );
  }
  if (!rateLimitDisabled) {
    const rl = consume(`eval:${getClientIp(request)}`, FREE_AUDIT_RULES);
    if (!rl.allowed) {
      return tooManyRequests("Too many eval runs — try again later.", rl.resetAt);
    }
  }

  let body: {
    resumeText?: string;
    postingText?: string;
    useSample?: boolean;
    tiers?: ModelSpec[];
    judges?: ModelSpec[];
  };
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

  const tiers = body.tiers ?? DEFAULT_TIERS;
  const judges = body.judges ?? DEFAULT_JUDGES;

  // ----- 1. generator ladder: run the tailor step on each model -----
  const generations: GenResult[] = [];
  for (const t of tiers) {
    if (!configured(t.provider)) {
      generations.push({ ...t, error: `${t.provider} key not configured` });
      continue;
    }
    resetUsage();
    try {
      const r = await tailorOnce(resumeText, postingText, t.provider, t.model);
      const u = getUsage();
      generations.push({
        ...t,
        ok: true,
        doc: r.doc,
        bullets: r.bullets,
        tokens: { input: u.inputTokens, output: u.outputTokens },
        costUsd: Number(u.costUsd.toFixed(5)),
      });
    } catch (e) {
      generations.push({ ...t, error: errMsg(e) });
    }
  }

  // Anonymize successful outputs for blind judging.
  const candidates: Candidate[] = generations
    .filter((g) => g.ok && g.doc)
    .map((g, i) => ({
      letter: String.fromCharCode(65 + i),
      doc: g.doc as TailoredDoc,
    }));
  const reveal: Record<string, string> = {};
  candidates.forEach((c, i) => {
    reveal[c.letter] = generations.filter((g) => g.ok && g.doc)[i].label;
  });

  // ----- 2. judging: top models rank the candidates -----
  const judgments: JudgeResult[] = [];
  if (candidates.length >= 2) {
    for (const j of judges) {
      if (!configured(j.provider)) {
        judgments.push({ ...j, error: `${j.provider} key not configured` });
        continue;
      }
      resetUsage();
      try {
        const res = await judge(
          resumeText,
          postingText,
          candidates,
          j.provider,
          j.model,
        );
        const u = getUsage();
        judgments.push({
          ...j,
          ok: true,
          rankings: res.rankings,
          winner: res.winner,
          reasoning: res.reasoning,
          costUsd: Number(u.costUsd.toFixed(5)),
        });
      } catch (e) {
        judgments.push({ ...j, error: errMsg(e) });
      }
    }
  }

  const totalCost =
    generations.reduce((s, g) => s + (g.costUsd ?? 0), 0) +
    judgments.reduce((s, j) => s + (j.costUsd ?? 0), 0);

  return NextResponse.json({
    reveal,
    generations,
    judgments,
    totalCostUsd: Number(totalCost.toFixed(5)),
  });
}
