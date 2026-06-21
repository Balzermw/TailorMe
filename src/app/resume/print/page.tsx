"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { TailoredDoc } from "@/lib/types";
import { loadBaseResumeDoc } from "@/lib/resume";
import { clampToTwoPages } from "@/lib/apply/latex";
import { ROUTES } from "@/components/landing/data";
import PrintDoc from "../../applications/[id]/print/print-doc";
import "../../applications/[id]/print/print.css";

// Browser-printable view of the base resume ("Save as PDF"). Also the fallback
// target of /api/resume/pdf when no LaTeX compiler is configured. Loads the doc
// client-side so it works for anon (localStorage) and signed-in users alike.
export default function ResumePrintPage() {
  const [doc, setDoc] = useState<TailoredDoc | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    loadBaseResumeDoc().then((d) => {
      setDoc(d);
      setLoaded(true);
    });
  }, []);

  if (!doc) {
    return (
      <div className="tm" style={{ padding: "64px 24px", textAlign: "center" }}>
        <p className="tm-body">
          {loaded ? (
            <>
              No resume to print yet.{" "}
              <Link href={ROUTES.resumeNew} style={{ color: "var(--tm-blue-600)" }}>
                Build one
              </Link>
              .
            </>
          ) : (
            "Loading…"
          )}
        </p>
      </div>
    );
  }

  return (
    <div className="tm">
      <PrintDoc
        doc={clampToTwoPages(doc)}
        id="resume"
        resumeOnly
        backHref={ROUTES.resumeEdit}
        backLabel="Back to resume"
      />
    </div>
  );
}
