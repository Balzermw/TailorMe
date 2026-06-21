import { NextResponse } from "next/server";
import { llmConfigured } from "@/lib/config";
import { structureResume } from "@/lib/apply/pipeline";
import { getServerSupabase } from "@/lib/supabase/server";
import { EDIT_REVIEW_RULES, MAX_RESUME_CHARS, rateLimitDisabled } from "@/lib/limits";
import { consume, getClientIp, tooManyRequests } from "@/lib/rate-limit";

// Paste-import: turn pasted resume/LinkedIn/notes text into a structured base
// resume (TailoredDoc) the user can edit. No posting, no scoring, no credit.

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: Request) {
  if (!llmConfigured) {
    return NextResponse.json({ demo: true, doc: null });
  }

  let body: { text?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  const text = (body.text ?? "").trim().slice(0, MAX_RESUME_CHARS);
  if (text.length < 40) {
    return NextResponse.json(
      { error: "Paste a bit more, at least a few lines of your background." },
      { status: 400 },
    );
  }

  if (!rateLimitDisabled) {
    const sb = await getServerSupabase();
    let who = getClientIp(request);
    if (sb) {
      const { data } = await sb.auth.getUser();
      if (data.user?.id) who = data.user.id;
    }
    const res = consume(`resume-structure:${who}`, EDIT_REVIEW_RULES);
    if (!res.allowed) {
      return tooManyRequests(
        "You're importing very fast. Give it a minute.",
        res.resetAt,
      );
    }
  }

  try {
    const doc = await structureResume(text);
    if (!doc) {
      return NextResponse.json(
        { error: "Couldn't read a resume from that text. Add a bit more detail." },
        { status: 422 },
      );
    }
    return NextResponse.json({ doc });
  } catch {
    return NextResponse.json(
      { error: "Couldn't import that. Try again." },
      { status: 502 },
    );
  }
}
