import { NextResponse } from "next/server";
import { llmConfigured } from "@/lib/config";
import { parseResume } from "@/lib/apply/pipeline";
import { docToResumeText } from "@/lib/apply/serialize";
import { renderResumeTex } from "@/lib/apply/latex";
import { sanitizeDoc } from "@/lib/apply/sanitize-doc";
import { feedbackHash } from "@/lib/apply/hash";
import { withAiRun, logCachedRun } from "@/lib/apply/ai-telemetry";
import { getServerSupabase } from "@/lib/supabase/server";
import { EDIT_REVIEW_RULES, rateLimitDisabled } from "@/lib/limits";
import { consume, getClientIp, tooManyRequests } from "@/lib/rate-limit";
import { evaluateResumeRules } from "@/lib/resume-rules/evaluateResumeRules";
import type { ResumeRuleFinding } from "@/lib/resume-rules/resumeAdviceRule.types";
import type { ProofPoint } from "@/lib/types";

// First-pass feedback on a structured (built/edited) base resume. Runs the LLM
// parse (template-aware) AND the deterministic rules engine over the same doc,
// then dedupes + caps so the editor's Suggestions section shows a focused set
// (no duplicate "add metrics" from both the rule and the LLM). Returns proof
// points for the editor's Suggestions section.

// Map a surfaced rules-engine finding back to the editor's ProofPoint shape.
function findingToProofPoint(f: ResumeRuleFinding): ProofPoint {
  return {
    title: f.title,
    summary: f.message,
    quote: f.evidenceSnippet || undefined,
    why: f.whyItMatters,
    fix: f.suggestedFix,
    severity: f.uiSeverityLabel.toLowerCase() as ProofPoint["severity"],
  };
}

// Fold the LLM proof points + deterministic rule findings into one deduped,
// ranked, capped set. Falls back to the raw proof points if the doc can't be
// rendered to LaTeX (the engine's detectors read LaTeX structure).
function refineFeedback(doc: Parameters<typeof renderResumeTex>[0], proofPoints: ProofPoint[]): ProofPoint[] {
  try {
    const latexSource = renderResumeTex(doc);
    const result = evaluateResumeRules({
      latexSource,
      legacyProofPoints: proofPoints,
      tier: "paid", // the editor is an engaged workspace → allow up to 10
      templated: true, // base resume renders in our template (it owns layout/ATS)
    });
    return result.surfaced.map(findingToProofPoint);
  } catch {
    return proofPoints;
  }
}

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: Request) {
  if (!llmConfigured) {
    return NextResponse.json({ demo: true, proofPoints: [] });
  }

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
    if (stats.feedbackHash === hash && Array.isArray(stats.proofPoints)) {
      logCachedRun("feedback", { userId: user.id, sessionId }, Date.now() - t0);
      return NextResponse.json({ proofPoints: stats.proofPoints, cached: true });
    }
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
    const proofPoints = refineFeedback(doc, parsed.proofPoints ?? []);
    // Persist with the hash so the next identical request is a free cache hit.
    if (sb && user) {
      const merged = { ...stats, proofPoints, feedbackHash: hash };
      await sb.from("resumes").update({ stats: merged }).eq("user_id", user.id);
    }
    return NextResponse.json({ proofPoints, cached: false });
  } catch {
    return NextResponse.json(
      { error: "Couldn't review your resume. Try again." },
      { status: 502 },
    );
  }
}
