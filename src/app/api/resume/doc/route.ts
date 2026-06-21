import { NextResponse } from "next/server";
import { getServerSupabase } from "@/lib/supabase/server";
import { sanitizeDoc } from "@/lib/apply/sanitize-doc";
import { clampToTwoPages } from "@/lib/apply/latex";
import { docToResumeText } from "@/lib/apply/serialize";

export const runtime = "nodejs";

// Save a STRUCTURED base resume (build-from-scratch + base-resume editor). One
// per user, upserted on user_id; raw_text is kept in sync with the doc. Anon /
// no-Supabase → nothing to persist server-side, the client uses localStorage.
export async function POST(request: Request) {
  let body: { doc?: unknown; source?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  const doc = sanitizeDoc(body.doc);
  if (!doc) {
    return NextResponse.json({ error: "Add a name and at least one section." }, { status: 400 });
  }
  const clamped = clampToTwoPages(doc);

  const sb = await getServerSupabase();
  const user = sb ? (await sb.auth.getUser()).data.user : null;
  if (!sb || !user) {
    // Anonymous / no Supabase: client persists to localStorage; just acknowledge.
    return NextResponse.json({ ok: true, local: true });
  }

  const row: Record<string, unknown> = {
    user_id: user.id,
    name: clamped.name || "My resume",
    raw_text: docToResumeText(clamped),
    doc: clamped,
    updated_at: new Date().toISOString(),
  };
  // Only set `source` when explicitly provided (e.g. the scratch builder); on an
  // update we omit it so an existing source isn't clobbered, and a fresh insert
  // falls back to the column default ('uploaded').
  if (body.source === "scratch" || body.source === "pasted" || body.source === "uploaded") {
    row.source = body.source;
  }

  const { error } = await sb.from("resumes").upsert(row, { onConflict: "user_id" });
  if (error) {
    return NextResponse.json({ error: "Couldn't save your resume." }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
