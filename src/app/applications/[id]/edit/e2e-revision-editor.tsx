"use client";

import { useEffect, useState } from "react";
import type { E2ERevisionState } from "@/lib/e2e/revision-fixture";
import {
  E2E_REVISION_AI_DOC,
  E2E_REVISION_PROOF_POINTS,
  E2E_REVISION_RESULT,
  E2E_REVISION_STORAGE_KEY,
  defaultE2ERevisionState,
  e2eRevisionFeedback,
} from "@/lib/e2e/revision-fixture";
import type { TailoredDoc } from "@/lib/types";
import EditEditor from "./edit-editor";

function loadState(): E2ERevisionState {
  try {
    const raw = window.localStorage.getItem(E2E_REVISION_STORAGE_KEY);
    if (!raw) return defaultE2ERevisionState();
    const parsed = JSON.parse(raw) as Partial<E2ERevisionState>;
    if (!parsed.doc || !parsed.decisions) return defaultE2ERevisionState();
    return {
      doc: parsed.doc,
      decisions: parsed.decisions,
      userEdited: Boolean(parsed.userEdited),
    };
  } catch {
    return defaultE2ERevisionState();
  }
}

function saveState(state: E2ERevisionState): void {
  window.localStorage.setItem(E2E_REVISION_STORAGE_KEY, JSON.stringify(state));
}

export default function E2ERevisionEditor({ id }: { id: string }) {
  const [state, setState] = useState<E2ERevisionState | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => setState(loadState()), 0);
    return () => window.clearTimeout(timer);
  }, []);

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
      originalDoc={E2E_REVISION_AI_DOC}
      bulletDiffs={E2E_REVISION_RESULT.bulletDiffs ?? []}
      initialDecisions={state.decisions}
      keywords={E2E_REVISION_RESULT.keywords}
      verificationStatus={null}
      initialUserEdited={state.userEdited}
      proofPoints={E2E_REVISION_PROOF_POINTS}
      company={E2E_REVISION_RESULT.company}
      role={E2E_REVISION_RESULT.role}
      onSave={async ({ doc, decisions, userEdited }) => {
        const next: E2ERevisionState = { doc, decisions, userEdited };
        saveState(next);
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
