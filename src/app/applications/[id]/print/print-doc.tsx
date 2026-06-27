"use client";

import { useEffect, type ReactNode } from "react";
import Link from "next/link";
import { ArrowLeft, Printer } from "lucide-react";
import type { TailoredDoc } from "@/lib/types";
import { coverParagraphs, normalizeSkills } from "@/lib/apply/latex";
import { DEFAULT_TEMPLATE, isTemplateId } from "@/lib/apply/templates";
import { editHref } from "@/lib/apply/render";
import { cleanResumeDate } from "@/lib/apply/dates";
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

// Abbreviate full month names so a long date range ("February 2022 – December
// 2024") fits the fixed date column instead of overflowing onto the role title.
const MONTH_ABBR: Record<string, string> = {
  january: "Jan",
  february: "Feb",
  march: "Mar",
  april: "Apr",
  may: "May",
  june: "Jun",
  july: "Jul",
  august: "Aug",
  september: "Sep",
  october: "Oct",
  november: "Nov",
  december: "Dec",
};
function shortDates(s: string | undefined): string {
  return cleanResumeDate(s).replace(
    /\b(january|february|march|april|may|june|july|august|september|october|november|december)\b/gi,
    (m) => MONTH_ABBR[m.toLowerCase()] ?? m,
  );
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
  backHref,
  backLabel = "Back to editor",
}: {
  doc: TailoredDoc;
  id: string;
  resumeOnly?: boolean; // editor preview shows the résumé only (no cover letter)
  hideToolbar?: boolean; // editor has its own download controls
  highlightKeywords?: string[]; // editor preview: tint posting keywords + metrics
  backHref?: string; // override the toolbar "Back" link (base resume → /resume/edit)
  backLabel?: string;
}) {
  // In the editor preview we tint the posting keywords (mint) and metrics (blue)
  // right in the résumé, so it visibly carries the audit's findings instead of
  // reading as a fresh, unrelated document. Left off for the real PDF render.
  // Highlight whenever the editor preview asks for it (highlightKeywords is
  // provided, even as []). Metrics tint blue without any keywords; posting
  // keywords tint mint when present. The real PDF/print render passes nothing,
  // so it stays untinted.
  // When reached as the "Export PDF" target (?print=1), open the browser's
  // print/Save-as-PDF dialog automatically so export is one click. Never on the
  // inline editor preview (hideToolbar) — that would print mid-edit.
  useEffect(() => {
    if (hideToolbar || typeof window === "undefined") return;
    if (new URLSearchParams(window.location.search).get("print") !== "1") return;
    const t = window.setTimeout(() => {
      try {
        window.print();
      } catch {
        /* pop-up/print blocked — the toolbar button still works */
      }
    }, 450);
    return () => window.clearTimeout(t);
  }, [hideToolbar]);

  const hl = (t: string) =>
    highlightKeywords !== undefined ? highlight(t, highlightKeywords) : t;
  const first = doc.name.split(/\s+/).slice(0, -1).join(" ") || doc.name;
  const last =
    doc.name.split(/\s+/).length > 1
      ? doc.name.split(/\s+/).slice(-1)[0]
      : "";
  const coverParas = coverParagraphs(doc.coverLetter);
  // Skin per template (default = Jake's). moderncv-banking is the base look, so
  // it carries no skin class; every other id (incl. the default) gets one.
  const tpl = isTemplateId(doc.template) ? doc.template : DEFAULT_TEMPLATE;
  const tplClass = tpl === "moderncv-banking" ? "" : ` print-tpl--${tpl}`;

  return (
    <div className="print-wrap" data-testid="print-document">
      {!hideToolbar && (
        <div className="print-toolbar">
          <Link className="tm-btn tm-btn--outline tm-btn--sm" href={backHref ?? editHref(id)}>
            <ArrowLeft size={14} /> {backLabel}
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

      {/* Résumé — the template skins the preview (the compiled PDF is exact). */}
      <article className={`print-page${tplClass}`}>
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
                  <div className="mcv-entry-dates">{shortDates(e.dates)}</div>
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
                  <div className="mcv-entry-dates">{shortDates(ed.dates)}</div>
                  <div>
                    <div className="mcv-entry-role">{ed.degree}</div>
                    <div className="mcv-entry-company">{ed.school}</div>
                  </div>
                </div>
              ))}
            </>
          )}

          {doc.projects && doc.projects.length > 0 && (
            <>
              <h2 className="mcv-sec">Projects</h2>
              {doc.projects.map((p, i) => (
                <div key={i} className="mcv-entry">
                  <div className="mcv-entry-dates" />
                  <div>
                    <div className="mcv-entry-role">{p.name}</div>
                    {p.description && (
                      <ul>
                        {p.description
                          .split("\n")
                          .filter((l) => l.trim())
                          .map((l, j) => (
                            <li key={j}>{hl(l)}</li>
                          ))}
                      </ul>
                    )}
                  </div>
                </div>
              ))}
            </>
          )}

          {doc.certifications && doc.certifications.length > 0 && (
            <>
              <h2 className="mcv-sec">Certifications</h2>
              {doc.certifications.map((c, i) => (
                <div key={i} className="mcv-entry">
                  <div className="mcv-entry-dates">{shortDates(c.date)}</div>
                  <div>
                    <div className="mcv-entry-role">{c.name}</div>
                    {c.issuer && <div className="mcv-entry-company">{c.issuer}</div>}
                  </div>
                </div>
              ))}
            </>
          )}

          {(doc.skillGroups?.length || doc.skills.length > 0) && (
            <>
              <h2 className="mcv-sec">Skills</h2>
              {doc.skillGroups?.length ? (
                <div className="mcv-skillgroups">
                  {doc.skillGroups.map((g) => (
                    <p key={g.label} className="mcv-skillgroup">
                      <span className="mcv-skillgroup-label">{g.label}</span>
                      {normalizeSkills(g.skills).join(", ")}
                    </p>
                  ))}
                </div>
              ) : (
                <ul className="mcv-skills">
                  {normalizeSkills(doc.skills).map((s) => (
                    <li key={s}>{s}</li>
                  ))}
                </ul>
              )}
            </>
          )}
        </div>
      </article>

      {/* Cover letter */}
      {!resumeOnly && (
      <article className={`print-page${tplClass}`}>
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
