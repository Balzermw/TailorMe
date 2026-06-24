"use client";

import { useEffect, useState } from "react";
import {
  E2E_REVISION_STORAGE_KEY,
  defaultE2ERevisionState,
  type E2ERevisionState,
} from "@/lib/e2e/revision-fixture";
import type { TailoredDoc } from "@/lib/types";
import PrintDoc from "./print-doc";

function loadDoc(): TailoredDoc {
  try {
    const raw = window.localStorage.getItem(E2E_REVISION_STORAGE_KEY);
    if (!raw) return defaultE2ERevisionState().doc;
    const parsed = JSON.parse(raw) as Partial<E2ERevisionState>;
    return parsed.doc ?? defaultE2ERevisionState().doc;
  } catch {
    return defaultE2ERevisionState().doc;
  }
}

export default function E2ERevisionPrint({ id }: { id: string }) {
  const [doc, setDoc] = useState<TailoredDoc | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => setDoc(loadDoc()), 0);
    return () => window.clearTimeout(timer);
  }, []);

  if (!doc) {
    return (
      <div className="tm" style={{ padding: "64px 24px", textAlign: "center" }}>
        <p className="tm-body">Loading revision print view...</p>
      </div>
    );
  }

  return <PrintDoc doc={doc} id={id} backHref={`/applications/${id}/edit`} />;
}
