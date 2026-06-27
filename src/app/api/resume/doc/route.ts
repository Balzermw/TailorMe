import { NextResponse } from "next/server";
import { getServerSupabase } from "@/lib/supabase/server";
import { sanitizeDoc } from "@/lib/apply/sanitize-doc";
import { clampToTwoPages } from "@/lib/apply/latex";
import { docToResumeText } from "@/lib/apply/serialize";
import type { ProofPoint } from "@/lib/types";

export const runtime = "nodejs";

// Storage-safe proof points: clamp lengths and keep only known fields. Unlike
// the apply route's version, this preserves the safe provenance ids (ruleId,
// category, targetSection) the editor uses to route + de-dupe suggestions.
function sanitizeStoredProofPoints(input: unknown): ProofPoint[] {
  if (!Array.isArray(input)) return [];
  const s = (v: unknown, n: number) => (typeof v === "string" ? v.slice(0, n).trim() : "");
  return input
    .slice(0, 12)
    .map((p) => {
      const x = (p ?? {}) as Record<string, unknown>;
      const sev = ["high", "medium", "low"].includes(x.severity as string)
        ? (x.severity as ProofPoint["severity"])
        : "medium";
      const point: ProofPoint = {
        title: s(x.title, 140),
        summary: s(x.summary, 240),
        quote: s(x.quote, 240) || undefined,
        why: s(x.why, 600),
        fix: s(x.fix, 600),
        severity: sev,
      };
      if (typeof x.ruleId === "string") point.ruleId = x.ruleId.slice(0, 80);
      if (typeof x.category === "string") point.category = x.category.slice(0, 60);
      if (typeof x.targetSection === "string") {
        point.targetSection = x.targetSection as ProofPoint["targetSection"];
      }
      return point;
    })
    .filter((p) => p.title);
}

// Save a STRUCTURED base resume (build-from-scratch + base-resume editor). One
// per user, upserted on user_id; raw_text is kept in sync with the doc. Anon /
// no-Supabase → nothing to persist server-side, the client uses localStorage.
export async function POST(request: Request) {
  let body: { doc?: unknown; source?: string; proofPoints?: unknown };
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
  const importFeedback =
    body.proofPoints !== undefined ? sanitizeStoredProofPoints(body.proofPoints) : null;

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

  // When import hands over freshly-computed feedback, persist it into stats so
  // the editor reopens it later. We clear the feedback cache hash so the user's
  // next explicit "Get feedback" still runs the full (LLM) review on this doc.
  if (importFeedback) {
    const { data: existing } = await sb
      .from("resumes")
      .select("stats")
      .eq("user_id", user.id)
      .maybeSingle();
    const prevStats = (existing?.stats as Record<string, unknown> | null) ?? {};
    row.stats = {
      ...prevStats,
      proofPoints: importFeedback,
      feedbackHash: null,
      feedbackCacheVersion: null,
    };
  }

  const { error } = await sb.from("resumes").upsert(row, { onConflict: "user_id" });
  if (error) {
    return NextResponse.json({ error: "Couldn't save your resume." }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
