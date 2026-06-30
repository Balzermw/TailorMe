"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ROUTES } from "@/components/landing/data";
import { printHref } from "@/lib/apply/render";
import {
  loadLocalApplication,
  recheckLocalApplication,
  updateLocalApplicationResult,
} from "@/lib/local-applications";
import { simulateRecheckScore } from "@/lib/apply/fit-history";
import { fitTier } from "@/lib/apply/fit-tier";
import { docToResumeText } from "@/lib/apply/serialize";
import type {
  ApplicationRow,
  AgentReviewState,
  EditDecision,
  FitBreakdown,
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
      agentPasses={result.agentPasses ?? []}
      initialAgentReview={result.edits?.agentReview ?? null}
      keywords={result.keywords ?? []}
      verificationStatus={result.verification?.status ?? null}
      initialUserEdited={result.edits?.userEdited ?? false}
      proofPoints={result.proofPoints ?? []}
      company={app.company}
      role={app.role}
      pdfUrl={printHref(id, true)}
      initialFit={result.fit ?? null}
      initialHistory={result.fitHistory}
      canRecheck={Boolean(result.postingText)}
      onRecheck={async (nextDoc: TailoredDoc) => {
        // Demo mode has no server row: simulate the re-score deterministically
        // off the edited resume and persist the new point to localStorage.
        const prev = result.fit?.overall ?? 0;
        const overall = simulateRecheckScore(prev, docToResumeText(nextDoc), true);
        const newFit: FitBreakdown = {
          ...result.fit,
          overall,
          verdict: fitTier(overall).label,
        };
        const updated = recheckLocalApplication(id, newFit, nextDoc);
        if (!updated?.result) return { ok: false, error: "Could not re-check this local draft." };
        setApp(updated);
        return { ok: true, fit: updated.result.fit, history: updated.result.fitHistory };
      }}
      onSave={async ({
        doc: nextDoc,
        decisions,
        agentReview,
        userEdited,
      }: {
        doc: TailoredDoc;
        decisions: Record<string, EditDecision>;
        agentReview?: AgentReviewState;
        userEdited: boolean;
      }) => {
        const nextResult = {
          ...result,
          doc: nextDoc,
          edits: {
            savedAt: new Date().toISOString(),
            decisions,
            agentReview,
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
