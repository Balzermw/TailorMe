import { NextResponse } from "next/server";
import { llmConfigured } from "@/lib/config";
import { parseResume } from "@/lib/apply/pipeline";
import { docToResumeText } from "@/lib/apply/serialize";
import { sanitizeDoc } from "@/lib/apply/sanitize-doc";
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

  const sb = await getServerSupabase();
  const user = sb ? (await sb.auth.getUser()).data.user : null;

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
    const stats = await parseResume(docToResumeText(doc), undefined, true);
    const proofPoints = stats.proofPoints ?? [];
    // Persist for signed-in users so the editor shows the last review on reload.
    if (sb && user) {
      const { data: row } = await sb
        .from("resumes")
        .select("stats")
        .eq("user_id", user.id)
        .maybeSingle();
      const merged = { ...((row?.stats as Record<string, unknown>) ?? {}), proofPoints };
      await sb.from("resumes").update({ stats: merged }).eq("user_id", user.id);
    }
    return NextResponse.json({ proofPoints });
  } catch {
    return NextResponse.json(
      { error: "Couldn't review your resume. Try again." },
      { status: 502 },
    );
  }
}
