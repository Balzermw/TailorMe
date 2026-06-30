"use client";

import { useEffect, useMemo, useState } from "react";
import type { E2ERevisionState } from "@/lib/e2e/revision-fixture";
import {
  E2E_AGENT_REVIEW_APP_ID,
  E2E_AGENT_REVIEW_RESULT,
  E2E_AGENT_REVIEW_STORAGE_KEY,
  E2E_REVISION_AI_DOC,
  E2E_REVISION_PROOF_POINTS,
  E2E_REVISION_RESULT,
  E2E_REVISION_STORAGE_KEY,
  defaultE2ERevisionState,
  e2eRevisionFeedback,
} from "@/lib/e2e/revision-fixture";
import type { TailoredDoc } from "@/lib/types";
import EditEditor from "./edit-editor";

function loadState(storageKey: string, fallback: E2ERevisionState): E2ERevisionState {
  try {
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as Partial<E2ERevisionState>;
    if (!parsed.doc || !parsed.decisions) return fallback;
    return {
      doc: parsed.doc,
      decisions: parsed.decisions,
      agentReview: parsed.agentReview,
      userEdited: Boolean(parsed.userEdited),
    };
  } catch {
    return fallback;
  }
}

function saveState(storageKey: string, state: E2ERevisionState): void {
  window.localStorage.setItem(storageKey, JSON.stringify(state));
}

export default function E2ERevisionEditor({ id }: { id: string }) {
  const [state, setState] = useState<E2ERevisionState | null>(null);
  const result = id === E2E_AGENT_REVIEW_APP_ID ? E2E_AGENT_REVIEW_RESULT : E2E_REVISION_RESULT;
  const storageKey = id === E2E_AGENT_REVIEW_APP_ID ? E2E_AGENT_REVIEW_STORAGE_KEY : E2E_REVISION_STORAGE_KEY;
  const fallback = useMemo(
    () => defaultE2ERevisionState(result.edits?.agentReview, result.doc ?? E2E_REVISION_AI_DOC),
    [result.doc, result.edits?.agentReview],
  );

  useEffect(() => {
    const timer = window.setTimeout(() => setState(loadState(storageKey, fallback)), 0);
    return () => window.clearTimeout(timer);
  }, [fallback, storageKey]);

  if (!state) {
    return (
      <div style={{ padding: "64px 24px", textAlign: "center" }}>
        <p className="tm-body">Loading revision fixture...</p>
      </div>
    );
  }

  return (
    <EditEditor
      id={id}
      doc={state.doc}
      originalDoc={result.originalDoc ?? E2E_REVISION_AI_DOC}
      bulletDiffs={result.bulletDiffs ?? []}
      initialDecisions={state.decisions}
      agentPasses={result.agentPasses ?? []}
      initialAgentReview={state.agentReview ?? null}
      keywords={result.keywords}
      verificationStatus={null}
      initialUserEdited={state.userEdited}
      proofPoints={id === E2E_AGENT_REVIEW_APP_ID ? [] : E2E_REVISION_PROOF_POINTS}
      company={result.company}
      role={result.role}
      onSave={async ({ doc, decisions, agentReview, userEdited }) => {
        const next: E2ERevisionState = { doc, decisions, agentReview, userEdited };
        saveState(storageKey, next);
        setState(next);
        return { ok: true };
      }}
      onGetFeedback={async (doc: TailoredDoc) => e2eRevisionFeedback(doc)}
      pdfUrl={`/applications/${id}/print`}
      backHref="/dashboard"
      backLabel="Dashboard"
    />
  );
}
