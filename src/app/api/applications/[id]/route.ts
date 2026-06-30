import { NextResponse } from "next/server";
import { getServerSupabase } from "@/lib/supabase/server";
import { updateApplicationResult } from "@/lib/db";
import { clampToTwoPages } from "@/lib/apply/latex";
import { sanitizeDoc } from "@/lib/apply/sanitize-doc";
import type {
  AgentPassId,
  AgentReviewState,
  AgentSuggestionDecision,
  ApplyResult,
  EditDecision,
} from "@/lib/types";

export const runtime = "nodejs";

const AGENT_PASS_IDS: AgentPassId[] = ["ada_ats", "remy_rolefit", "max_impact"];
const AGENT_DECISIONS: AgentSuggestionDecision[] = ["accepted", "rejected", "edited", "resolved"];

function sanitizeAgentReview(input: unknown): AgentReviewState | undefined {
  if (!input || typeof input !== "object") return undefined;
  const raw = input as Record<string, unknown>;
  const rawSuggestions =
    raw.agentSuggestions && typeof raw.agentSuggestions === "object"
      ? (raw.agentSuggestions as Record<string, unknown>)
      : {};
  const agentSuggestions: Record<string, AgentSuggestionDecision> = {};
  for (const [key, value] of Object.entries(rawSuggestions)) {
    if (key.length > 120) continue;
    if (AGENT_DECISIONS.includes(value as AgentSuggestionDecision)) {
      agentSuggestions[key] = value as AgentSuggestionDecision;
    }
  }
  const activeAgentPass = AGENT_PASS_IDS.includes(raw.activeAgentPass as AgentPassId)
    ? (raw.activeAgentPass as AgentPassId)
    : undefined;
  const rawProgress =
    raw.agentPassProgress && typeof raw.agentPassProgress === "object"
      ? (raw.agentPassProgress as Record<string, unknown>)
      : {};
  const agentPassProgress = Object.fromEntries(
    AGENT_PASS_IDS.map((id) => {
      const p = (rawProgress[id] ?? {}) as Record<string, unknown>;
      const total = Number(p.total);
      const reviewed = Number(p.reviewed);
      return [
        id,
        {
          reviewed: Number.isFinite(reviewed) ? Math.max(0, Math.round(reviewed)) : 0,
          total: Number.isFinite(total) ? Math.max(0, Math.round(total)) : 0,
          complete: Boolean(p.complete),
        },
      ];
    }),
  ) as AgentReviewState["agentPassProgress"];
  return { agentSuggestions, activeAgentPass, agentPassProgress };
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
    agentReview?: unknown;
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
      agentReview: sanitizeAgentReview(body.agentReview) ?? existing.edits?.agentReview,
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
