import { NextResponse } from "next/server";
import { getServerSupabase } from "@/lib/supabase/server";
import { MAX_RESUME_CHARS } from "@/lib/limits";
import type { ResumeStats } from "@/lib/types";

export const runtime = "nodejs";

// Saved resume profile, one per user. RLS scopes every row to its owner; the
// upsert sets user_id = the authenticated user, enforced by the row policy.

async function authed() {
  const sb = await getServerSupabase();
  if (!sb) return { sb: null, user: null };
  const { data } = await sb.auth.getUser();
  return { sb, user: data.user };
}

export async function GET() {
  const { sb, user } = await authed();
  if (!sb || !user) return NextResponse.json({ resume: null });
  // select("*") so this still works before the doc/source migration is applied
  // (an explicit column list would 400 on a missing column).
  const { data } = await sb
    .from("resumes")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!data) return NextResponse.json({ resume: null });
  return NextResponse.json({
    resume: {
      name: data.name,
      text: data.raw_text,
      stats: data.stats,
      doc: data.doc ?? null,
      source: data.source ?? "uploaded",
      savedAt: data.updated_at,
    },
  });
}

export async function POST(request: Request) {
  const { sb, user } = await authed();
  if (!sb || !user) {
    return NextResponse.json(
      { error: "Sign in to save your resume.", signin: true },
      { status: 401 },
    );
  }
  let body: { name?: string; text?: string; stats?: ResumeStats | null };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  const text = (body.text ?? "").slice(0, MAX_RESUME_CHARS);
  if (!text.trim()) {
    return NextResponse.json({ error: "No resume text." }, { status: 400 });
  }
  const name = (body.name || "My resume").slice(0, 120);

  const { data, error } = await sb
    .from("resumes")
    .upsert(
      {
        user_id: user.id,
        name,
        raw_text: text,
        stats: body.stats ?? null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" },
    )
    .select("id")
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: "Couldn't save your resume." }, { status: 500 });
  }
  return NextResponse.json({ ok: true, id: data?.id ?? null });
}

export async function DELETE() {
  const { sb, user } = await authed();
  if (!sb || !user) return NextResponse.json({ ok: true });
  await sb.from("resumes").delete().eq("user_id", user.id);
  return NextResponse.json({ ok: true });
}
