"use client";

import { useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowLeft,
  Check,
  ChevronDown,
  Download,
  ListChecks,
  PenLine,
  Plus,
  RotateCcw,
  ShieldCheck,
  Target,
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
import { highlight, highlightHits } from "@/lib/highlight";
import { composeContact, parseContact, type ContactFields } from "@/lib/apply/contact";
import PrintDoc from "../print/print-doc";

type Section =
  | "header"
  | "summary"
  | "experience"
  | "projects"
  | "education"
  | "certifications"
  | "skills"
  | "fixes";

const SEV: Record<ProofPoint["severity"], { label: string; color: string; bg: string }> = {
  high: { label: "High priority", color: "#b3261e", bg: "#fdecea" },
  medium: { label: "Worth fixing", color: "#854f0b", bg: "#fdf3e7" },
  low: { label: "Minor polish", color: "var(--tm-zinc)", bg: "rgba(24,24,27,0.06)" },
};

// "Review my edits": AI checks the user's own changes against the AI original.
type Verdict = "good" | "weaker" | "issue";
type ReviewItem = {
  id: string;
  where: string;
  kind: "summary" | "bullet";
  original: string;
  edited: string;
  ei?: number;
  bi?: number;
  verdict: Verdict;
  note: string;
};
const VERDICT_LABEL: Record<Verdict, string> = {
  good: "Looks good",
  weaker: "Weaker than the AI version",
  issue: "Worth a look",
};

const SECTION_LABEL: Record<Section, string> = {
  header: "Header",
  summary: "Summary",
  experience: "Experience",
  projects: "Projects",
  education: "Education",
  certifications: "Certifications",
  skills: "Skills",
  fixes: "Feedback",
};

// Route a finding to the editor section the user edits to act on it, so each
// piece of feedback links straight to where the change is made.
function fixSection(p: ProofPoint): Section {
  const t = `${p.title} ${p.summary} ${p.quote ?? ""} ${p.fix}`.toLowerCase();
  if (/summary|objective|profile/.test(t)) return "summary";
  if (/certif|credential|license/.test(t)) return "certifications";
  if (/\bprojects?\b|portfolio/.test(t)) return "projects";
  if (/\bskills?\b|toolset|technolog/.test(t)) return "skills";
  if (/education|degree|\bgpa\b|coursework|university|college/.test(t)) return "education";
  if (/contact|email|phone|linkedin|headline|\bname\b|\btitle\b/.test(t)) return "header";
  return "experience"; // dates, bullets, metrics, scope, achievements, etc.
}

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
        <span className="tmE-input tmE-daterange-present">Present</span>
      ) : (
        <input
          type="month"
          className="tmE-input"
          value={end}
          aria-label="End month"
          onChange={(ev) => onChange(compose(start, ev.target.value, false))}
        />
      )}
      <button
        type="button"
        role="switch"
        aria-checked={present}
        className={"tmE-daterange-toggle" + (present ? " is-on" : "")}
        onClick={() => onChange(compose(start, end, !present))}
      >
        {present && <Check size={13} />} Present
      </button>
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
  proofPoints: initialProofPoints,
  company,
  role,
  kind = "application",
  onSave,
  pdfUrl,
  backHref = ROUTES.dashboard,
  backLabel = "Dashboard",
  onGetFeedback,
  onTargetJob,
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
  // Base-resume mode reuses this editor with no application row: a custom save
  // adapter, PDF url, and back link; application mode keeps today's defaults.
  kind?: "application" | "resume";
  onSave?: (payload: {
    doc: TailoredDoc;
    decisions: Record<string, EditDecision>;
    userEdited: boolean;
  }) => Promise<{ ok: boolean; error?: string }>;
  pdfUrl?: string;
  backHref?: string;
  backLabel?: string;
  // Base resume: fetch first-pass feedback on demand (returns proof points).
  onGetFeedback?: (doc: TailoredDoc) => Promise<ProofPoint[]>;
  // Base resume: send this resume into the job-targeting flow.
  onTargetJob?: (doc: TailoredDoc) => void;
}) {
  const [doc, setDoc] = useState<TailoredDoc>(initialDoc);
  const [decisions, setDecisions] = useState<Record<string, EditDecision>>(initialDecisions);
  const [section, setSection] = useState<Section>("header");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ text: string; err: boolean } | null>(null);
  const [dirty, setDirty] = useState(false);
  const [trustDismissed, setTrustDismissed] = useState(false);
  const [review, setReview] = useState<{ items: ReviewItem[] } | null>(null);
  const [reviewLoading, setReviewLoading] = useState(false);
  const [reviewError, setReviewError] = useState<string | null>(null);
  const [proofPoints, setProofPoints] = useState<ProofPoint[]>(initialProofPoints);
  const [feedbackLoading, setFeedbackLoading] = useState(false);
  const [feedbackError, setFeedbackError] = useState<string | null>(null);
  // Experience entries collapse to a one-line header; open entries that still
  // have AI rewrites to review so those aren't hidden.
  const [openEntries, setOpenEntries] = useState<Set<number>>(() => {
    const s = new Set<number>();
    bulletDiffs.forEach((d) => s.add(d.entry));
    return s;
  });
  function toggleEntry(i: number) {
    setOpenEntries((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });
  }
  const [contactFields, setContactFields] = useState<ContactFields>(() =>
    parseContact(initialDoc.contact),
  );
  function updateContact(part: Partial<ContactFields>) {
    const next = { ...contactFields, ...part };
    setContactFields(next);
    patch({ contact: composeContact(next) });
  }

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
  function setEdu(i: number, p: Partial<{ school: string; degree: string; dates: string }>) {
    setDoc((d) => ({
      ...d,
      education: (d.education ?? []).map((ed, j) => (j === i ? { ...ed, ...p } : ed)),
    }));
    touch();
  }
  function addEdu() {
    setDoc((d) => ({
      ...d,
      education: [...(d.education ?? []), { school: "", degree: "", dates: "" }],
    }));
    touch();
  }
  function removeEdu(i: number) {
    setDoc((d) => ({
      ...d,
      education: (d.education ?? []).filter((_, j) => j !== i),
    }));
    touch();
  }
  function setProject(i: number, p: Partial<{ name: string; description: string }>) {
    setDoc((d) => ({
      ...d,
      projects: (d.projects ?? []).map((pr, j) => (j === i ? { ...pr, ...p } : pr)),
    }));
    touch();
  }
  function addProject() {
    setDoc((d) => ({ ...d, projects: [...(d.projects ?? []), { name: "", description: "" }] }));
    touch();
  }
  function removeProject(i: number) {
    setDoc((d) => ({ ...d, projects: (d.projects ?? []).filter((_, j) => j !== i) }));
    touch();
  }
  function setCert(i: number, p: Partial<{ name: string; issuer: string; date: string }>) {
    setDoc((d) => ({
      ...d,
      certifications: (d.certifications ?? []).map((c, j) => (j === i ? { ...c, ...p } : c)),
    }));
    touch();
  }
  function addCert() {
    setDoc((d) => ({
      ...d,
      certifications: [...(d.certifications ?? []), { name: "", issuer: "", date: "" }],
    }));
    touch();
  }
  function removeCert(i: number) {
    setDoc((d) => ({ ...d, certifications: (d.certifications ?? []).filter((_, j) => j !== i) }));
    touch();
  }
  // Collect the lines the user changed from the AI's original tailored doc.
  function collectChanges(): ReviewItem[] {
    if (!originalDoc) return [];
    const out: ReviewItem[] = [];
    if (doc.summary.trim() && doc.summary.trim() !== originalDoc.summary.trim()) {
      out.push({
        id: "summary",
        where: "Summary",
        kind: "summary",
        original: originalDoc.summary,
        edited: doc.summary,
        verdict: "good",
        note: "",
      });
    }
    doc.experience.forEach((e, ei) => {
      const oe = originalDoc.experience[ei];
      if (!oe) return;
      e.bullets.forEach((b, bi) => {
        const ob = oe.bullets[bi];
        if (ob != null && b.trim() && b.trim() !== ob.trim()) {
          out.push({
            id: `b:${ei}:${bi}`,
            where: `${e.role || oe.role || "Experience"} · bullet ${bi + 1}`,
            kind: "bullet",
            original: ob,
            edited: b,
            ei,
            bi,
            verdict: "good",
            note: "",
          });
        }
      });
    });
    return out;
  }
  async function reviewMyChanges() {
    if (!originalDoc) return;
    const changes = collectChanges();
    setReviewError(null);
    setReview({ items: changes }); // open the panel (loading state shows next)
    if (!changes.length) return;
    setReviewLoading(true);
    try {
      const res = await fetch("/api/review-edits", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          role,
          keywords,
          changes: changes.map((c) => ({
            id: c.id,
            kind: c.kind,
            original: c.original,
            edited: c.edited,
          })),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "failed");
      const reviews: { id: string; verdict: Verdict; note: string }[] = Array.isArray(
        data.reviews,
      )
        ? data.reviews
        : [];
      const byId = new Map(reviews.map((r) => [r.id, r] as const));
      setReview({
        items: changes.map((c) => {
          const r = byId.get(c.id);
          return { ...c, verdict: r?.verdict ?? "good", note: r?.note ?? "" };
        }),
      });
    } catch (e) {
      const m = e instanceof Error ? e.message : "";
      setReviewError(m && m !== "failed" ? m : "Could not review your edits. Try again.");
    } finally {
      setReviewLoading(false);
    }
  }
  function revertChange(it: ReviewItem) {
    if (it.kind === "summary") patch({ summary: it.original });
    else if (it.ei != null && it.bi != null) setBulletText(it.ei, it.bi, it.original);
    setReview((r) => (r ? { items: r.items.filter((x) => x.id !== it.id) } : r));
  }
  async function getFeedback() {
    if (!onGetFeedback || feedbackLoading) return;
    const hasContent =
      doc.summary.trim().length > 0 ||
      doc.experience.some((e) => e.bullets.some((b) => b.trim()));
    if (!hasContent) {
      setFeedbackError("Add a summary or an experience bullet before running feedback.");
      return;
    }
    setFeedbackError(null);
    setFeedbackLoading(true);
    try {
      const pts = await onGetFeedback(doc);
      setProofPoints(pts);
      if (!pts.length) setFeedbackError("Looks solid — no major issues found.");
    } catch {
      setFeedbackError("Couldn't get feedback. Try again.");
    } finally {
      setFeedbackLoading(false);
    }
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
    setContactFields(parseContact(originalDoc.contact));
    setDecisions({});
    touch();
  }

  async function save() {
    if (saving) return;
    setSaving(true);
    setMsg(null);
    try {
      let ok = false;
      let error: string | undefined;
      if (onSave) {
        const r = await onSave({ doc, decisions, userEdited: true });
        ok = r.ok;
        error = r.error;
      } else {
        const res = await fetch(`/api/applications/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ doc, decisions, userEdited: true }),
        });
        const data = await res.json();
        ok = res.ok && data.ok;
        error = data.error;
      }
      if (ok) {
        setMsg({ text: "Saved", err: false });
        setDirty(false);
      } else {
        setMsg({ text: error || "Couldn’t save your edits.", err: true });
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
    { key: "projects", label: "Projects" },
    { key: "education", label: "Education" },
    { key: "certifications", label: "Certifications" },
    { key: "skills", label: "Skills" },
    ...(proofPoints.length || onGetFeedback
      ? [
          {
            key: "fixes" as Section,
            label: onGetFeedback ? "Feedback" : "Suggestions",
            badge: proofPoints.length || undefined,
          },
        ]
      : []),
  ];

  // Only advertise the highlight legend for colors actually on screen. Match the
  // text the preview actually tints (summary + bullets via highlight()); skills,
  // header, and education are rendered without highlighting, so they don't count.
  const previewText = [doc.summary, ...doc.experience.flatMap((e) => e.bullets)].join("  ");
  const previewHits = highlightHits(previewText, keywords);

  return (
    <div className="tmE-wrap">
      <div className="tmE-head">
        <Link className="tmE-back" href={backHref}>
          <ArrowLeft size={15} /> {backLabel}
        </Link>
        <h1>
          {role}
          {company && <span className="tmE-head-co"> at {company}</span>}
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
          {modified && originalDoc && (
            <button
              type="button"
              className="tm-btn tm-btn--outline tm-btn--sm"
              onClick={() => void reviewMyChanges()}
              disabled={reviewLoading}
              title="Have the AI check the changes you made against its tailored version."
            >
              <ListChecks size={13} /> {reviewLoading ? "Reviewing…" : "Review my edits"}
            </button>
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
          {onTargetJob && (
            <button
              type="button"
              className="tm-btn tm-btn--primary tm-btn--sm"
              onClick={() => onTargetJob(doc)}
            >
              <Target size={14} /> Target a job
            </button>
          )}
          <a className="tm-btn tm-btn--outline tm-btn--sm" href={pdfUrl ?? pdfHref(id)} target="_blank" rel="noopener noreferrer">
            <Download size={14} /> PDF
          </a>
          <button
            type="button"
            className={"tm-btn tm-btn--sm " + (onTargetJob ? "tm-btn--outline" : "tm-btn--primary")}
            onClick={() => void save()}
            disabled={saving || !dirty}
          >
            {saving ? "Saving…" : dirty ? (kind === "resume" ? "Save resume" : "Save edits") : "Saved"}
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
          {review && (
            <div className="tmE-review tmF-anim">
              <div className="tmE-review-head">
                <b>
                  {reviewLoading
                    ? "Reviewing your edits…"
                    : review.items.length
                      ? `AI reviewed your ${review.items.length} edit${review.items.length > 1 ? "s" : ""}`
                      : "Nothing changed yet"}
                </b>
                <button
                  type="button"
                  className="tmE-review-x"
                  aria-label="Close"
                  onClick={() => setReview(null)}
                >
                  <X size={14} />
                </button>
              </div>
              {reviewError && <p className="tmE-review-status is-err">{reviewError}</p>}
              {!reviewLoading && !reviewError && review.items.length === 0 && (
                <p className="tmE-review-status">
                  Edit a line, then run this and the AI will check your changes against its version.
                </p>
              )}
              {!reviewLoading &&
                review.items.map((it) => (
                  <div key={it.id} className={"tmE-review-item is-" + it.verdict}>
                    <div className="tmE-review-top">
                      <span className="tmE-review-where">{it.where}</span>
                      <span className={"tmE-review-verdict is-" + it.verdict}>
                        {it.verdict === "good" ? <Check size={12} /> : <AlertTriangle size={12} />}
                        {VERDICT_LABEL[it.verdict]}
                      </span>
                    </div>
                    {it.note && <p className="tmE-review-note">{it.note}</p>}
                    {it.verdict !== "good" && it.original && (
                      <button
                        type="button"
                        className="tmE-review-revert"
                        onClick={() => revertChange(it)}
                      >
                        <RotateCcw size={12} /> Revert to the AI version
                      </button>
                    )}
                  </div>
                ))}
            </div>
          )}
          {showVerified && (
            <div className="tmE-trust is-ok">
              <span className="tmE-trust-ic">
                <ShieldCheck size={15} />
              </span>
              <div>
                <b>Verified against your resume</b>
                <span>Every line traces back to your original. Nothing invented.</span>
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

          {section === "header" && (
            <section className="tmE-panel tmF-anim">
              <h2 className="tmE-panel-title">Header</h2>
              <p className="tmE-panel-sub">Your name, target headline, and contact details.</p>
              <div className="tmE-field">
                <label>Name</label>
                <input className="tmE-input" value={doc.name} onChange={(e) => patch({ name: e.target.value })} />
              </div>
              <div className="tmE-field">
                <label>Headline</label>
                <input className="tmE-input" value={doc.headline} onChange={(e) => patch({ headline: e.target.value })} />
              </div>
              <label className="tmE-field-grouplabel">Contact</label>
              <div className="tmE-contact-grid">
                <div className="tmE-field" style={{ marginBottom: 0 }}>
                  <label>Phone</label>
                  <input className="tmE-input" value={contactFields.phone} placeholder="612-227-1149" onChange={(e) => updateContact({ phone: e.target.value })} />
                </div>
                <div className="tmE-field" style={{ marginBottom: 0 }}>
                  <label>Email</label>
                  <input className="tmE-input" type="email" value={contactFields.email} placeholder="you@email.com" onChange={(e) => updateContact({ email: e.target.value })} />
                </div>
                <div className="tmE-field" style={{ marginBottom: 0 }}>
                  <label>City / State</label>
                  <input className="tmE-input" value={contactFields.location} placeholder="Portland, OR" onChange={(e) => updateContact({ location: e.target.value })} />
                </div>
                <div className="tmE-field" style={{ marginBottom: 0 }}>
                  <label>LinkedIn URL</label>
                  <input className="tmE-input" type="url" value={contactFields.linkedin} placeholder="linkedin.com/in/you" onChange={(e) => updateContact({ linkedin: e.target.value })} />
                </div>
              </div>
              {contactFields.linkedin && (
                <p className="tmE-hint">
                  Your LinkedIn shows as a clickable link in the PDF.
                </p>
              )}
            </section>
          )}

          {section === "summary" && (
            <section className="tmE-panel tmF-anim">
              <h2 className="tmE-panel-title">Summary</h2>
              <p className="tmE-panel-sub">The first thing a recruiter reads. Keep it tight and aimed at this role.</p>
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
              {doc.experience.map((e, ei) => {
                const open = openEntries.has(ei);
                const meta = [e.company, e.dates].filter(Boolean).join(" · ");
                return (
                <div key={ei} className={"tmE-entry" + (open ? " is-open" : "")}>
                  <button
                    type="button"
                    className="tmE-entry-head"
                    aria-expanded={open}
                    onClick={() => toggleEntry(ei)}
                  >
                    <span className="tmE-entry-headtext">
                      <span className="tmE-entry-role">{e.role || "Untitled role"}</span>
                      <span className="tmE-entry-meta">{meta || "No company or dates yet"}</span>
                    </span>
                    <span className="tmE-entry-count">
                      {e.bullets.length} bullet{e.bullets.length === 1 ? "" : "s"}
                    </span>
                    <span className="tmE-entry-chev" aria-hidden="true">
                      <ChevronDown size={16} />
                    </span>
                  </button>
                  <div className="tmE-entry-bodywrap">
                    <div className="tmE-entry-body">
                      <div className="tmE-entry-body-inner">
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
                    </div>
                  </div>
                </div>
                );
              })}
            </section>
          )}

          {section === "projects" && (
            <section className="tmE-panel tmF-anim">
              <h2 className="tmE-panel-title">Projects</h2>
              <p className="tmE-panel-sub">Side projects, portfolio, or open source — the name plus what you did and any result.</p>
              {(doc.projects ?? []).map((p, i) => (
                <div key={i} className="tmE-edu">
                  <div className="tmE-field">
                    <label>Project</label>
                    <input className="tmE-input" value={p.name} placeholder="Inventory dashboard" onChange={(e) => setProject(i, { name: e.target.value })} />
                  </div>
                  <div className="tmE-field" style={{ marginBottom: 0 }}>
                    <label>What you did</label>
                    <textarea className="tmE-textarea" value={p.description} placeholder="Built a React dashboard that cut stock-checks 30%." onChange={(e) => setProject(i, { description: e.target.value })} />
                  </div>
                  <button type="button" className="tmE-edu-remove" onClick={() => removeProject(i)}>
                    <Trash2 size={13} /> Remove
                  </button>
                </div>
              ))}
              {(doc.projects ?? []).length === 0 && (
                <p className="tmE-hint">No projects yet — great for students or career changers with a lighter work history.</p>
              )}
              <button type="button" className="tmE-add" onClick={addProject}>
                <Plus size={14} /> Add project
              </button>
            </section>
          )}

          {section === "certifications" && (
            <section className="tmE-panel tmF-anim">
              <h2 className="tmE-panel-title">Certifications</h2>
              <p className="tmE-panel-sub">Licenses and certifications — name, who issued it, and when.</p>
              {(doc.certifications ?? []).map((c, i) => (
                <div key={i} className="tmE-edu">
                  <div className="tmE-field">
                    <label>Certification</label>
                    <input className="tmE-input" value={c.name} placeholder="AWS Solutions Architect" onChange={(e) => setCert(i, { name: e.target.value })} />
                  </div>
                  <div className="tmE-row2">
                    <div className="tmE-field" style={{ marginBottom: 0 }}>
                      <label>Issuer</label>
                      <input className="tmE-input" value={c.issuer} placeholder="Amazon Web Services" onChange={(e) => setCert(i, { issuer: e.target.value })} />
                    </div>
                    <div className="tmE-field" style={{ marginBottom: 0 }}>
                      <label>Date</label>
                      <input className="tmE-input" value={c.date} placeholder="2024" onChange={(e) => setCert(i, { date: e.target.value })} />
                    </div>
                  </div>
                  <button type="button" className="tmE-edu-remove" onClick={() => removeCert(i)}>
                    <Trash2 size={13} /> Remove
                  </button>
                </div>
              ))}
              {(doc.certifications ?? []).length === 0 && (
                <p className="tmE-hint">No certifications yet.</p>
              )}
              <button type="button" className="tmE-add" onClick={addCert}>
                <Plus size={14} /> Add certification
              </button>
            </section>
          )}

          {section === "education" && (
            <section className="tmE-panel tmF-anim">
              <h2 className="tmE-panel-title">Education</h2>
              <p className="tmE-panel-sub">Degrees, schools, and dates. Add anything the tailoring missed.</p>
              {(doc.education ?? []).map((ed, i) => (
                <div key={i} className="tmE-edu">
                  <div className="tmE-field">
                    <label>Degree</label>
                    <input className="tmE-input" value={ed.degree} placeholder="BSc Computer Science" onChange={(e) => setEdu(i, { degree: e.target.value })} />
                  </div>
                  <div className="tmE-row2">
                    <div className="tmE-field" style={{ marginBottom: 0 }}>
                      <label>School</label>
                      <input className="tmE-input" value={ed.school} placeholder="University of Copenhagen" onChange={(e) => setEdu(i, { school: e.target.value })} />
                    </div>
                    <div className="tmE-field" style={{ marginBottom: 0 }}>
                      <label>Dates</label>
                      <input className="tmE-input" value={ed.dates} placeholder="2012 – 2016" onChange={(e) => setEdu(i, { dates: e.target.value })} />
                    </div>
                  </div>
                  <button type="button" className="tmE-edu-remove" onClick={() => removeEdu(i)}>
                    <Trash2 size={13} /> Remove
                  </button>
                </div>
              ))}
              {(doc.education ?? []).length === 0 && (
                <p className="tmE-hint">No education on file yet. Add a degree so it shows on your resume.</p>
              )}
              <button type="button" className="tmE-add" onClick={addEdu}>
                <Plus size={14} /> Add education
              </button>
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
              <div className="tmE-fix-top">
                <div>
                  <h2 className="tmE-panel-title">
                    {onGetFeedback ? "Resume feedback" : "Suggestions from your audit"}
                  </h2>
                  <p className="tmE-panel-sub">
                    {onGetFeedback
                      ? "A first-pass review of your content."
                      : "What the tailoring targeted. Use these as a checklist while you edit."}
                  </p>
                </div>
                {onGetFeedback && (
                  <button
                    type="button"
                    className="tm-btn tm-btn--outline tm-btn--sm"
                    onClick={() => void getFeedback()}
                    disabled={feedbackLoading}
                  >
                    <ListChecks size={13} />{" "}
                    {feedbackLoading
                      ? "Reviewing…"
                      : proofPoints.length
                        ? "Refresh feedback"
                        : "Get feedback"}
                  </button>
                )}
              </div>
              {feedbackError && <p className="tmE-fix-status">{feedbackError}</p>}
              {onGetFeedback && !proofPoints.length && !feedbackLoading && !feedbackError && (
                <p className="tmE-fix-status">
                  No feedback yet — add your experience and skills, then run a review.
                </p>
              )}
              {(["high", "medium", "low"] as const).map((sev) => {
                const group = proofPoints.filter((p) => p.severity === sev);
                if (group.length === 0) return null;
                return (
                  <div key={sev} className="tmE-fix-group">
                    <p className="tmE-fix-head" style={{ color: SEV[sev].color }}>
                      {SEV[sev].label}
                      <span style={{ background: SEV[sev].bg, color: SEV[sev].color }}>{group.length}</span>
                    </p>
                    {group.map((p, i) => {
                      const target = fixSection(p);
                      return (
                        <div key={i} className="tmE-fix">
                          <b>{p.title}</b>
                          {p.summary && <p className="tmE-fix-sum">{p.summary}</p>}
                          {p.quote && (
                            <p
                              className="tmE-fix-quote"
                              title={`From your ${SECTION_LABEL[target]} section`}
                            >
                              “{p.quote}”
                            </p>
                          )}
                          {p.fix && <p className="tmE-fix-fix"><span>Fix:</span> {p.fix}</p>}
                          <button
                            type="button"
                            className="tmE-fix-goto"
                            onClick={() => setSection(target)}
                          >
                            Edit {SECTION_LABEL[target]} →
                          </button>
                        </div>
                      );
                    })}
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
            {(previewHits.kw || previewHits.metric) && (
              <span className="tmE-preview-legend">
                {previewHits.kw && (
                  <>
                    <i className="tmE-lk" /> keywords
                  </>
                )}
                {previewHits.metric && (
                  <>
                    <i className="tmE-lm" /> metrics
                  </>
                )}
              </span>
            )}
          </div>
          {(previewHits.kw || previewHits.metric) && (
            <p className="tmE-preview-note">
              {previewHits.kw
                ? "Highlights mark the posting keywords and metrics your resume hits."
                : "Highlights mark the metrics in your resume."}
            </p>
          )}
          <PrintDoc doc={doc} id={id} resumeOnly hideToolbar highlightKeywords={keywords} />
        </div>
      </div>
    </div>
  );
}
