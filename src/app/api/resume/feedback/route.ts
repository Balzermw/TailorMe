import { NextResponse } from "next/server";
import { llmConfigured } from "@/lib/config";
import { parseResume } from "@/lib/apply/pipeline";
import { docToResumeText } from "@/lib/apply/serialize";
import { sanitizeDoc } from "@/lib/apply/sanitize-doc";
import { feedbackHash } from "@/lib/apply/hash";
import { getServerSupabase } from "@/lib/supabase/server";
import { EDIT_REVIEW_RULES, rateLimitDisabled } from "@/lib/limits";
import { consume, getClientIp, tooManyRequests } from "@/lib/rate-limit";

// First-pass feedback on a structured (built/edited) base resume. Serializes the
// doc to text and runs the same parse the upload path uses, but template-aware
// (it won't flag formatting/ATS-layout, since the doc renders in our template).
// Returns proof points for the editor's Suggestions section.

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
    const parsed = await parseResume(docToResumeText(doc), undefined, true);
    const proofPoints = parsed.proofPoints ?? [];
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
