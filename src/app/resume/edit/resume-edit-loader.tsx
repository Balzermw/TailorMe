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
  setTargetResume,
} from "@/lib/resume";
import { docToResumeText } from "@/lib/apply/serialize";
import { getSessionId } from "@/lib/track";
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
    loadBaseResumeDoc().then((d) => {
      if (!active) return;
      setDoc(d ?? serverDoc ?? null);
      // A freshly built/imported résumé (draft) has no prior feedback; only a
      // reload of the saved résumé shows the last review persisted server-side.
      setProofPoints(fromDraft ? [] : serverProofPoints);
      clearResumeDraft(); // consume the one-time handoff so reloads use the saved copy
      setLoaded(true);
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
        return Array.isArray(data.proofPoints) ? data.proofPoints : [];
      }}
      onTargetJob={(current) => {
        setTargetResume(docToResumeText(current), serverResumeId ?? undefined);
        router.push(`${ROUTES.audit}?from=base`);
      }}
      pdfUrl={supabaseConfigured ? "/api/resume/pdf" : ROUTES.resumePrint}
      backHref={ROUTES.dashboard}
      backLabel="Dashboard"
    />
  );
}
