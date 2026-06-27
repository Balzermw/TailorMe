"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ROUTES } from "@/components/landing/data";
import { printHref } from "@/lib/apply/render";
import {
  loadLocalApplication,
  updateLocalApplicationResult,
} from "@/lib/local-applications";
import type {
  ApplicationRow,
  EditDecision,
  TailoredDoc,
} from "@/lib/types";
import EditEditor from "./edit-editor";

export default function LocalApplicationEditLoader({ id }: { id: string }) {
  const [app, setApp] = useState<ApplicationRow | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let active = true;
    queueMicrotask(() => {
      if (!active) return;
      setApp(loadLocalApplication(id));
      setLoaded(true);
    });
    return () => {
      active = false;
    };
  }, [id]);

  if (!loaded) {
    return (
      <div style={{ padding: "64px 24px", textAlign: "center" }}>
        <p className="tm-body">Loading your tailored draft...</p>
      </div>
    );
  }

  const result = app?.result ?? null;
  const doc = result?.doc ?? null;
  if (!app || !result || !doc) {
    return (
      <div style={{ padding: "64px 24px", textAlign: "center" }}>
        <p className="tm-body">
          This local draft is not available.{" "}
          <Link href={ROUTES.dashboard} style={{ color: "var(--tm-blue-600)" }}>
            Back to dashboard
          </Link>
        </p>
      </div>
    );
  }

  return (
    <EditEditor
      id={id}
      doc={doc}
      originalDoc={result.originalDoc ?? null}
      bulletDiffs={result.bulletDiffs ?? []}
      initialDecisions={result.edits?.decisions ?? {}}
      keywords={result.keywords ?? []}
      verificationStatus={result.verification?.status ?? null}
      initialUserEdited={result.edits?.userEdited ?? false}
      proofPoints={result.proofPoints ?? []}
      company={app.company}
      role={app.role}
      pdfUrl={printHref(id, true)}
      onSave={async ({
        doc: nextDoc,
        decisions,
        userEdited,
      }: {
        doc: TailoredDoc;
        decisions: Record<string, EditDecision>;
        userEdited: boolean;
      }) => {
        const nextResult = {
          ...result,
          doc: nextDoc,
          edits: {
            savedAt: new Date().toISOString(),
            decisions,
            userEdited,
          },
        };
        const updated = updateLocalApplicationResult(id, nextResult);
        if (!updated) return { ok: false, error: "Could not save this local draft." };
        setApp(updated);
        return { ok: true };
      }}
    />
  );
}
