"use client";

import { useEffect, useState } from "react";
import {
  E2E_AGENT_REVIEW_APP_ID,
  E2E_AGENT_REVIEW_RESULT,
  E2E_AGENT_REVIEW_STORAGE_KEY,
  E2E_REVISION_STORAGE_KEY,
  defaultE2ERevisionState,
  type E2ERevisionState,
} from "@/lib/e2e/revision-fixture";
import type { TailoredDoc } from "@/lib/types";
import PrintDoc from "./print-doc";

function loadDoc(id: string): TailoredDoc {
  const agentFixture = id === E2E_AGENT_REVIEW_APP_ID;
  const storageKey = agentFixture ? E2E_AGENT_REVIEW_STORAGE_KEY : E2E_REVISION_STORAGE_KEY;
  const fallback = defaultE2ERevisionState(
    agentFixture ? E2E_AGENT_REVIEW_RESULT.edits?.agentReview : undefined,
    agentFixture ? E2E_AGENT_REVIEW_RESULT.doc ?? undefined : undefined,
  ).doc;
  try {
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as Partial<E2ERevisionState>;
    return parsed.doc ?? fallback;
  } catch {
    return fallback;
  }
}

export default function E2ERevisionPrint({ id }: { id: string }) {
  const [doc, setDoc] = useState<TailoredDoc | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => setDoc(loadDoc(id)), 0);
    return () => window.clearTimeout(timer);
  }, [id]);

  if (!doc) {
    return (
      <div className="tm" style={{ padding: "64px 24px", textAlign: "center" }}>
        <p className="tm-body">Loading revision print view...</p>
      </div>
    );
  }

  return <PrintDoc doc={doc} id={id} backHref={`/applications/${id}/edit`} />;
}
