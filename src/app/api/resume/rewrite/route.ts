import { NextResponse } from "next/server";
import { llmConfigured } from "@/lib/config";
import { structured } from "@/lib/apply/llm";
import { withAiRun } from "@/lib/apply/ai-telemetry";
import { getServerSupabase } from "@/lib/supabase/server";
import { EDIT_REVIEW_RULES, rateLimitDisabled } from "@/lib/limits";
import { consume, getClientIp, tooManyRequests } from "@/lib/rate-limit";

// Turn a feedback suggestion into an actual rewrite the user can paste. Given the
// section, the issue, the recommended fix, and the original text, the model
// returns a polished, ready-to-apply version — NOT advice. Truthfulness is
// enforced in the prompt: never invent metrics/employers/skills; a genuinely
// needed-but-unknown number becomes a short [bracketed] placeholder. Demo mode
// (no LLM) returns { demo: true } so the client falls back to its template draft.

export const runtime = "nodejs";
export const maxDuration = 30;

const SYSTEM_BASE =
  "You are an expert resume editor. You are given one résumé excerpt, the issue with it, " +
  "and the recommended fix. Rewrite ONLY that excerpt into a polished, ready-to-paste version. ";
// Batch variant: several experience bullets in one call, so the model can vary how
// it quantifies them (see METRIC_RULE_VARIETY) instead of repeating one figure.
const SYSTEM_BASE_BATCH =
  "You are an expert resume editor. You are given several experience bullets from ONE résumé, the " +
  "issue they share, and the recommended fix. Rewrite EACH bullet into a polished, ready-to-paste line. ";
// Default: never invent a figure; leave a placeholder for the user to fill.
const METRIC_RULE_STRICT =
  "Rules: stay strictly truthful — never invent metrics, numbers, employers, titles, dates, or " +
  "skills the person has not stated; if a real number is genuinely required and unknown, leave a " +
  "short bracketed placeholder like [add %]. ";
// Opt-in (allowEstimates): strengthen the bullet with scope and specifics and add a
// number only where it fits, preferring concrete scope over a vague percentage, so
// the result reads real instead of templated. The user confirms or tweaks each one.
const METRIC_RULE_ESTIMATE =
  "Rules: never invent employers, titles, dates, or skills the person has not stated. Turn the task " +
  "into a result by leading with the scope and specifics the bullet already implies (who it served, " +
  "what was delivered, the scale). Add a number only where one fits naturally; keep it modest and " +
  "plausible for this role, never inflated, and prefer a concrete count or scope (accounts, markets, " +
  "people, releases, time saved) over a vague percentage. The user reviews and adjusts every figure. ";
// Batch-only cure for a wall of identical "15%" estimates: force variety across the set.
const METRIC_RULE_VARIETY =
  "These bullets are rewritten together, so make them read as hand-written, not templated: vary the " +
  "KIND of metric from one bullet to the next (scope or scale, counts, team size, time or duration, " +
  "frequency, volume, money) and use a different number in each. Use a percentage in at most one of " +
  "them. If a bullet is already strong without a number, do not force one in. Never repeat the same figure. ";
const SYSTEM_TAIL =
  "Be concise and ATS-friendly. Match the section: a summary becomes 1-2 tight sentences; an " +
  "experience bullet becomes one strong result-first line; a skills fix becomes a clean " +
  "comma-separated list. Return only the rewritten text, no preamble, no quotes around it.";
const SYSTEM_TAIL_BATCH =
  "Each rewrite is one strong, ATS-friendly, result-first line. Return exactly one rewrite per input " +
  "bullet, in the same order.";

const REWRITE_SCHEMA = {
  type: "object",
  properties: {
    rewrite: { type: "string", description: "The rewritten, ready-to-paste text for this section." },
  },
  required: ["rewrite"],
} as const;

const REWRITE_BATCH_SCHEMA = {
  type: "object",
  properties: {
    rewrites: {
      type: "array",
      items: { type: "string" },
      description: "One rewritten, ready-to-paste line per input bullet, in the same order.",
    },
  },
  required: ["rewrites"],
} as const;

export async function POST(request: Request) {
  let body: {
    section?: string;
    issue?: string;
    advice?: string;
    original?: string;
    bullets?: string[];
    allowEstimates?: boolean;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  const section = (body.section ?? "").slice(0, 40);
  const issue = (body.issue ?? "").slice(0, 600);
  const advice = (body.advice ?? "").slice(0, 600);
  const original = (body.original ?? "").slice(0, 4000);
  // Batch mode: rewrite many experience bullets in ONE call so the model can vary
  // its metrics across them (independent per-bullet calls all converge on "15%").
  const bullets = Array.isArray(body.bullets)
    ? body.bullets
        .filter((b): b is string => typeof b === "string" && b.trim().length > 0)
        .map((b) => b.slice(0, 600))
        .slice(0, 24)
    : null;
  const isBatch = !!bullets && bullets.length > 0;
  if (!issue && !advice) {
    return NextResponse.json({ error: "Nothing to rewrite." }, { status: 400 });
  }

  if (!llmConfigured) {
    return NextResponse.json({ demo: true });
  }

  const sb = await getServerSupabase();
  const userId = sb ? (await sb.auth.getUser()).data.user?.id ?? null : null;
  const sessionId = request.headers.get("x-tm-session");
  if (!rateLimitDisabled) {
    const res = consume(`resume-rewrite:${userId ?? getClientIp(request)}`, EDIT_REVIEW_RULES);
    if (!res.allowed) {
      return tooManyRequests("You're generating rewrites very fast. Give it a moment.", res.resetAt);
    }
  }

  if (isBatch && bullets) {
    const allow = body.allowEstimates === true;
    const system =
      SYSTEM_BASE_BATCH +
      (allow ? METRIC_RULE_ESTIMATE + METRIC_RULE_VARIETY : METRIC_RULE_STRICT) +
      SYSTEM_TAIL_BATCH;
    const batchUser =
      `Section: experience\n` +
      `Issue: ${issue || "(none)"}\n` +
      `Recommended fix: ${advice || "(none)"}\n\n` +
      `Rewrite these ${bullets.length} bullets, one strong line each, in the same order:\n` +
      bullets.map((b, i) => `${i + 1}. ${b}`).join("\n");
    try {
      const out = await withAiRun("tailor", { userId, sessionId }, () =>
        structured<{ rewrites: string[] }>({
          step: "tailor",
          system,
          user: batchUser,
          name: "resume_rewrite_batch",
          description: "Return one rewritten, ready-to-paste line per input bullet, in order.",
          schema: REWRITE_BATCH_SCHEMA,
          maxTokens: Math.min(2000, 250 + bullets.length * 90),
        }),
      );
      const rewrites = Array.isArray(out?.rewrites)
        ? out.rewrites.map((r) => (typeof r === "string" ? r.trim() : ""))
        : [];
      // The client maps by index and keeps its deterministic fallback for any gap.
      return NextResponse.json({ rewrites });
    } catch (err) {
      console.error("[resume/rewrite] batch failed:", err instanceof Error ? err.message : err);
      return NextResponse.json(
        { error: "The rewrite service couldn't be reached. Try again." },
        { status: 502 },
      );
    }
  }

  const user =
    `Section: ${section || "(unspecified)"}\n` +
    `Issue: ${issue || "(none)"}\n` +
    `Recommended fix: ${advice || "(none)"}\n` +
    `Current text:\n${original || "(empty)"}\n\nRewrite:`;

  try {
    const system =
      SYSTEM_BASE + (body.allowEstimates === true ? METRIC_RULE_ESTIMATE : METRIC_RULE_STRICT) + SYSTEM_TAIL;
    const out = await withAiRun("tailor", { userId, sessionId }, () =>
      structured<{ rewrite: string }>({
        step: "tailor",
        system,
        user,
        name: "resume_rewrite",
        description: "Return the rewritten, ready-to-paste text for the section.",
        schema: REWRITE_SCHEMA,
        maxTokens: 700,
      }),
    );
    const rewrite = (out?.rewrite ?? "").trim();
    if (!rewrite) {
      return NextResponse.json({ error: "Couldn't draft a rewrite. Try again." }, { status: 502 });
    }
    return NextResponse.json({ rewrite });
  } catch (err) {
    console.error("[resume/rewrite] failed:", err instanceof Error ? err.message : err);
    return NextResponse.json(
      { error: "The rewrite service couldn't be reached. Try again." },
      { status: 502 },
    );
  }
}
