import { NextResponse } from "next/server";
import { llmConfigured } from "@/lib/config";
import { parseResume } from "@/lib/apply/pipeline";
import { docToResumeText } from "@/lib/apply/serialize";
import { sanitizeDoc } from "@/lib/apply/sanitize-doc";
import { feedbackHash } from "@/lib/apply/hash";
import { withAiRun, logCachedRun } from "@/lib/apply/ai-telemetry";
import { getServerSupabase } from "@/lib/supabase/server";
import { EDIT_REVIEW_RULES, rateLimitDisabled } from "@/lib/limits";
import { consume, getClientIp, tooManyRequests } from "@/lib/rate-limit";
import { FEEDBACK_CACHE_VERSION, refineFeedback } from "@/lib/resume-rules/deterministicFeedback";
import type { ProofPoint } from "@/lib/types";

// First-pass feedback on a structured (built/edited) base resume. The LLM parse
// (template-aware) plus the deterministic rules engine run over the same doc,
// deduped + capped so the editor's Suggestions section shows a focused set (no
// duplicate "add metrics" from both the rule and the LLM). The dedup/cap engine
// lives in `deterministicFeedback` so import-time feedback matches what the
// editor shows. Pass `mode: "deterministic"` to skip the LLM (used at import).

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: Request) {
  let body: { doc?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  const doc = sanitizeDoc(body.doc);
  if (!doc) {
    return NextResponse.json(
      { error: "Add a name and at least one section first." },
      { status: 400 },
    );
  }

  const t0 = Date.now();
  const sessionId = request.headers.get("x-tm-session");
  const hash = feedbackHash(doc);
  const sb = await getServerSupabase();
  const user = sb ? (await sb.auth.getUser()).data.user : null;

  // Read the saved stats once — it's both the cache lookup and the merge base.
  let stats: Record<string, unknown> = {};
  if (sb && user) {
    const { data: row } = await sb
      .from("resumes")
      .select("stats")
      .eq("user_id", user.id)
      .maybeSingle();
    stats = (row?.stats as Record<string, unknown>) ?? {};
    // Same résumé as last time → return the cached review, no tokens spent.
    if (
      stats.feedbackHash === hash &&
      stats.feedbackCacheVersion === FEEDBACK_CACHE_VERSION &&
      Array.isArray(stats.proofPoints)
    ) {
      logCachedRun("feedback", { userId: user.id, sessionId }, Date.now() - t0);
      return NextResponse.json({ proofPoints: stats.proofPoints, cached: true });
    }
  }

  const saveFeedbackCache = async (proofPoints: ProofPoint[]) => {
    if (!sb || !user) return;
    const merged = {
      ...stats,
      proofPoints,
      feedbackHash: hash,
      feedbackCacheVersion: FEEDBACK_CACHE_VERSION,
    };
    await sb.from("resumes").update({ stats: merged }).eq("user_id", user.id);
  };

  // No LLM configured → the deterministic rules engine alone (same engine the
  // import path uses, so the suggestions match).
  if (!llmConfigured) {
    const { proofPoints, stats: funnel } = refineFeedback(doc, []);
    await saveFeedbackCache(proofPoints);
    return NextResponse.json({
      demo: true,
      fallback: true,
      proofPoints,
      cached: false,
      stats: funnel,
      warning: "AI feedback is not configured locally, so this review used the resume rules engine.",
    });
  }

  // Only the token-spending path is rate-limited; cache hits above are free.
  if (!rateLimitDisabled) {
    const who = user?.id ?? getClientIp(request);
    const res = consume(`resume-feedback:${who}`, EDIT_REVIEW_RULES);
    if (!res.allowed) {
      return tooManyRequests(
        "You're reviewing very fast. Give it a minute.",
        res.resetAt,
      );
    }
  }

  try {
    const parsed = await withAiRun(
      "feedback",
      { userId: user?.id ?? null, sessionId },
      () => parseResume(docToResumeText(doc), undefined, true),
    );
    // Fold the LLM findings + deterministic rules → deduped, capped suggestions.
    const { proofPoints, stats: funnel } = refineFeedback(doc, parsed.proofPoints ?? []);
    // Persist with the hash so the next identical request is a free cache hit.
    await saveFeedbackCache(proofPoints);
    return NextResponse.json({ proofPoints, cached: false, stats: funnel });
  } catch {
    const { proofPoints, stats: funnel } = refineFeedback(doc, []);
    await saveFeedbackCache(proofPoints);
    return NextResponse.json({
      fallback: true,
      proofPoints,
      cached: false,
      stats: funnel,
      warning: "AI feedback had trouble, so this review used the resume rules engine.",
    });
  }
}
