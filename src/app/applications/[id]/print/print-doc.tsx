"use client";

import { FileCode, Printer } from "lucide-react";
import type { TailoredDoc } from "@/lib/types";
import { coverParagraphs } from "@/lib/apply/latex";

// moderncv-banking render of the tailored resume + cover letter.
// "Save as PDF" via the browser; "Download .tex" fetches the real LaTeX source
// (which a LATEX_COMPILE_URL service can compile to an identical PDF).
export default function PrintDoc({
  doc,
  id,
}: {
  doc: TailoredDoc;
  id: string;
}) {
  const first = doc.name.split(/\s+/).slice(0, -1).join(" ") || doc.name;
  const last =
    doc.name.split(/\s+/).length > 1
      ? doc.name.split(/\s+/).slice(-1)[0]
      : "";
  const coverParas = coverParagraphs(doc.coverLetter);

  return (
    <div className="print-wrap">
      <div className="print-toolbar">
        <a
          className="tm-btn tm-btn--outline tm-btn--sm"
          href={`/api/applications/${id}/latex`}
        >
          <FileCode size={14} /> Download .tex
        </a>
        <button
          type="button"
          className="tm-btn tm-btn--primary tm-btn--sm"
          onClick={() => window.print()}
        >
          <Printer size={14} /> Save as PDF
        </button>
      </div>

      {/* Résumé */}
      <article className="print-page">
        <header className="mcv-head">
          <div className="mcv-name">
            {first} {last && <span>{last}</span>}
          </div>
          <div className="mcv-title">{doc.headline}</div>
          <div className="mcv-contact">{doc.contact}</div>
        </header>
        <div className="mcv-body">
          {doc.summary && (
            <>
              <h2 className="mcv-sec">Summary</h2>
              <p className="mcv-summary">{doc.summary}</p>
            </>
          )}

          {doc.experience.length > 0 && (
            <>
              <h2 className="mcv-sec">Experience</h2>
              {doc.experience.map((e, i) => (
                <div key={i} className="mcv-entry">
                  <div className="mcv-entry-dates">{e.dates}</div>
                  <div>
                    <div className="mcv-entry-role">{e.role}</div>
                    <div className="mcv-entry-company">{e.company}</div>
                    <ul>
                      {e.bullets.map((b, i) => (
                        <li key={i}>{b}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              ))}
            </>
          )}

          {doc.skills.length > 0 && (
            <>
              <h2 className="mcv-sec">Skills</h2>
              <p className="mcv-skills">{doc.skills.join("  •  ")}</p>
            </>
          )}
        </div>
      </article>

      {/* Cover letter */}
      <article className="print-page">
        <header className="mcv-head">
          <div className="mcv-name">
            {first} {last && <span>{last}</span>}
          </div>
          <div className="mcv-title">{doc.headline}</div>
          <div className="mcv-contact">{doc.contact}</div>
        </header>
        <div className="mcv-body">
          <h2 className="mcv-sec">Cover letter</h2>
          {coverParas.map((p, i) =>
            i === coverParas.length - 1 ? (
              <p key={i} className="mcv-sig">
                {p}
              </p>
            ) : (
              <p key={i} className="mcv-para">
                {p}
              </p>
            ),
          )}
        </div>
      </article>
    </div>
  );
}
