"use client";

import { Check, FileText, UploadCloud } from "lucide-react";
import type { TailoredDoc } from "@/lib/types";
import PrintDoc from "@/app/applications/[id]/print/print-doc";

// Staged import loader (inspired by resume.co): a document "page" whose skeleton
// lines fill while the AI works, then the REAL parsed resume wipes in top-to-
// bottom, finishing with a green checkmark before we hand off to the editor.
export type ScanPhase = "reading" | "structuring" | "done";

const COPY: Record<ScanPhase, { title: string; sub: string }> = {
  reading: { title: "Reading your resume…", sub: "Pulling the text from your file." },
  structuring: {
    title: "Structuring your resume…",
    sub: "Sorting your experience, skills, and contact details into the right fields.",
  },
  done: { title: "All done!", sub: "Opening your resume…" },
};

// Varied skeleton line widths so the placeholder reads like a real document.
const LINE_WIDTHS = [62, 42, 86, 70, 90, 54, 82, 46, 88, 64, 78, 50, 84, 40];

export default function ResumeScanLoader({
  phase,
  doc,
  fileName,
}: {
  phase: ScanPhase;
  doc?: TailoredDoc | null;
  fileName?: string | null;
}) {
  const copy = COPY[phase];
  const showDoc = phase === "done" && !!doc;
  return (
    <div className="tmScan" role="status" aria-live="polite">
      <div className={`tmScan-badge tmScan-badge--${phase}`} aria-hidden="true">
        {phase === "done" ? (
          <Check size={26} strokeWidth={3} />
        ) : phase === "reading" ? (
          <UploadCloud size={24} />
        ) : (
          <FileText size={22} />
        )}
      </div>
      <b className="tmScan-title">{copy.title}</b>
      <span className="tmScan-sub">
        {copy.sub}
        {fileName && phase !== "done" ? ` (${fileName})` : ""}
      </span>

      <div className="tmScan-page">
        {showDoc ? (
          <div className="tmScan-doc">
            <PrintDoc doc={doc!} id="scan" resumeOnly hideToolbar />
          </div>
        ) : (
          <div className="tmScan-skeleton" aria-hidden="true">
            {LINE_WIDTHS.map((w, i) => (
              <span
                key={i}
                className="tmScan-line"
                style={{ width: `${w}%`, animationDelay: `${i * 0.11}s` }}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
