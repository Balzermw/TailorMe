"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { TailoredDoc } from "@/lib/types";
import { loadBaseResumeDoc, saveResumeDoc, clearResumeDraft } from "@/lib/resume";
import { supabaseConfigured } from "@/lib/config";
import { ROUTES } from "@/components/landing/data";
import EditEditor from "../../applications/[id]/edit/edit-editor";

// Resolve the base resume client-side (freshly-built draft → saved account →
// localStorage), then reuse the shared editor with base-resume adapters. The
// server may pass a doc for a signed-in user to avoid a flash.
export default function ResumeEditLoader({
  serverDoc,
}: {
  serverDoc: TailoredDoc | null;
}) {
  const [doc, setDoc] = useState<TailoredDoc | null>(serverDoc);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let active = true;
    loadBaseResumeDoc().then((d) => {
      if (!active) return;
      setDoc(d ?? serverDoc ?? null);
      clearResumeDraft(); // consume the one-time handoff so reloads use the saved copy
      setLoaded(true);
    });
    return () => {
      active = false;
    };
  }, [serverDoc]);

  if (!doc) {
    return (
      <div style={{ padding: "64px 24px", textAlign: "center" }}>
        <p className="tm-body">
          {loaded ? (
            <>
              You don’t have a resume yet.{" "}
              <Link href={ROUTES.resumeNew} style={{ color: "var(--tm-blue-600)" }}>
                Build one from scratch
              </Link>
              .
            </>
          ) : (
            "Loading your resume…"
          )}
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
      proofPoints={[]}
      company=""
      role={doc.headline || "Base resume"}
      kind="resume"
      onSave={async ({ doc: edited }) => saveResumeDoc(edited)}
      onGetFeedback={async (current) => {
        const res = await fetch("/api/resume/feedback", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ doc: current }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data?.error || "failed");
        return Array.isArray(data.proofPoints) ? data.proofPoints : [];
      }}
      pdfUrl={supabaseConfigured ? "/api/resume/pdf" : ROUTES.resumePrint}
      backHref={ROUTES.dashboard}
      backLabel="Dashboard"
    />
  );
}
