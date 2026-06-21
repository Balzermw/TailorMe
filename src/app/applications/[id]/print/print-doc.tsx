"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowLeft, Printer } from "lucide-react";
import type { TailoredDoc } from "@/lib/types";
import { coverParagraphs, normalizeSkills } from "@/lib/apply/latex";
import { editHref } from "@/lib/apply/render";
import { highlight } from "@/lib/highlight";

// Render the contact line, linkifying any email or URL. A bare word like
// "LinkedIn" with no URL stays plain text (there's nothing to link to); a real
// linkedin.com/… handle or an email becomes a clickable link.
function renderContact(contact: string) {
  const parts = contact.split(/\s*[|·]\s*/).filter(Boolean);
  return parts.map((part, i) => {
    let el: ReactNode = part;
    if (/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(part)) {
      el = <a href={`mailto:${part}`}>{part}</a>;
    } else if (/^(https?:\/\/|www\.)/i.test(part) || /\b[\w-]+\.(com|io|dev|net|org)\b/i.test(part)) {
      const href = /^https?:\/\//i.test(part) ? part : `https://${part}`;
      el = (
        <a href={href} target="_blank" rel="noopener noreferrer">
          {part}
        </a>
      );
    }
    return (
      <span key={i}>
        {i > 0 && "  |  "}
        {el}
      </span>
    );
  });
}

// moderncv-banking render of the tailored resume + cover letter.
// "Save as PDF" via the browser; "Download .tex" fetches the real LaTeX source
// (which a LATEX_COMPILE_URL service can compile to an identical PDF).
export default function PrintDoc({
  doc,
  id,
  resumeOnly = false,
  hideToolbar = false,
  highlightKeywords,
}: {
  doc: TailoredDoc;
  id: string;
  resumeOnly?: boolean; // editor preview shows the résumé only (no cover letter)
  hideToolbar?: boolean; // editor has its own download controls
  highlightKeywords?: string[]; // editor preview: tint posting keywords + metrics
}) {
  // In the editor preview we tint the posting keywords (mint) and metrics (blue)
  // right in the résumé, so it visibly carries the audit's findings instead of
  // reading as a fresh, unrelated document. Left off for the real PDF render.
  const hl = (t: string) =>
    highlightKeywords && highlightKeywords.length ? highlight(t, highlightKeywords) : t;
  const first = doc.name.split(/\s+/).slice(0, -1).join(" ") || doc.name;
  const last =
    doc.name.split(/\s+/).length > 1
      ? doc.name.split(/\s+/).slice(-1)[0]
      : "";
  const coverParas = coverParagraphs(doc.coverLetter);

  return (
    <div className="print-wrap">
      {!hideToolbar && (
        <div className="print-toolbar">
          <Link className="tm-btn tm-btn--outline tm-btn--sm" href={editHref(id)}>
            <ArrowLeft size={14} /> Back to editor
          </Link>
          <button
            type="button"
            className="tm-btn tm-btn--primary tm-btn--sm"
            onClick={() => window.print()}
          >
            <Printer size={14} /> Save as PDF
          </button>
        </div>
      )}

      {/* Résumé */}
      <article className="print-page">
        <header className="mcv-head">
          <div className="mcv-name">
            {first} {last && <span>{last}</span>}
          </div>
          <div className="mcv-title">{doc.headline}</div>
          <div className="mcv-contact">{renderContact(doc.contact)}</div>
        </header>
        <div className="mcv-body">
          {doc.summary && (
            <>
              <h2 className="mcv-sec">Summary</h2>
              <p className="mcv-summary">{hl(doc.summary)}</p>
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
                        <li key={i}>{hl(b)}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              ))}
            </>
          )}

          {doc.education && doc.education.length > 0 && (
            <>
              <h2 className="mcv-sec">Education</h2>
              {doc.education.map((ed, i) => (
                <div key={i} className="mcv-entry">
                  <div className="mcv-entry-dates">{ed.dates}</div>
                  <div>
                    <div className="mcv-entry-role">{ed.degree}</div>
                    <div className="mcv-entry-company">{ed.school}</div>
                  </div>
                </div>
              ))}
            </>
          )}

          {doc.skills.length > 0 && (
            <>
              <h2 className="mcv-sec">Skills</h2>
              <p className="mcv-skills">{normalizeSkills(doc.skills).join("  •  ")}</p>
            </>
          )}
        </div>
      </article>

      {/* Cover letter */}
      {!resumeOnly && (
      <article className="print-page">
        <header className="mcv-head">
          <div className="mcv-name">
            {first} {last && <span>{last}</span>}
          </div>
          <div className="mcv-title">{doc.headline}</div>
          <div className="mcv-contact">{renderContact(doc.contact)}</div>
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
      )}
    </div>
  );
}
