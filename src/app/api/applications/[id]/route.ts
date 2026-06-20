import { NextResponse } from "next/server";
import { getServerSupabase } from "@/lib/supabase/server";
import { updateApplicationResult } from "@/lib/db";
import { clampToTwoPages } from "@/lib/apply/latex";
import type { ApplyResult, EditDecision, TailoredDoc } from "@/lib/types";

export const runtime = "nodejs";

function str(v: unknown, max: number): string {
  return typeof v === "string" ? v.slice(0, max) : "";
}

// Validate + bound an incoming (client-edited) doc so a malformed or oversized
// edit can never be persisted or break the LaTeX render. Mirrors the limits the
// pipeline already respects; returns null if the doc is unusable.
function sanitizeDoc(input: unknown): TailoredDoc | null {
  if (!input || typeof input !== "object") return null;
  const d = input as Record<string, unknown>;
  const experience = (Array.isArray(d.experience) ? d.experience : [])
    .slice(0, 24)
    .map((e) => {
      const x = (e ?? {}) as Record<string, unknown>;
      return {
        role: str(x.role, 160).trim(),
        company: str(x.company, 160).trim(),
        dates: str(x.dates, 80).trim(),
        bullets: (Array.isArray(x.bullets) ? x.bullets : [])
          .map((b) => str(b, 600).trim())
          .filter((b) => b.length > 0)
          .slice(0, 14),
      };
    })
    .filter((e) => e.role || e.company || e.bullets.length > 0);
  const doc: TailoredDoc = {
    name: str(d.name, 120).trim(),
    headline: str(d.headline, 160).trim(),
    contact: str(d.contact, 240).trim(),
    summary: str(d.summary, 1400).trim(),
    experience,
    skills: (Array.isArray(d.skills) ? d.skills : [])
      .map((s) => str(s, 80).trim())
      .filter(Boolean)
      .slice(0, 48),
    coverLetter: str(d.coverLetter, 6000),
  };
  if (!doc.name && experience.length === 0) return null;
  return doc;
}

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
