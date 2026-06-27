import { NextResponse } from "next/server";
import { getServerSupabase } from "@/lib/supabase/server";
import { updateApplicationResult } from "@/lib/db";
import { clampToTwoPages } from "@/lib/apply/latex";
import { sanitizeDoc } from "@/lib/apply/sanitize-doc";
import type { ApplyResult, EditDecision } from "@/lib/types";

export const runtime = "nodejs";

// Persist user edits to a tailored application. Manual editing only — no LLM,
// no credit. RLS + explicit user_id match scope it to the owner.
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const sb = await getServerSupabase();
  const user = sb ? (await sb.auth.getUser()).data.user : null;
  if (!sb || !user) {
    return NextResponse.json(
      { error: "Sign in to save edits.", signin: true },
      { status: 401 },
    );
  }

  let body: {
    doc?: unknown;
    decisions?: Record<string, EditDecision>;
    userEdited?: boolean;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const doc = sanitizeDoc(body.doc);
  if (!doc) {
    return NextResponse.json({ error: "Invalid document." }, { status: 400 });
  }

  // Load the existing result (RLS-scoped) to merge into + snapshot the AI draft.
  const { data: row } = await sb
    .from("applications")
    .select("result")
    .eq("id", id)
    .single();
  const existing = (row?.result ?? null) as ApplyResult | null;
  if (!existing) {
    return NextResponse.json({ error: "Application not found." }, { status: 404 });
  }

  const result: ApplyResult = {
    ...existing,
    doc: clampToTwoPages(doc),
    // Preserve the original AI draft once, so "reset to AI version" always works.
    originalDoc: existing.originalDoc ?? existing.doc ?? doc,
    edits: {
      savedAt: new Date().toISOString(),
      decisions:
        body.decisions && typeof body.decisions === "object"
          ? body.decisions
          : (existing.edits?.decisions ?? {}),
      userEdited: Boolean(body.userEdited) || Boolean(existing.edits?.userEdited),
    },
  };

  const ok = await updateApplicationResult(id, result);
  if (!ok) {
    return NextResponse.json({ error: "Couldn't save your edits." }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}

// Permanently delete one targeted application (resume + cover letter). RLS + the
// explicit user_id match scope it to the owner. Idempotent: deleting a row that
// is already gone still returns ok.
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const sb = await getServerSupabase();
  const user = sb ? (await sb.auth.getUser()).data.user : null;
  if (!sb || !user) {
    return NextResponse.json(
      { error: "Sign in to delete.", signin: true },
      { status: 401 },
    );
  }

  const { error } = await sb
    .from("applications")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);
  if (error) {
    console.error("application delete failed", error);
    return NextResponse.json(
      { error: "Couldn't delete this application. Please try again." },
      { status: 500 },
    );
  }
  return NextResponse.json({ ok: true });
}
