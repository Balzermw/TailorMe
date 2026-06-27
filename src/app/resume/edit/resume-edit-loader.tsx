"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { TailoredDoc, ProofPoint } from "@/lib/types";
import {
  loadBaseResumeDoc,
  saveResumeDoc,
  clearResumeDraft,
  hasResumeDraft,
  loadDraftProofPoints,
  loadSavedProofPoints,
  loadResumeDraftOptions,
  setTargetResume,
} from "@/lib/resume";
import { docToResumeText } from "@/lib/apply/serialize";
import { getSessionId, track } from "@/lib/track";
import { supabaseConfigured } from "@/lib/config";
import { ROUTES } from "@/components/landing/data";
import EditEditor from "../../applications/[id]/edit/edit-editor";

// Resolve the base resume client-side (freshly-built draft → saved account →
// localStorage), then reuse the shared editor with base-resume adapters. The
// server may pass a doc for a signed-in user to avoid a flash.
export default function ResumeEditLoader({
  serverDoc,
  serverProofPoints,
  serverResumeId,
}: {
  serverDoc: TailoredDoc | null;
  serverProofPoints: ProofPoint[];
  serverResumeId: string | null;
}) {
  const router = useRouter();
  // Start null and resolve in the effect so EditEditor mounts ONCE on the final
  // doc — a freshly-built/imported draft must win over any server doc, and
  // EditEditor's internal useState(initialDoc) won't pick up a later prop change.
  const [doc, setDoc] = useState<TailoredDoc | null>(null);
  const [proofPoints, setProofPoints] = useState<ProofPoint[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let active = true;
    const fromDraft = hasResumeDraft();
    const draftOptions = loadResumeDraftOptions();
    const draftPoints = fromDraft ? loadDraftProofPoints() : [];
    loadBaseResumeDoc().then((d) => {
      if (!active) return;
      const resolved = d ?? serverDoc ?? null;
      setDoc(resolved);
      // A freshly built/imported résumé (draft) carries its own feedback (the
      // import now runs the rules engine up front). A reopen shows the feedback
      // persisted with the saved résumé — account (live) or browser (demo).
      setProofPoints(
        fromDraft
          ? draftPoints
          : serverProofPoints.length
            ? serverProofPoints
            : loadSavedProofPoints(),
      );
      clearResumeDraft(); // consume the one-time handoff so reloads use the saved copy
      setLoaded(true);
      // The draft lives only in sessionStorage. Persist it (account when signed
      // in, else the browser) so a reload, the print view, the PDF endpoint, AND
      // a later reopen all find the résumé and its feedback.
      if (fromDraft && resolved && draftOptions.persistOnLoad) {
        void saveResumeDoc(resolved, undefined, draftPoints.length ? draftPoints : undefined);
      }
    });
    return () => {
      active = false;
    };
  }, [serverDoc, serverProofPoints]);

  if (!loaded) {
    return (
      <div style={{ padding: "64px 24px", textAlign: "center" }}>
        <p className="tm-body">Loading your resume…</p>
      </div>
    );
  }

  if (!doc) {
    return (
      <div style={{ padding: "64px 24px", textAlign: "center" }}>
        <p className="tm-body">
          You don’t have a resume yet.{" "}
          <Link href={ROUTES.resumeNew} style={{ color: "var(--tm-blue-600)" }}>
            Build one from scratch
          </Link>
          .
        </p>
      </div>
    );
  }

  return (
    <EditEditor
      id="resume"
      doc={doc}
      originalDoc={null}
      bulletDiffs={[]}
      initialDecisions={{}}
      keywords={[]}
      verificationStatus={null}
      initialUserEdited={false}
      proofPoints={proofPoints}
      company=""
      role={doc.headline || "Base resume"}
      kind="resume"
      onSave={async ({ doc: edited }) => saveResumeDoc(edited)}
      onGetFeedback={async (current) => {
        const res = await fetch("/api/resume/feedback", {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-tm-session": getSessionId() ?? "" },
          body: JSON.stringify({ doc: current }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data?.error || "failed");
        // Safe funnel telemetry (counts only — no résumé content).
        if (data.stats) {
          track("resume_feedback_suggestions_surfaced", {
            tier: "paid",
            rules_loaded: data.stats.rulesLoaded,
            candidates: data.stats.candidates,
            deduped: data.stats.deduped,
            surfaced: data.stats.surfaced,
            suppressed: data.stats.suppressed,
          });
        }
        return Array.isArray(data.proofPoints) ? data.proofPoints : [];
      }}
      onTargetJob={(current) => {
        setTargetResume(docToResumeText(current), serverResumeId ?? undefined);
        router.push(`${ROUTES.audit}?from=base`);
      }}
      pdfUrl={supabaseConfigured ? "/api/resume/pdf" : `${ROUTES.resumePrint}?print=1`}
      backHref={ROUTES.dashboard}
      backLabel="Dashboard"
    />
  );
}
