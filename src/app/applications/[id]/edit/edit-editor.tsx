"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Check,
  Download,
  PenLine,
  Plus,
  RotateCcw,
  ShieldCheck,
  Trash2,
  X,
} from "lucide-react";
import type {
  BulletDiff,
  EditDecision,
  ProofPoint,
  TailoredDoc,
} from "@/lib/types";
import { pdfHref } from "@/lib/apply/render";
import { ROUTES } from "@/components/landing/data";
import { bulletKey, diffMap } from "@/lib/apply/redline";
import { highlight } from "@/lib/highlight";
import PrintDoc from "../print/print-doc";

type Section = "header" | "summary" | "experience" | "skills" | "fixes";

const SEV: Record<ProofPoint["severity"], { label: string; color: string; bg: string }> = {
  high: { label: "High priority", color: "#b3261e", bg: "#fdecea" },
  medium: { label: "Worth fixing", color: "#854f0b", bg: "#fdf3e7" },
  low: { label: "Minor polish", color: "var(--tm-zinc)", bg: "rgba(24,24,27,0.06)" },
};

// Section-at-a-time résumé editor (Res.Me builder pattern): sidebar nav →
// one section in the center with full-size inputs → wide résumé-only live
// preview. Per-bullet Accept/Reject/Edit diff rows appear in Experience when
// the run produced bulletDiffs. The cover letter is intentionally not edited
// here (it's preserved untouched on save).
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

// "YYYY-MM" → "Mon YYYY" (e.g. "2019-03" → "Mar 2019").
function fmtMonth(v: string): string {
  const m = /^(\d{4})-(\d{2})$/.exec(v);
  if (!m) return "";
  return `${MONTHS[Number(m[2]) - 1] ?? ""} ${m[1]}`.trim();
}

// Best-effort parse of a free-text date range ("2019 – present", "Jan 2019 –
// Mar 2023") into the two native month inputs (YYYY-MM) + a "present" flag.
function parseDates(value: string): { start: string; end: string; present: boolean } {
  const toMonth = (s: string): string => {
    const yr = /(?:19|20)\d{2}/.exec(s)?.[0];
    if (!yr) return "";
    const mi = MONTHS.findIndex((m) => new RegExp(`\\b${m}`, "i").test(s));
    return `${yr}-${String(mi >= 0 ? mi + 1 : 1).padStart(2, "0")}`;
  };
  const parts = value
    .split(/\s*(?:–|—|-|\bto\b)\s*/i)
    .map((s) => s.trim())
    .filter(Boolean);
  const endRaw = parts[1] ?? "";
  const present =
    /present|current|now|ongoing/i.test(endRaw) ||
    (parts.length < 2 && /present|current/i.test(value));
  return { start: toMonth(parts[0] ?? ""), end: present ? "" : toMonth(endRaw), present };
}

// Month/year date range: two native month pickers + a "Present" toggle, composed
// back into the doc's single date string. No free-text entry to get wrong.
function DateRange({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const { start, end, present } = parseDates(value);
  const compose = (s: string, e: string, p: boolean) =>
    [fmtMonth(s), p ? "Present" : fmtMonth(e)].filter(Boolean).join(" – ");
  return (
    <div className="tmE-daterange">
      <input
        type="month"
        className="tmE-input"
        value={start}
        aria-label="Start month"
        onChange={(ev) => onChange(compose(ev.target.value, end, present))}
      />
      <span className="tmE-daterange-sep">to</span>
      {present ? (
        <span className="tmE-daterange-present">Present</span>
      ) : (
        <input
          type="month"
          className="tmE-input"
          value={end}
          aria-label="End month"
          onChange={(ev) => onChange(compose(start, ev.target.value, false))}
        />
      )}
      <label className="tmE-daterange-now">
        <input
          type="checkbox"
          checked={present}
          onChange={(ev) => onChange(compose(start, end, ev.target.checked))}
        />
        Present
      </label>
    </div>
  );
}

export default function EditEditor({
  id,
  doc: initialDoc,
  originalDoc,
  bulletDiffs,
  initialDecisions,
  keywords,
  verificationStatus,
  initialUserEdited,
  proofPoints,
  company,
  role,
}: {
  id: string;
  doc: TailoredDoc;
  originalDoc: TailoredDoc | null;
  bulletDiffs: BulletDiff[];
  initialDecisions: Record<string, EditDecision>;
  keywords: string[];
  verificationStatus: string | null;
  initialUserEdited: boolean;
  proofPoints: ProofPoint[];
  company: string;
  role: string;
}) {
  const [doc, setDoc] = useState<TailoredDoc>(initialDoc);
  const [decisions, setDecisions] = useState<Record<string, EditDecision>>(initialDecisions);
  const [section, setSection] = useState<Section>("header");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ text: string; err: boolean } | null>(null);
  const [dirty, setDirty] = useState(false);
  const [trustDismissed, setTrustDismissed] = useState(false);
  const [showTrace, setShowTrace] = useState(false);

  const diffs = diffMap(bulletDiffs);
  const totalPending = bulletDiffs.filter((d) => !decisions[bulletKey(d.entry, d.bullet)]).length;
  const modified =
    initialUserEdited ||
    dirty ||
    Object.values(decisions).some((d) => d === "rejected" || d === "edited");
  const showVerified =
    !modified &&
    !trustDismissed &&
    (verificationStatus === "clean" || verificationStatus === "corrected");

  function touch() {
    setDirty(true);
    setMsg(null);
  }
  function patch(p: Partial<TailoredDoc>) {
    setDoc((d) => ({ ...d, ...p }));
    touch();
  }
  function setEntry(i: number, p: Partial<TailoredDoc["experience"][number]>) {
    setDoc((d) => ({ ...d, experience: d.experience.map((e, j) => (j === i ? { ...e, ...p } : e)) }));
    touch();
  }
  function setBulletText(ei: number, bi: number, text: string) {
    setDoc((d) => ({
      ...d,
      experience: d.experience.map((e, j) =>
        j === ei ? { ...e, bullets: e.bullets.map((b, k) => (k === bi ? text : b)) } : e,
      ),
    }));
    touch();
  }
  function addBullet(ei: number) {
    setDoc((d) => ({
      ...d,
      experience: d.experience.map((e, j) => (j === ei ? { ...e, bullets: [...e.bullets, ""] } : e)),
    }));
    touch();
  }
  function removeBullet(ei: number, bi: number) {
    setDoc((d) => ({
      ...d,
      experience: d.experience.map((e, j) =>
        j === ei ? { ...e, bullets: e.bullets.filter((_, k) => k !== bi) } : e,
      ),
    }));
    touch();
  }
  function decide(ei: number, bi: number, decision: EditDecision) {
    const key = bulletKey(ei, bi);
    const d = diffs.get(key);
    setDecisions((s) => ({ ...s, [key]: decision }));
    if (d && decision === "accepted") setBulletText(ei, bi, d.after);
    else if (d && decision === "rejected") setBulletText(ei, bi, d.before);
    else touch();
  }
  function resetToAi() {
    if (!originalDoc) return;
    setDoc(JSON.parse(JSON.stringify(originalDoc)) as TailoredDoc);
    setDecisions({});
    touch();
  }

  async function save() {
    if (saving) return;
    setSaving(true);
    setMsg(null);
    try {
      const res = await fetch(`/api/applications/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ doc, decisions, userEdited: true }),
      });
      const data = await res.json();
      if (res.ok && data.ok) {
        setMsg({ text: "Saved", err: false });
        setDirty(false);
      } else {
        setMsg({ text: data.error || "Couldn’t save your edits.", err: true });
      }
    } catch {
      setMsg({ text: "Couldn’t save your edits.", err: true });
    } finally {
      setSaving(false);
    }
  }

  const NAV: { key: Section; label: string; badge?: number }[] = [
    { key: "header", label: "Header" },
    { key: "summary", label: "Summary" },
    { key: "experience", label: "Experience", badge: totalPending || undefined },
    { key: "skills", label: "Skills" },
    ...(proofPoints.length ? [{ key: "fixes" as Section, label: "Suggestions", badge: proofPoints.length }] : []),
  ];

  return (
    <div className="tmE-wrap">
      <div className="tmE-head">
        <Link className="tmE-back" href={ROUTES.dashboard}>
          <ArrowLeft size={15} /> Dashboard
        </Link>
        <h1>
          {role} <span className="tmE-head-co">at {company}</span>
        </h1>
        <div className="tmE-head-right">
          {bulletDiffs.length > 0 && (
            <span className="tmE-progress">
              {bulletDiffs.length - totalPending}/{bulletDiffs.length} changes reviewed
            </span>
          )}
          {msg && (
            <span className={"tmE-saved" + (msg.err ? " is-err" : "")}>
              {!msg.err && <Check size={14} />} {msg.text}
            </span>
          )}
          {originalDoc && (
            <button
              type="button"
              className="tm-btn tm-btn--outline tm-btn--sm"
              onClick={resetToAi}
              title="Discard all your manual edits and restore the AI-tailored version of the whole document."
            >
              <RotateCcw size={13} /> Undo my edits
            </button>
          )}
          <a className="tm-btn tm-btn--outline tm-btn--sm" href={pdfHref(id)} target="_blank" rel="noopener noreferrer">
            <Download size={14} /> PDF
          </a>
          <button
            type="button"
            className="tm-btn tm-btn--primary tm-btn--sm"
            onClick={() => void save()}
            disabled={saving || !dirty}
          >
            {saving ? "Saving…" : dirty ? "Save edits" : "Saved"}
          </button>
        </div>
      </div>

      <div className="tmE-grid3">
        {/* ---- section nav ---- */}
        <nav className="tmE-tree">
          {NAV.map((n) => (
            <button
              key={n.key}
              type="button"
              className={"tmE-tree-item" + (section === n.key ? " is-active" : "")}
              onClick={() => setSection(n.key)}
            >
              <span className="tmE-tree-label">{n.label}</span>
              {n.badge ? <span className="tmE-tree-badge">{n.badge}</span> : null}
            </button>
          ))}
        </nav>

        {/* ---- one section at a time ---- */}
        <div className="tmE-main">
          {showVerified && (
            <div className="tmE-trust is-ok">
              <span className="tmE-trust-ic">
                <ShieldCheck size={15} />
              </span>
              <div>
                <b>Verified against your resume</b>
                <span>
                  Every line traces back to your original.{" "}
                  {originalDoc && originalDoc.experience.length > 0 && (
                    <button
                      type="button"
                      className="tmE-trust-link"
                      onClick={() => setShowTrace((v) => !v)}
                    >
                      {showTrace ? "Hide the trace" : "See the trace"}
                    </button>
                  )}
                </span>
              </div>
              <button
                type="button"
                className="tmE-trust-x"
                aria-label="Dismiss"
                onClick={() => setTrustDismissed(true)}
              >
                <X size={14} />
              </button>
            </div>
          )}
          {showVerified && showTrace && originalDoc && (
            <div className="tmE-trace tmF-anim">
              <p className="tmE-trace-intro">
                Each tailored line is a rewrite of something you already wrote. Here is
                your original next to the tailored version, section by section.
              </p>
              {doc.experience.map((e, i) => {
                const orig = originalDoc.experience[i];
                if (!orig) return null;
                return (
                  <div key={i} className="tmE-trace-entry">
                    <p className="tmE-trace-role">{e.role || orig.role}</p>
                    <span className="tmE-trace-tag">Your original</span>
                    {orig.bullets.map((b, bi) => (
                      <p key={bi} className="tmE-trace-before">
                        {b}
                      </p>
                    ))}
                    <span className="tmE-trace-tag is-after">Tailored</span>
                    {e.bullets.map((b, bi) => (
                      <p key={bi} className="tmE-trace-after">
                        {highlight(b, keywords)}
                      </p>
                    ))}
                  </div>
                );
              })}
            </div>
          )}
          {modified && (
            <div className="tmE-trust is-edited">
              <span className="tmE-trust-ic">
                <PenLine size={15} />
              </span>
              <div>
                <b>Edited by you</b>
                <span>Saved, but no longer carries the AI faithfulness check.</span>
              </div>
            </div>
          )}

          {section === "header" && (
            <section className="tmE-panel tmF-anim">
              <h2 className="tmE-panel-title">Header</h2>
              <p className="tmE-panel-sub">Your name, target headline, and contact line.</p>
              <div className="tmE-field">
                <label>Name</label>
                <input className="tmE-input" value={doc.name} onChange={(e) => patch({ name: e.target.value })} />
              </div>
              <div className="tmE-field">
                <label>Headline</label>
                <input className="tmE-input" value={doc.headline} onChange={(e) => patch({ headline: e.target.value })} />
              </div>
              <div className="tmE-field">
                <label>Contact</label>
                <input className="tmE-input" value={doc.contact} onChange={(e) => patch({ contact: e.target.value })} />
              </div>
            </section>
          )}

          {section === "summary" && (
            <section className="tmE-panel tmF-anim">
              <h2 className="tmE-panel-title">Summary</h2>
              <p className="tmE-panel-sub">
                Why it works: it leads with your seniority and scale, then the exact
                skills this posting screens for. It’s the first thing a recruiter reads.
              </p>
              <div className="tmE-field">
                <textarea className="tmE-textarea tmE-textarea--lg" value={doc.summary} onChange={(e) => patch({ summary: e.target.value })} />
              </div>
            </section>
          )}

          {section === "experience" && (
            <section className="tmE-panel tmF-anim">
              <h2 className="tmE-panel-title">Experience</h2>
              <p className="tmE-panel-sub">
                {bulletDiffs.length > 0
                  ? "Accept, reject, or edit each AI rewrite. Highlighted text shows posting keywords and metrics."
                  : "Edit any line. Highlighted text shows posting keywords and metrics."}
              </p>
              {doc.experience.map((e, ei) => (
                <div key={ei} className="tmE-entry">
                  <div className="tmE-row2">
                    <div className="tmE-field" style={{ marginBottom: 0 }}>
                      <label>Role</label>
                      <input className="tmE-input" value={e.role} onChange={(ev) => setEntry(ei, { role: ev.target.value })} />
                    </div>
                    <div className="tmE-field" style={{ marginBottom: 0 }}>
                      <label>Company</label>
                      <input className="tmE-input" value={e.company} onChange={(ev) => setEntry(ei, { company: ev.target.value })} />
                    </div>
                  </div>
                  <div className="tmE-field" style={{ marginTop: 12, marginBottom: 0 }}>
                    <label>Dates</label>
                    <DateRange value={e.dates} onChange={(v) => setEntry(ei, { dates: v })} />
                  </div>

                  <div className="tmE-bullets">
                    <label className="tmE-bullets-label">Bullets</label>
                    {e.bullets.map((b, bi) => {
                      const key = bulletKey(ei, bi);
                      const diff = diffs.get(key);
                      const decision = decisions[key];
                      if (!diff) {
                        return (
                          <div key={bi} className="tmE-bullet-row">
                            <textarea className="tmE-textarea" value={b} onChange={(ev) => setBulletText(ei, bi, ev.target.value)} />
                            <button type="button" className="tmE-icon-btn" aria-label="Remove bullet" onClick={() => removeBullet(ei, bi)}>
                              <Trash2 size={14} />
                            </button>
                          </div>
                        );
                      }
                      return (
                        <div key={bi} className={"tmE-diff" + (decision ? " is-decided" : " is-pending")}>
                          <div className="tmE-diff-line tmE-diff-before">
                            <span className="tmE-diff-tag">Original</span>
                            <span>{highlight(diff.before, keywords)}</span>
                          </div>
                          <div className="tmE-diff-line tmE-diff-after">
                            <span className="tmE-diff-tag is-after">AI rewrite</span>
                            <span>{highlight(diff.after, keywords)}</span>
                          </div>
                          {decision === "edited" && (
                            <textarea className="tmE-textarea" value={b} onChange={(ev) => setBulletText(ei, bi, ev.target.value)} placeholder="Your version…" />
                          )}
                          <div className="tmE-diff-actions">
                            <button type="button" className={"tmE-diff-btn" + (decision === "accepted" ? " is-on is-accept" : "")} onClick={() => decide(ei, bi, "accepted")}>
                              <Check size={13} /> Accept
                            </button>
                            <button type="button" className={"tmE-diff-btn" + (decision === "rejected" ? " is-on is-reject" : "")} onClick={() => decide(ei, bi, "rejected")}>
                              <X size={13} /> Reject
                            </button>
                            <button type="button" className={"tmE-diff-btn" + (decision === "edited" ? " is-on is-edit" : "")} onClick={() => decide(ei, bi, "edited")}>
                              <PenLine size={13} /> Edit
                            </button>
                            {!decision && <span className="tmE-diff-hint">choose one</span>}
                          </div>
                        </div>
                      );
                    })}
                    <button type="button" className="tmE-add" onClick={() => addBullet(ei)}>
                      <Plus size={14} /> Add bullet
                    </button>
                  </div>
                </div>
              ))}
            </section>
          )}

          {section === "skills" && (
            <section className="tmE-panel tmF-anim">
              <h2 className="tmE-panel-title">Skills</h2>
              <p className="tmE-panel-sub">One skill per line.</p>
              <div className="tmE-field">
                <textarea
                  className="tmE-textarea tmE-textarea--lg"
                  value={doc.skills.join("\n")}
                  onChange={(e) => patch({ skills: e.target.value.split("\n").map((s) => s.trim()).filter(Boolean) })}
                />
              </div>
            </section>
          )}

          {section === "fixes" && (
            <section className="tmE-panel tmF-anim">
              <h2 className="tmE-panel-title">Suggestions from your audit</h2>
              <p className="tmE-panel-sub">What the tailoring targeted. Use these as a checklist while you edit.</p>
              {(["high", "medium", "low"] as const).map((sev) => {
                const group = proofPoints.filter((p) => p.severity === sev);
                if (group.length === 0) return null;
                return (
                  <div key={sev} className="tmE-fix-group">
                    <p className="tmE-fix-head" style={{ color: SEV[sev].color }}>
                      {SEV[sev].label}
                      <span style={{ background: SEV[sev].bg, color: SEV[sev].color }}>{group.length}</span>
                    </p>
                    {group.map((p, i) => (
                      <div key={i} className="tmE-fix">
                        <b>{p.title}</b>
                        {p.summary && <p className="tmE-fix-sum">{p.summary}</p>}
                        {p.quote && <p className="tmE-fix-quote">“{p.quote}”</p>}
                        {p.fix && <p className="tmE-fix-fix"><span>Fix:</span> {p.fix}</p>}
                      </div>
                    ))}
                  </div>
                );
              })}
            </section>
          )}
        </div>

        {/* ---- wide résumé-only preview ---- */}
        <div className="tmE-preview">
          <div className="tmE-preview-head">
            <p className="tmE-preview-label">Live preview</p>
            {keywords.length > 0 && (
              <span className="tmE-preview-legend">
                <i className="tmE-lk" /> keywords
                <i className="tmE-lm" /> metrics
              </span>
            )}
          </div>
          {keywords.length > 0 && (
            <p className="tmE-preview-note">
              Highlights show the posting keywords and metrics your audit folded in.
            </p>
          )}
          <PrintDoc doc={doc} id={id} resumeOnly hideToolbar highlightKeywords={keywords} />
        </div>
      </div>
    </div>
  );
}
