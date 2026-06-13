"use client";

import { Printer } from "lucide-react";
import type { TailoredDoc } from "@/lib/types";

// Print-styled tailored resume + cover letter. "Save as PDF" via window.print().
export default function PrintDoc({ doc }: { doc: TailoredDoc }) {
  return (
    <div className="print-wrap">
      <div className="print-toolbar">
        <button
          type="button"
          className="tm-btn tm-btn--primary tm-btn--sm"
          onClick={() => window.print()}
        >
          <Printer size={14} /> Save as PDF
        </button>
      </div>

      <article className="print-page">
        <header className="print-head">
          <h1>{doc.name}</h1>
          <p>{doc.contact}</p>
        </header>
        {doc.summary && <p className="print-summary">{doc.summary}</p>}

        <h2 className="print-sec">Experience</h2>
        {doc.experience.map((e) => (
          <section key={`${e.company}-${e.role}`} className="print-entry">
            <div className="print-entry-head">
              <strong>
                {e.role} — {e.company}
              </strong>
              <span>{e.dates}</span>
            </div>
            <ul>
              {e.bullets.map((b, i) => (
                <li key={i}>{b}</li>
              ))}
            </ul>
          </section>
        ))}

        <h2 className="print-sec">Skills</h2>
        <p className="print-skills">{doc.skills.join(" · ")}</p>
      </article>

      <article className="print-page">
        <header className="print-head">
          <h1>{doc.name}</h1>
          <p>{doc.contact}</p>
        </header>
        <h2 className="print-sec">Cover letter</h2>
        {doc.coverLetter.split(/\n\n+/).map((para, i) => (
          <p key={i} className="print-para">
            {para}
          </p>
        ))}
      </article>
    </div>
  );
}
