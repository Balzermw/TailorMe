import { NextResponse } from "next/server";
import { getServerSupabase } from "@/lib/supabase/server";
import { llmConfigured } from "@/lib/config";
import { EDIT_REVIEW_RULES, rateLimitDisabled } from "@/lib/limits";
import { consume, tooManyRequests } from "@/lib/rate-limit";
import { scoreFit } from "@/lib/apply/pipeline";
import { withAiRun } from "@/lib/apply/ai-telemetry";
import { docToResumeText } from "@/lib/apply/serialize";
import { sanitizeDoc } from "@/lib/apply/sanitize-doc";
import { appendFitEntry, ensureInitialHistory, capRecheckScore } from "@/lib/apply/fit-history";
import type { ApplyResult } from "@/lib/types";

// Re-checks the fit of an application's CURRENT (possibly just-edited) resume
// against the SAME posting it was originally scored on. Re-runs vs the same
// posting are free per the product's terms, so this consumes no credit; a light
// per-account rate cap is the only guard. The new score is appended to the fit
// timeline (result.fitHistory) and the scored doc is persisted, so the history
// always references the doc that produced it.
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const sb = await getServerSupabase();
  const user = sb ? (await sb.auth.getUser()).data.user : null;
  if (!sb || !user) {
    return NextResponse.json(
      { error: "Sign in to re-check fit.", signin: true },
      { status: 401 },
    );
  }

  if (!rateLimitDisabled) {
    const rl = consume(`recheck:${user.id}`, EDIT_REVIEW_RULES);
    if (!rl.allowed) {
      return tooManyRequests("Too many re-checks. Try again shortly.", rl.resetAt);
    }
  }

  // Load the application's stored result + posting (RLS scopes this to the user).
  const { data: app } = await sb
    .from("applications")
    .select("id,result,posting")
    .eq("id", id)
    .single();
  if (!app) {
    return NextResponse.json({ error: "Application not found." }, { status: 404 });
  }
  const existing = (app.result ?? null) as ApplyResult | null;
  if (!existing) {
    return NextResponse.json({ error: "Nothing to re-check yet." }, { status: 409 });
  }

  // Score the current edited doc when the client sends one; else the saved doc.
  let body: { doc?: unknown } = {};
  try {
    body = (await request.json()) as { doc?: unknown };
  } catch {
    /* no body → use the saved doc */
  }
  const doc = (body.doc ? sanitizeDoc(body.doc) : null) ?? existing.doc;
  if (!doc) {
    return NextResponse.json(
      { error: "Run the full tailoring first, then re-check the draft." },
      { status: 409 },
    );
  }

  const postingText = (app.posting || existing.postingText || "").trim();
  if (!postingText) {
    return NextResponse.json(
      { error: "We don't have the original posting for this application, so it can't be re-scored." },
      { status: 409 },
    );
  }

  // Demo / unconfigured environments simulate the re-score on the client.
  if (!llmConfigured) {
    return NextResponse.json({ demo: true });
  }

  const resumeText = docToResumeText(doc);
  const { fit: rawFit } = await withAiRun("score", { userId: user.id }, () =>
    scoreFit(resumeText, postingText),
  );
  // Keep the re-score honest: cap how far a single re-check can lift the score so
  // a small edit can't jump it double digits on model variance. Declines pass
  // through. Improvements still accumulate across successive re-checks.
  const prevOverall = existing.fit?.overall ?? rawFit.overall;
  const cappedOverall = capRecheckScore(prevOverall, rawFit.overall);
  const fit = cappedOverall === rawFit.overall ? rawFit : { ...rawFit, overall: cappedOverall };

  const history = appendFitEntry(
    ensureInitialHistory(existing, new Date().toISOString()),
    fit.overall,
    fit.verdict,
    "recheck",
    new Date().toISOString(),
  );
  const nextResult: ApplyResult = {
    ...existing,
    fit,
    doc,
    postingText,
    fitHistory: history,
  };

  // updateApplicationResult re-derives fit_score from result.fit.overall and is
  // RLS + user_id scoped. Inline here to reuse the same authed client.
  const { error } = await sb
    .from("applications")
    .update({ result: nextResult, fit_score: fit.overall })
    .eq("id", id)
    .eq("user_id", user.id);
  if (error) {
    console.error("recheck update failed", error);
    return NextResponse.json(
      { error: "We couldn’t save the re-check. Please try again." },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true, fit, history });
}
