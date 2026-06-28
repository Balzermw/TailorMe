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

const SYSTEM =
  "You are an expert resume editor. You are given one résumé excerpt, the issue with it, " +
  "and the recommended fix. Rewrite ONLY that excerpt into a polished, ready-to-paste version. " +
  "Rules: stay strictly truthful — never invent metrics, numbers, employers, titles, dates, or " +
  "skills the person has not stated; if a real number is genuinely required and unknown, leave a " +
  "short bracketed placeholder like [add %]. Be concise and ATS-friendly. Match the section: a " +
  "summary becomes 1-2 tight sentences; an experience bullet becomes one strong result-first line; " +
  "a skills fix becomes a clean comma-separated list. Return only the rewritten text, no preamble, " +
  "no quotes around it.";

const REWRITE_SCHEMA = {
  type: "object",
  properties: {
    rewrite: { type: "string", description: "The rewritten, ready-to-paste text for this section." },
  },
  required: ["rewrite"],
} as const;

export async function POST(request: Request) {
  let body: { section?: string; issue?: string; advice?: string; original?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  const section = (body.section ?? "").slice(0, 40);
  const issue = (body.issue ?? "").slice(0, 600);
  const advice = (body.advice ?? "").slice(0, 600);
  const original = (body.original ?? "").slice(0, 4000);
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

  const user =
    `Section: ${section || "(unspecified)"}\n` +
    `Issue: ${issue || "(none)"}\n` +
    `Recommended fix: ${advice || "(none)"}\n` +
    `Current text:\n${original || "(empty)"}\n\nRewrite:`;

  try {
    const out = await withAiRun("tailor", { userId, sessionId }, () =>
      structured<{ rewrite: string }>({
        step: "tailor",
        system: SYSTEM,
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
