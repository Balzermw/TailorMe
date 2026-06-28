"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowLeft,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Download,
  Eye,
  EyeOff,
  Info,
  Layers,
  LayoutTemplate,
  Loader2,
  ListChecks,
  Mail,
  PenLine,
  Plus,
  RotateCcw,
  Target,
  Trash2,
  Ungroup,
  X,
} from "lucide-react";
import type {
  BulletDiff,
  EditDecision,
  FitBreakdown,
  FitHistoryEntry,
  ProofPoint,
  TailoredDoc,
} from "@/lib/types";
import { FitPanel } from "@/components/fit/fit-panel";
import { ensureInitialHistory } from "@/lib/apply/fit-history";
import { pdfHref } from "@/lib/apply/render";
import { RESUME_TEMPLATES, DEFAULT_TEMPLATE } from "@/lib/apply/templates";
import { feedbackHash } from "@/lib/apply/hash";
import { track, getSessionId } from "@/lib/track";
import { ROUTES } from "@/components/landing/data";
import { bulletKey, diffMap, wordDiff } from "@/lib/apply/redline";
import { highlightHits } from "@/lib/highlight";
import {
  composeContact,
  normalizeContactFields,
  normalizeContactLine,
  parseContact,
  type ContactFields,
} from "@/lib/apply/contact";
import { normalizeHeadline, stripTemplateGuidance } from "@/lib/apply/sanitize-doc";
import { type Section, SECTION_LABEL, fixSection } from "@/lib/apply/sections";
import { cleanResumeDate } from "@/lib/apply/dates";
import PrintDoc from "../print/print-doc";

const SEV: Record<ProofPoint["severity"], { label: string; color: string; bg: string }> = {
  high: { label: "High priority", color: "#b3261e", bg: "#fdecea" },
  medium: { label: "Worth fixing", color: "#854f0b", bg: "#fdf3e7" },
  low: { label: "Minor polish", color: "var(--tm-zinc)", bg: "rgba(24,24,27,0.06)" },
};

// A feedback finding is dropped once its quoted text no longer exists in the doc.
// This runs both at handoff (structuring may have already fixed it, e.g. a
// letter-spaced name normalized) AND live as the user edits — so applying a
// suggested change unmarks it. Deliberately lax: any edit to the quoted text
// clears the finding, so a good-faith fix won't re-trigger the same warning.
function docPlainText(doc: TailoredDoc): string {
  const parts: (string | undefined)[] = [doc.name, doc.headline, doc.contact, doc.summary];
  for (const e of doc.experience ?? []) parts.push(e.role, e.company, e.dates, ...(e.bullets ?? []));
  for (const ed of doc.education ?? []) parts.push(ed.degree, ed.school, ed.dates);
  for (const p of doc.projects ?? []) parts.push(p.name, p.description);
  for (const c of doc.certifications ?? []) parts.push(c.name, c.issuer, c.date);
  parts.push(...(doc.skills ?? []));
  for (const g of doc.skillGroups ?? []) parts.push(g.label, ...(g.skills ?? []));
  return parts.filter(Boolean).join("  ");
}
function normForMatch(s: string): string {
  // Lowercase, drop ellipsis (parse truncates long quotes with "…"), and flatten
  // all punctuation to spaces so formatting differences don't block a match.
  return (s || "")
    .toLowerCase()
    .replace(/…|\.\.\./g, " ")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
function pruneResolvedFindings(points: ProofPoint[], doc: TailoredDoc): ProofPoint[] {
  const hay = normForMatch(docPlainText(doc));
  return points.filter((p) => {
    if (!p.quote) return true; // "missing section" issues have no quote to verify
    let q = normForMatch(p.quote);
    // Drop a leading section-header word (e.g. "Skills") that isn't in the body.
    const sp = q.indexOf(" ");
    if (sp > 0) q = q.slice(sp + 1);
    if (q.length < 12) return true; // too little to judge — keep
    // Keep only while the quoted text is still present; once it's edited away the
    // finding is considered resolved and disappears from the panel.
    return hay.includes(q);
  });
}

function parseSkillInput(value: string): string[] {
  return value
    .split(/\n|,/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function skillSignature(skills: string[] | undefined): string {
  return Array.from(
    new Set(
      (skills ?? [])
        .map((s) => s.replace(/\s+/g, " ").trim().toLowerCase())
        .filter(Boolean),
    ),
  )
    .sort()
    .join("|");
}

function skillContentSignature(doc: TailoredDoc): string {
  const grouped = (doc.skillGroups ?? []).flatMap((g) => g.skills ?? []);
  return skillSignature(grouped.length ? grouped : doc.skills);
}

// Without a targeted posting there are no role keywords, so derive the ATS terms
// from the résumé's own skills/tools — split skill lines into individual terms so
// "Python, SQL, Kubernetes" each tint green where they appear in the bullets.
function skillKeywords(doc: TailoredDoc): string[] {
  const raw = [
    ...(doc.skills ?? []),
    ...((doc.skillGroups ?? []).flatMap((g) => g.skills ?? [])),
  ];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const s of raw) {
    for (const piece of (s || "").split(/[,;|:•/]|\band\b|&/i)) {
      const t = piece.trim().replace(/^[-–—\s]+/, "");
      if (t.length < 2 || t.length > 28) continue;
      if (t.split(/\s+/).length > 4) continue; // a long phrase, not a keyword
      const k = t.toLowerCase();
      if (seen.has(k)) continue;
      seen.add(k);
      out.push(t);
      if (out.length >= 40) return out;
    }
  }
  return out;
}

// Indeterminate progress bar shown while an AI review is running (we can't know
// the real duration, so a moving segment reads as "working" without faking %).
function ReviewProgress() {
  return (
    <div
      aria-hidden="true"
      style={{
        position: "relative",
        height: "3px",
        borderRadius: "2px",
        overflow: "hidden",
        background: "var(--tm-blue-50)",
        marginTop: "10px",
      }}
    >
      <style>{`@keyframes tmEbar{0%{left:-40%}100%{left:100%}}`}</style>
      <span
        style={{
          position: "absolute",
          top: 0,
          bottom: 0,
          width: "40%",
          borderRadius: "2px",
          background: "var(--tm-blue-600)",
          animation: "tmEbar 1.1s ease-in-out infinite",
        }}
      />
    </div>
  );
}

// "Review my edits": AI checks the user's own changes against the AI original.
type Verdict = "improved" | "okay" | "risky";
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
type GroupSkillsResponse = {
  skillGroups?: { label: string; skills: string[] }[];
  demo?: boolean;
  fallback?: boolean;
  warning?: string;
  error?: string;
};
type EditableSection = Exclude<Section, "fixes">;

// Top-level editor tabs (resume.co-style): Edit the content, pick a Design, or
// review Feedback. The preview stays mounted across all three.
type EditorMode = "edit" | "design" | "feedback";
type ManualSuggestionForm = {
  section: EditableSection;
  title: string;
  fix: string;
};
const VERDICT_LABEL: Record<Verdict, string> = {
  improved: "Improved",
  okay: "Okay",
  risky: "Risky",
};
const REMOVE_CARD_MS = 240;
type RemoveCardKind = "project" | "certification" | "education" | "skillGroup";

const EDITABLE_SECTIONS: EditableSection[] = [
  "header",
  "summary",
  "experience",
  "projects",
  "education",
  "certifications",
  "skills",
];

function suggestionId(p: ProofPoint): string {
  return [p.ruleId || "feedback", p.title, p.quote ?? "", p.fix].join("|");
}

function manualSection(p: ProofPoint): EditableSection | null {
  const raw = p.ruleId?.match(/^manual:(header|summary|experience|projects|education|certifications|skills):/)?.[1];
  return raw && EDITABLE_SECTIONS.includes(raw as EditableSection)
    ? (raw as EditableSection)
    : null;
}

function suggestionTarget(p: ProofPoint): EditableSection {
  const manual = manualSection(p);
  const target = manual ?? fixSection(p);
  return target === "fixes" ? "experience" : target;
}

function stripBulletPrefix(value: string): string {
  return value.replace(/^[\s•*\-–—]+/, "").trim();
}

function extractQuotedReplacement(fix: string): string | null {
  const patterns = [
    /\bto\s+["'“”‘’]([^"'“”‘’]+)["'“”‘’]/i,
    /\bwith\s+["'“”‘’]([^"'“”‘’]+)["'“”‘’]/i,
    /\bas\s+["'“”‘’]([^"'“”‘’]+)["'“”‘’]/i,
  ];
  for (const pattern of patterns) {
    const match = fix.match(pattern)?.[1]?.trim();
    if (match && match.length > 4) return stripBulletPrefix(match);
  }
  return null;
}

function draftFromFinding(p: ProofPoint, target: EditableSection): string {
  const replacement = extractQuotedReplacement(p.fix);
  if (replacement) return replacement;
  const quote = stripBulletPrefix(p.quote ?? "");
  const fix = p.fix.trim();

  if (target === "experience" && quote) {
    if (/\b(metric|quantif|number|%,|\$|scope|volume|saved|reduced|increased)\b/i.test(fix)) {
      return `${quote} by [add truthful metric, scope, or result].`;
    }
    if (/\b(action verb|achievement|accomplishment|outcome)\b/i.test(fix)) {
      return `[Rewrite with a stronger action verb and outcome] ${quote}`;
    }
    return quote;
  }

  if (target === "summary" && quote) return quote;
  if (target === "header" && replacement) return replacement;
  if (target === "projects") return "Project name: [Name]\nResult: [Tool, audience, and measurable result]";
  if (target === "education") return "[Degree or credential], [School], [Dates]";
  if (target === "certifications") return "[Certification], [Issuer], [Year]";
  if (target === "skills") return fix.replace(/^add\s+/i, "").replace(/\.$/, "");
  return fix;
}

function findQuotedBullet(doc: TailoredDoc, quote: string | undefined): { ei: number; bi: number } | null {
  const q = normForMatch(quote ?? "");
  if (q.length < 8) return null;
  for (let ei = 0; ei < doc.experience.length; ei += 1) {
    const entry = doc.experience[ei];
    for (let bi = 0; bi < entry.bullets.length; bi += 1) {
      const bullet = normForMatch(entry.bullets[bi]);
      if (bullet.includes(q) || q.includes(bullet)) return { ei, bi };
    }
  }
  return null;
}

function normalizeReviewVerdict(value: unknown): Verdict {
  if (value === "improved" || value === "good") return "improved";
  if (value === "risky" || value === "issue") return "risky";
  return "okay";
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
  const cleanValue = cleanResumeDate(value);
  const toMonth = (s: string): string => {
    const yr = /(?:19|20)\d{2}/.exec(s)?.[0];
    if (!yr) return "";
    const mi = MONTHS.findIndex((m) => new RegExp(`\\b${m}`, "i").test(s));
    return `${yr}-${String(mi >= 0 ? mi + 1 : 1).padStart(2, "0")}`;
  };
  const parts = cleanValue
    .split(/\s*(?:–|—|-|\bto\b)\s*/i)
    .map((s) => s.trim())
    .filter(Boolean);
  const endRaw = parts[1] ?? "";
  const present =
    /present|current|now|ongoing/i.test(endRaw) ||
    (parts.length < 2 && /present|current/i.test(cleanValue));
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
      <div className="tmE-daterange-row">
        <input
          type="month"
          className="tmE-input"
          value={start}
          aria-label="Start month"
          onChange={(ev) => onChange(compose(ev.target.value, end, present))}
        />
        <span className="tmE-daterange-sep">to</span>
        {/* Both end states share the .tmE-input width so toggling never reflows the row. */}
        {present ? (
          <span className="tmE-input tmE-daterange-present" aria-label="End date: Present">
            <Check size={13} /> Present
          </span>
        ) : (
          <input
            type="month"
            className="tmE-input"
            value={end}
            aria-label="End month"
            onChange={(ev) => onChange(compose(start, ev.target.value, false))}
          />
        )}
      </div>
      {/* The toggle lives on its own row below, so it never moves as the end field
          swaps — a plain checkbox, not a position-shifting inline switch. */}
      <label className="tmE-daterange-check">
        <input
          type="checkbox"
          checked={present}
          onChange={(ev) => onChange(compose(start, end, ev.target.checked))}
        />
        <span>This is my current role (Present)</span>
      </label>
    </div>
  );
}

function cloneDoc(doc: TailoredDoc): TailoredDoc {
  return JSON.parse(JSON.stringify(doc)) as TailoredDoc;
}

// Fixed on-screen width of the live-preview "paper" (px). The preview is scaled
// to fit the panel from this width, so wrapping + pagination stay window-stable.
const PREVIEW_DOC_WIDTH = 760;

function normalizeEditorDoc(doc: TailoredDoc, targetRole: string): TailoredDoc {
  const contact = normalizeContactLine(doc.contact);
  const headline = normalizeHeadline(doc.headline, targetRole);
  // Drop leftover résumé-template guidance (e.g. "Add a concise 1-2 sentence
  // professional summary…") that an imported PDF can carry into the summary.
  const summary = stripTemplateGuidance(doc.summary);
  return contact === doc.contact && headline === doc.headline && summary === doc.summary
    ? doc
    : { ...doc, contact, headline, summary };
}

export default function EditEditor({
  id,
  doc: initialDoc,
  originalDoc,
  bulletDiffs,
  initialDecisions,
  keywords,
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
  initialFit = null,
  initialHistory,
  canRecheck = false,
  onRecheck,
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
  // Fit re-check loop (application mode). initialFit/History seed the panel;
  // canRecheck gates the action (a posting must exist); onRecheck is the
  // demo-mode persister (real mode posts to the recheck API by default).
  initialFit?: FitBreakdown | null;
  initialHistory?: FitHistoryEntry[];
  canRecheck?: boolean;
  onRecheck?: (doc: TailoredDoc) => Promise<{
    ok: boolean;
    fit?: FitBreakdown;
    history?: FitHistoryEntry[];
    error?: string;
  }>;
}) {
  const normalizedInitialDoc = normalizeEditorDoc(initialDoc, role);
  const initialDocNormalized =
    normalizedInitialDoc.contact !== initialDoc.contact ||
    normalizedInitialDoc.headline !== initialDoc.headline;
  const [doc, setDoc] = useState<TailoredDoc>(normalizedInitialDoc);
  const [decisions, setDecisions] = useState<Record<string, EditDecision>>(initialDecisions);
  // Fit re-check loop state (application mode). History is seeded from the saved
  // timeline, backfilled to a one-point initial if the record predates it.
  const [fit, setFit] = useState<FitBreakdown | null>(initialFit);
  const [fitHistory, setFitHistory] = useState<FitHistoryEntry[]>(() =>
    initialFit
      ? ensureInitialHistory({ fit: initialFit, fitHistory: initialHistory }, new Date().toISOString())
      : [],
  );
  const [rechecking, setRechecking] = useState(false);
  // Deep link: the dashboard "View feedback" link lands here as
  // /resume/edit#feedback — open the Feedback section directly, not the header.
  const [section, setSection] = useState<Section>("header");
  // Feedback used to be a left-nav item; it's now its own tab/mode, still
  // deep-linkable via /resume/edit#feedback (e.g. the dashboard "View feedback").
  const [mode, setMode] = useState<EditorMode>(() =>
    typeof window !== "undefined" && window.location.hash === "#feedback" ? "feedback" : "edit",
  );
  const [saving, setSaving] = useState(false);
  const [coverOpen, setCoverOpen] = useState(false);
  const [coverEditing, setCoverEditing] = useState(false);
  const [msg, setMsg] = useState<{ text: string; err: boolean } | null>(null);
  const [dirty, setDirty] = useState(initialDocNormalized);
  const [review, setReview] = useState<{ items: ReviewItem[] } | null>(null);
  const [reviewLoading, setReviewLoading] = useState(false);
  const [reviewError, setReviewError] = useState<string | null>(null);
  const [grouping, setGrouping] = useState(false);
  const [groupMsg, setGroupMsg] = useState<string | null>(null);
  const [lastGroupedSkillSignature, setLastGroupedSkillSignature] = useState<string | null>(() =>
    normalizedInitialDoc.skillGroups?.length ? skillContentSignature(normalizedInitialDoc) : null,
  );
  const [proofPoints, setProofPoints] = useState<ProofPoint[]>(initialProofPoints);
  const [manualProofPoints, setManualProofPoints] = useState<ProofPoint[]>([]);
  const [appliedSuggestionIds, setAppliedSuggestionIds] = useState<Set<string>>(() => new Set());
  const [suggestionDrafts, setSuggestionDrafts] = useState<Record<string, string>>({});
  // Suggestions whose draft is currently being generated by the AI rewrite call.
  const [rewritingIds, setRewritingIds] = useState<Set<string>>(() => new Set());
  const [manualSuggestionOpen, setManualSuggestionOpen] = useState(false);
  const [manualSuggestion, setManualSuggestion] = useState<ManualSuggestionForm>({
    section: "experience",
    title: "",
    fix: "",
  });
  // What the panel actually shows: findings whose quoted text still exists in the
  // doc. Derived (not stored) so it updates live as the user edits — applying a
  // suggested change drops its finding, and structuring-fixed ones never surface.
  const allProofPoints = useMemo(
    () => [...proofPoints, ...manualProofPoints],
    [manualProofPoints, proofPoints],
  );
  const shownPoints = useMemo(
    () =>
      pruneResolvedFindings(allProofPoints, doc).filter(
        (p) => !appliedSuggestionIds.has(suggestionId(p)),
      ),
    [allProofPoints, appliedSuggestionIds, doc],
  );
  const [feedbackLoading, setFeedbackLoading] = useState(false);
  const [feedbackError, setFeedbackError] = useState<string | null>(null);
  const [removingCards, setRemovingCards] = useState<Set<string>>(() => new Set());
  const removingCardsRef = useRef<Set<string>>(new Set());
  const removeTimers = useRef<ReturnType<typeof setTimeout>[]>([]);
  // Hash of the résumé when feedback was last fetched — lets us show "up to date"
  // and skip a redundant (token-spending) re-review when nothing changed.
  const [lastFeedbackHash, setLastFeedbackHash] = useState<string | null>(null);
  // The live-preview container — feedback findings spotlight their line in it on hover.
  const previewRef = useRef<HTMLDivElement>(null);
  // When a hovered finding's line is off the visible preview, point an arrow at it
  // (up/down) instead of auto-scrolling the page out from under the user.
  const [hlDir, setHlDir] = useState<"up" | "down" | null>(null);
  // Approximate US Letter page boundaries in the live preview, so the user can see
  // where the résumé spills onto page 2+ (the downloaded PDF is the exact split).
  const docWrapRef = useRef<HTMLDivElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  // Page navigator: the preview paginates into real US-Letter sheets — content is
  // padded so a block never crosses a page edge — and shows ONE sheet at a time,
  // flipped with the pager. pageCount = number of sheets; sheetPx = one sheet's
  // unscaled (pre-zoom) height.
  const [pageCount, setPageCount] = useState(1);
  const [sheetPx, setSheetPx] = useState<number | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  // "You are here": a small avatar in the preview, level with the section being
  // edited. Null = hidden (off the current page, or not in Edit mode).
  const [cursorTop, setCursorTop] = useState<number | null>(null);
  // The preview renders at a fixed document width and is scaled to fit the panel,
  // so the page layout (and therefore the page breaks) never change with the
  // window — only the on-screen zoom does. The PDF is the exact split.
  const [docScale, setDocScale] = useState(1);
  const [docHeight, setDocHeight] = useState<number | null>(null);
  // Keyword/metric highlights are a review overlay, not document content. The
  // toggle lets the user drop to the clean resume so it's clear the tags are
  // never baked into the resume or PDF.
  const [showMatches, setShowMatches] = useState(true);
  useEffect(
    () => () => {
      removeTimers.current.forEach(clearTimeout);
      removeTimers.current = [];
    },
    [],
  );
  useEffect(() => {
    const scaler = docWrapRef.current;
    const viewport = viewportRef.current;
    const page = scaler?.querySelector(".print-page") as HTMLElement | null;
    if (!scaler || !viewport || !page) return;
    const measure = () => {
      // Fit the fixed-width document to the panel (zoom-to-fit-width), capped.
      const scale = Math.min(1.5, viewport.clientWidth / PREVIEW_DOC_WIDTH);
      setDocScale((prev) => (Math.abs(prev - scale) > 0.001 ? scale : prev));
      // One US-Letter sheet at the document's true (pre-zoom) width.
      const sheet = (page.offsetWidth * 11) / 8.5;
      // Clear our sheet-fill (and any stale per-block padding from older builds) so
      // we measure the TRUE content height, then split it into whole sheets. We
      // slice on the sheet edge — padding every block down to avoid splits left the
      // pages looking half-empty and inflated the page count.
      page.style.minHeight = "";
      page
        .querySelectorAll<HTMLElement>(".mcv-head, .mcv-body > *")
        .forEach((el) => {
          el.style.marginTop = "";
        });
      const contentH = page.offsetHeight;
      const pages = Math.max(1, Math.ceil((contentH - 8) / sheet));
      page.style.minHeight = `${Math.round(pages * sheet)}px`; // fill out whole sheets
      setSheetPx((prev) => (prev != null && Math.abs(prev - sheet) < 1 ? prev : Math.round(sheet)));
      setPageCount(pages);
      setDocHeight(Math.round(page.offsetHeight * scale));
    };
    measure();
    // One more pass after fonts/async settle (block heights can shift).
    const t = window.setTimeout(measure, 250);
    // Observe width only — observing `page` would loop on our own padding writes.
    const ro = new ResizeObserver(measure);
    ro.observe(viewport);
    return () => {
      window.clearTimeout(t);
      ro.disconnect();
    };
  }, [doc]);
  // Page navigator: one sheet shown at a time. We translate the scaler up by whole
  // sheets (pre-scale coords, applied before the zoom), so each page shows only
  // its own content. Clamp the page when pagination changes (an edit can add or
  // remove a page).
  const totalPages = pageCount;
  const paged = pageCount > 1 && sheetPx != null;
  const pageHeightScaled = sheetPx != null ? Math.round(sheetPx * docScale) : null;
  // Clamp at render so a pagination change (an edit added/removed a page) can't
  // strand the indicator past the last page — no effect/setState needed.
  const safePage = Math.min(Math.max(1, currentPage), totalPages);
  const pageTranslate = paged && safePage > 1 ? (safePage - 1) * (sheetPx ?? 0) : 0;
  const goToPage = (p: number) => setCurrentPage(Math.min(Math.max(1, p), totalPages));
  // Experience entries collapse to a one-line header; open entries that still
  // have AI rewrites to review so those aren't hidden.
  const [openEntries, setOpenEntries] = useState<Set<number>>(() => {
    const s = new Set<number>();
    bulletDiffs.forEach((d) => s.add(d.entry));
    return s;
  });
  // "You are here" avatar: map the active edit section to a preview anchor
  // (data-field on PrintDoc), then track that block's on-screen position.
  const editingAnchor =
    mode !== "edit"
      ? null
      : section === "header"
        ? "header"
        : section === "summary"
          ? "summary"
          : section === "experience"
            ? `exp-${openEntries.size ? Math.min(...openEntries) : 0}`
            : section === "projects"
              ? "proj-0"
              : section === "education"
                ? "edu-0"
                : section === "certifications"
                  ? "cert-0"
                  : section === "skills"
                    ? "skills"
                    : null;
  const avatarInitials =
    (doc.name || "You")
      .split(/\s+/)
      .map((w) => w[0] ?? "")
      .join("")
      .toUpperCase()
      .slice(0, 2) || "Y";
  const prevAnchorRef = useRef<string | null>(null);
  useEffect(() => {
    const compute = () => {
      const vp = viewportRef.current;
      const scaler = docWrapRef.current;
      const el = editingAnchor ? scaler?.querySelector(`[data-field="${editingAnchor}"]`) : null;
      if (!vp || !scaler || !el) {
        setCursorTop(null);
        return;
      }
      const vr = vp.getBoundingClientRect();
      const sr = scaler.getBoundingClientRect();
      const er = (el as HTMLElement).getBoundingClientRect();
      // When the SECTION changes (not on manual paging), flip the pager to the
      // page holding it so the avatar is on-screen. (er.top - sr.top) is
      // translate-invariant, so divide by the scale for the unscaled offset.
      const anchorChanged = prevAnchorRef.current !== editingAnchor;
      prevAnchorRef.current = editingAnchor;
      if (anchorChanged && pageCount > 1 && sheetPx && docScale > 0) {
        const unscaledTop = (er.top - sr.top) / docScale;
        const targetPage = Math.min(pageCount, Math.floor(unscaledTop / sheetPx) + 1);
        if (targetPage !== currentPage) {
          setCurrentPage(targetPage);
          return; // reposition on the re-run after the flip
        }
      }
      const top = er.top - vr.top;
      // Only show it when the anchored block is on the visible page.
      setCursorTop(top >= -10 && top <= vr.height - 10 ? Math.max(2, top) : null);
    };
    // rAF + a post-transition pass; never set state synchronously in the effect.
    const raf = requestAnimationFrame(compute);
    const t = setTimeout(compute, 350); // settle after a page-flip transition
    window.addEventListener("resize", compute);
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(t);
      window.removeEventListener("resize", compute);
    };
  }, [editingAnchor, currentPage, docScale, sheetPx, pageCount, doc, openEntries]);
  function toggleEntry(i: number) {
    setOpenEntries((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });
  }
  const [contactFields, setContactFields] = useState<ContactFields>(() =>
    parseContact(normalizedInitialDoc.contact),
  );
  function updateContact(part: Partial<ContactFields>) {
    const next = normalizeContactFields({ ...contactFields, ...part });
    setContactFields(next);
    patch({ contact: composeContact(next) });
  }

  const diffs = diffMap(bulletDiffs);
  const totalPending = bulletDiffs.filter((d) => !decisions[bulletKey(d.entry, d.bullet)]).length;

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
  function removeCardKey(kind: RemoveCardKind, i: number) {
    return `${kind}:${i}`;
  }
  function removeCardClass(key: string) {
    return "tmE-edu" + (removingCards.has(key) ? " is-removing" : "");
  }
  function removeAfterAnimation(
    kind: RemoveCardKind,
    i: number,
    remove: () => void,
    trigger?: HTMLElement | null,
  ) {
    const key = removeCardKey(kind, i);
    if (removingCardsRef.current.has(key)) return;
    const prefersReducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (prefersReducedMotion) {
      remove();
      return;
    }
    const card = trigger?.closest<HTMLElement>(".tmE-edu");
    if (card) {
      card.style.setProperty("--tmE-remove-height", `${Math.ceil(card.getBoundingClientRect().height)}px`);
      // Force the measured height to commit before React adds the removing class.
      void card.offsetHeight;
    }
    removingCardsRef.current.add(key);
    setRemovingCards(new Set(removingCardsRef.current));
    const timer = setTimeout(() => {
      remove();
      removingCardsRef.current.delete(key);
      setRemovingCards(new Set(removingCardsRef.current));
    }, REMOVE_CARD_MS);
    removeTimers.current.push(timer);
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
  // ----- skill groups (categorized skills) -----
  // Edits to groups keep the flat `skills` in sync (= flattened, deduped) so the
  // serialize/score/ATS paths that read the flat list stay correct.
  function mutateGroups(
    fn: (groups: { label: string; skills: string[] }[]) => { label: string; skills: string[] }[],
  ) {
    setDoc((d) => {
      const groups = fn(d.skillGroups ?? []);
      const flat = Array.from(
        new Set(groups.flatMap((g) => g.skills).map((s) => s.trim()).filter(Boolean)),
      );
      return { ...d, skillGroups: groups, skills: flat.length ? flat : d.skills };
    });
    touch();
  }
  function setGroupLabel(i: number, label: string) {
    mutateGroups((gs) => gs.map((g, j) => (j === i ? { ...g, label } : g)));
  }
  function setGroupSkills(i: number, text: string) {
    mutateGroups((gs) =>
      gs.map((g, j) => (j === i ? { ...g, skills: text.split("\n").map((s) => s.trim()) } : g)),
    );
  }
  function addGroup() {
    mutateGroups((gs) => [...gs, { label: "", skills: [] }]);
  }
  function removeGroup(i: number) {
    mutateGroups((gs) => gs.filter((_, j) => j !== i));
  }
  function ungroupSkills() {
    setDoc((d) => ({ ...d, skillGroups: undefined }));
    setLastGroupedSkillSignature(null);
    touch();
  }

  // Current text of the section a finding targets, for rewrite context. Prefer the
  // finding's own quote; otherwise hand the model the relevant section content.
  function sectionContextText(target: EditableSection, p: ProofPoint): string {
    if (p.quote?.trim()) return p.quote.trim();
    if (target === "summary") return doc.summary ?? "";
    if (target === "skills")
      return doc.skillGroups?.length
        ? doc.skillGroups.map((g) => `${g.label}: ${g.skills.join(", ")}`).join("\n")
        : (doc.skills ?? []).join(", ");
    if (target === "header") return doc.contact ?? "";
    if (target === "experience")
      return doc.experience
        .map((e) => `${e.role} — ${e.company}\n${e.bullets.join("\n")}`)
        .join("\n\n")
        .slice(0, 2000);
    return "";
  }

  // Open a suggestion's draft. Show the template instantly, then ask the AI to
  // turn it into an actual ready-to-paste rewrite (replacing the placeholder only
  // if the user hasn't started editing). Demo/no-LLM keeps the template.
  function openSuggestionDraft(p: ProofPoint, target: EditableSection) {
    const id = suggestionId(p);
    if (suggestionDrafts[id] != null) return; // already open
    const fallback = draftFromFinding(p, target);
    setSuggestionDrafts((drafts) => (drafts[id] != null ? drafts : { ...drafts, [id]: fallback }));
    setRewritingIds((s) => new Set(s).add(id));
    void (async () => {
      try {
        const res = await fetch("/api/resume/rewrite", {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-tm-session": getSessionId() ?? "" },
          body: JSON.stringify({
            section: target,
            issue: `${p.title}. ${p.summary ?? ""}`.trim(),
            advice: p.fix ?? "",
            original: sectionContextText(target, p),
          }),
        });
        const data = await res.json().catch(() => ({}));
        if (res.ok && typeof data.rewrite === "string" && data.rewrite.trim()) {
          setSuggestionDrafts((drafts) =>
            drafts[id] === fallback ? { ...drafts, [id]: data.rewrite.trim() } : drafts,
          );
        }
      } catch {
        /* keep the template fallback */
      } finally {
        setRewritingIds((s) => {
          const n = new Set(s);
          n.delete(id);
          return n;
        });
      }
    })();
  }

  function updateSuggestionDraft(id: string, text: string) {
    setSuggestionDrafts((drafts) => ({ ...drafts, [id]: text }));
  }

  function closeSuggestionDraft(id: string) {
    setSuggestionDrafts((drafts) => {
      const next = { ...drafts };
      delete next[id];
      return next;
    });
  }

  function markSuggestionApplied(id: string) {
    setAppliedSuggestionIds((ids) => {
      const next = new Set(ids);
      next.add(id);
      return next;
    });
    closeSuggestionDraft(id);
  }

  function applySuggestionDraft(p: ProofPoint, target: EditableSection, draft: string) {
    const text = draft.trim();
    if (!text) return;
    const id = suggestionId(p);
    if (target === "experience") {
      const hit = findQuotedBullet(doc, p.quote);
      setDoc((d) => {
        if (hit && d.experience[hit.ei]?.bullets[hit.bi] != null) {
          return {
            ...d,
            experience: d.experience.map((entry, ei) =>
              ei === hit.ei
                ? {
                    ...entry,
                    bullets: entry.bullets.map((bullet, bi) => (bi === hit.bi ? text : bullet)),
                  }
                : entry,
            ),
          };
        }
        if (d.experience.length) {
          return {
            ...d,
            experience: d.experience.map((entry, ei) =>
              ei === 0 ? { ...entry, bullets: [...entry.bullets, text] } : entry,
            ),
          };
        }
        return {
          ...d,
          experience: [
            {
              role: d.headline || "Role",
              company: "",
              dates: "",
              bullets: [text],
            },
          ],
        };
      });
      setOpenEntries((open) => {
        const next = new Set(open);
        next.add(hit?.ei ?? 0);
        return next;
      });
    } else if (target === "summary") {
      setDoc((d) => {
        const quote = p.quote?.trim();
        if (quote && d.summary.includes(quote)) {
          return { ...d, summary: d.summary.replace(quote, text) };
        }
        return { ...d, summary: d.summary.trim() ? `${d.summary.trim()}\n\n${text}` : text };
      });
    } else if (target === "header") {
      setDoc((d) => ({ ...d, headline: normalizeHeadline(text.split(/\r?\n/)[0], role) || d.headline }));
    } else if (target === "skills") {
      const skills = parseSkillInput(text);
      setDoc((d) => {
        const merged = Array.from(new Set([...(d.skills ?? []), ...skills].map((s) => s.trim()).filter(Boolean)));
        if (d.skillGroups?.length) {
          return {
            ...d,
            skills: merged,
            skillGroups: [
              ...d.skillGroups,
              { label: "Suggested additions", skills: skills.length ? skills : [text] },
            ],
          };
        }
        return { ...d, skills: merged.length ? merged : [...(d.skills ?? []), text] };
      });
    } else if (target === "projects") {
      const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
      const name = (lines[0] ?? "Suggested project").replace(/^project name:\s*/i, "");
      const description = (lines.slice(1).join(" ") || lines[0] || text).replace(/^result:\s*/i, "");
      setDoc((d) => ({
        ...d,
        projects: [...(d.projects ?? []), { name, description }],
      }));
    } else if (target === "education") {
      const [degree = text, school = "", dates = ""] = text.split(/,\s*/);
      setDoc((d) => ({
        ...d,
        education: [...(d.education ?? []), { degree, school, dates }],
      }));
    } else if (target === "certifications") {
      const [name = text, issuer = "", date = ""] = text.split(/,\s*/);
      setDoc((d) => ({
        ...d,
        certifications: [...(d.certifications ?? []), { name, issuer, date }],
      }));
    }
    track("resume_feedback_suggestion_applied", {
      rule_id: p.ruleId,
      category: p.category,
      severity: p.severity,
      section: target,
    });
    setMode("edit");
    setSection(target);
    markSuggestionApplied(id);
    touch();
  }

  function addManualSuggestion() {
    const fix = manualSuggestion.fix.trim();
    if (!fix) return;
    const sectionKey = manualSuggestion.section;
    const title =
      manualSuggestion.title.trim() || `${SECTION_LABEL[sectionKey]} suggestion`;
    const p: ProofPoint = {
      title,
      summary: `User-added suggestion for ${SECTION_LABEL[sectionKey].toLowerCase()}.`,
      why: "Added manually while reviewing this resume.",
      fix,
      severity: "medium",
      category: "manual",
      ruleId: `manual:${sectionKey}:${Date.now()}`,
    };
    setManualProofPoints((points) => [p, ...points]);
    setManualSuggestion({ section: sectionKey, title: "", fix: "" });
    setManualSuggestionOpen(false);
  }

  async function groupWithAI() {
    if (grouping) return;
    if (doc.skillGroups?.length && !skillsChangedSinceGrouping) {
      setGroupMsg("Add or change skills before re-grouping with AI.");
      return;
    }
    setGrouping(true);
    setGroupMsg(null);
    try {
      const res = await fetch("/api/resume/group-skills", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-tm-session": getSessionId() ?? "" },
        body: JSON.stringify({ skills: doc.skills }),
      });
      const data = (await res.json().catch(() => ({}))) as GroupSkillsResponse;
      if (!res.ok) throw new Error(data.error || "failed");
      const groups: { label: string; skills: string[] }[] = Array.isArray(data.skillGroups)
        ? data.skillGroups
        : [];
      if (!groups.length) {
        setGroupMsg(data.error || "Couldn't group these skills. Try editing them first.");
      } else {
        mutateGroups(() => groups);
        setLastGroupedSkillSignature(skillSignature(groups.flatMap((g) => g.skills ?? [])));
        setGroupMsg(
          data.fallback
            ? data.warning || "AI grouping had trouble, so these were grouped locally instead."
            : "Grouped into categories. Review the labels before saving.",
        );
      }
    } catch (e) {
      const message = e instanceof Error ? e.message : "";
      setGroupMsg(message && message !== "failed" ? message : "Couldn't group your skills. Try again.");
    } finally {
      setGrouping(false);
    }
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
        verdict: "okay",
        note: "",
      });
    }
    doc.experience.forEach((e, ei) => {
      const oe = originalDoc.experience[ei];
      if (!oe) return;
      e.bullets.forEach((b, bi) => {
        const ob = oe.bullets[bi];
        const decision = decisions[bulletKey(ei, bi)];
        if (decision === "accepted" || decision === "rejected") return;
        if (ob != null && b.trim() && b.trim() !== ob.trim()) {
          out.push({
            id: `b:${ei}:${bi}`,
            where: `${e.role || oe.role || "Experience"} · bullet ${bi + 1}`,
            kind: "bullet",
            original: ob,
            edited: b,
            ei,
            bi,
            verdict: "okay",
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
          return { ...c, verdict: normalizeReviewVerdict(r?.verdict), note: r?.note ?? "" };
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
    // Don't spend tokens re-reviewing an unchanged résumé.
    if (proofPoints.length > 0 && lastFeedbackHash === feedbackHash(doc)) {
      track("feedback_click", { result: "up_to_date" });
      setFeedbackError("Your feedback is up to date. Edit your résumé to refresh it.");
      return;
    }
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
      setLastFeedbackHash(feedbackHash(doc));
      track("feedback_click", { result: "ran", findings: pts.length });
      if (!pts.length) setFeedbackError("Looks solid. No major issues found.");
    } catch (e) {
      const message = e instanceof Error ? e.message : "";
      setFeedbackError(message && message !== "failed" ? message : "Couldn't get feedback. Try again.");
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
    const normalizedOriginalDoc = normalizeEditorDoc(originalDoc, role);
    setDoc(cloneDoc(normalizedOriginalDoc));
    setContactFields(parseContact(normalizedOriginalDoc.contact));
    setDecisions({});
    setReview(null);
    setReviewError(null);
    setFeedbackError(null);
    setLastFeedbackHash(null);
    touch();
  }

  async function save(override?: TailoredDoc) {
    if (saving) return;
    const docToSave = normalizeEditorDoc(override ?? doc, role);
    setSaving(true);
    setMsg(null);
    try {
      let ok = false;
      let error: string | undefined;
      if (onSave) {
        const r = await onSave({ doc: docToSave, decisions, userEdited: true });
        ok = r.ok;
        error = r.error;
      } else {
        const res = await fetch(`/api/applications/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ doc: docToSave, decisions, userEdited: true }),
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

  // Re-check fit: re-score the CURRENT edited draft against the same posting and
  // append the result to the timeline. Demo mode uses the loader's onRecheck
  // (deterministic simulation); real mode posts to the recheck API, which scores
  // and persists. A successful re-check also saves the scored draft.
  async function runRecheck() {
    if (rechecking) return;
    // The score should only move when the resume actually changed. Re-checking an
    // unchanged draft would re-score identical content (and, in demo mode, would
    // otherwise keep nudging the simulated score up).
    if (!dirty) {
      setMsg({
        text: "No changes since your last check. Edit a line, then re-check.",
        err: false,
      });
      return;
    }
    setRechecking(true);
    setMsg(null);
    try {
      const docToScore = normalizeEditorDoc(doc, role);
      if (onRecheck) {
        const r = await onRecheck(docToScore);
        if (r.ok && r.fit && r.history) {
          setFit(r.fit);
          setFitHistory(r.history);
          setDirty(false);
        } else {
          setMsg({ text: r.error || "Couldn’t re-check fit.", err: true });
        }
        return;
      }
      const res = await fetch(`/api/applications/${id}/recheck`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ doc: docToScore }),
      });
      const data = await res.json();
      if (res.ok && data.ok && data.fit && data.history) {
        setFit(data.fit);
        setFitHistory(data.history);
        setDirty(false);
        setMsg({ text: "Fit re-checked", err: false });
      } else {
        setMsg({
          text: data.error || "Couldn’t re-check fit.",
          err: true,
        });
      }
    } catch {
      setMsg({ text: "Couldn’t re-check fit.", err: true });
    } finally {
      setRechecking(false);
    }
  }

  // Pick a résumé template. Free (a recompile, never an AI call). Persist
  // immediately with the explicit doc so the PDF/download reflects it at once.
  function chooseTemplate(id: string) {
    if ((doc.template ?? DEFAULT_TEMPLATE) === id) return;
    track("template_select", { template: id, kind: kind ?? "application" });
    const next = { ...doc, template: id };
    setDoc(next);
    touch();
    void save(next);
  }

  const NAV: { key: Section; label: string; badge?: number }[] = [
    { key: "header", label: "Header" },
    { key: "summary", label: "Summary" },
    { key: "experience", label: "Experience", badge: totalPending || undefined },
    { key: "projects", label: "Projects" },
    { key: "education", label: "Education" },
    { key: "certifications", label: "Certifications" },
    { key: "skills", label: "Skills" },
  ];
  // Feedback is a top-level tab now (not a nav row); its label/badge live there.
  const feedbackLabel = onGetFeedback ? "Feedback" : "Suggestions";
  const showFeedbackTab = shownPoints.length > 0 || Boolean(onGetFeedback);

  // Keywords to tint green in the preview: the posting's role keywords when this
  // résumé is targeted at a job, else the résumé's own skills/tools (the terms an
  // ATS scans for) so a base résumé still shows its ATS keywords highlighted.
  const previewKeywords = keywords.length > 0 ? keywords : skillKeywords(doc);
  // Only advertise the highlight legend for colors actually on screen. Match the
  // text the preview actually tints (summary + bullets via highlight()); skills,
  // header, and education are rendered without highlighting, so they don't count.
  const previewText = [doc.summary, ...doc.experience.flatMap((e) => e.bullets)].join("  ");
  const previewHits = highlightHits(previewText, previewKeywords);
  // True when the saved feedback already matches the current résumé (no re-run needed).
  const feedbackUpToDate = proofPoints.length > 0 && lastFeedbackHash === feedbackHash(doc);
  const currentSkillSignature = useMemo(() => skillContentSignature(doc), [doc]);
  const hasGroupedSkills = Boolean(doc.skillGroups?.length);
  const skillsChangedSinceGrouping =
    hasGroupedSkills && lastGroupedSkillSignature !== null && currentSkillSignature !== lastGroupedSkillSignature;

  // Spotlight the line a feedback finding references in the live preview. Match
  // the finding's verbatim quote to a rendered element (bullet, skill, role,
  // summary, contact); fall back to the relevant section heading.
  function clearHighlight() {
    previewRef.current
      ?.querySelectorAll(".mcv-hl")
      .forEach((e) => e.classList.remove("mcv-hl"));
    setHlDir(null);
  }
  function highlightFinding(quote: string | undefined, section: Section) {
    const root = previewRef.current;
    if (!root) return;
    clearHighlight();
    const norm = (s: string) =>
      (s || "")
        .toLowerCase()
        .replace(/[“”"’']/g, "")
        .replace(/^[\s•\-–—]+/, "")
        .replace(/^skills:\s*/, "")
        .replace(/\s+/g, " ")
        .trim();
    const q = norm(quote || "");
    let el: Element | null = null;
    if (q.length >= 4) {
      const sel =
        ".mcv-entry li, .mcv-skills li, .mcv-skillgroup, .mcv-entry-role, .mcv-entry-company, .mcv-summary, .mcv-para, .mcv-contact";
      for (const c of Array.from(root.querySelectorAll(sel))) {
        const t = norm(c.textContent || "");
        if (t.length < 3) continue;
        if (t.includes(q) || (t.length > 6 && q.includes(t))) {
          el = c;
          break;
        }
      }
    }
    if (!el) {
      if (section === "header") {
        el = root.querySelector(".mcv-head");
      } else {
        const label = (SECTION_LABEL[section] || "").toLowerCase();
        el =
          Array.from(root.querySelectorAll(".mcv-sec")).find(
            (h) => (h.textContent || "").trim().toLowerCase() === label,
          ) || null;
      }
    }
    if (el) {
      el.classList.add("mcv-hl");
      // Don't scroll the page (the preview is sticky, so scrollIntoView would
      // yank the whole window). Instead, if the line sits above/below the visible
      // viewport, surface a directional arrow so the user can choose to look.
      const r = el.getBoundingClientRect();
      const vh = window.innerHeight || document.documentElement.clientHeight;
      setHlDir(r.bottom < 72 ? "up" : r.top > vh - 40 ? "down" : null);
    } else {
      setHlDir(null);
    }
  }

  const reviewableChangeCount = collectChanges().length;
  const wideEditMode =
    mode !== "edit" || // Design + Feedback want the wider working layout
    section === "experience" ||
    section === "projects" ||
    section === "education" ||
    section === "certifications" ||
    section === "skills";

  return (
    <div className={"tmE-wrap" + (wideEditMode ? " is-workmode" : "")}>
      <div className="tmE-head">
        <Link className="tmE-back" href={backHref}>
          <ArrowLeft size={15} /> {backLabel}
        </Link>
        <h1>
          {kind === "resume" ? doc.headline?.trim() || "Base resume" : role}
          {company && <span className="tmE-head-co"> at {company}</span>}
        </h1>
        <div className="tmE-head-right">
          {/* Review-progress cluster: how much of the AI changes you've reviewed. */}
          {bulletDiffs.length > 0 && (
            <div className="tmE-status">
              {bulletDiffs.length > 0 && (
                <span
                  className={"tmE-reviewprog" + (totalPending === 0 ? " is-done" : "")}
                  data-testid="revision-reviewed-count"
                  title={`${bulletDiffs.length - totalPending} of ${bulletDiffs.length} AI changes reviewed`}
                >
                  {totalPending === 0 ? <Check size={13} /> : <ListChecks size={13} />}
                  <span className="tmE-reviewprog-dots" aria-hidden="true">
                    {bulletDiffs.map((d, i) => (
                      <i
                        key={bulletKey(d.entry, d.bullet)}
                        className={i < bulletDiffs.length - totalPending ? "is-done" : ""}
                      />
                    ))}
                  </span>
                  {/* Kept for screen readers (and the visible string the e2e suite asserts). */}
                  <span className="tmE-sr">
                    {bulletDiffs.length - totalPending}/{bulletDiffs.length} changes reviewed
                  </span>
                </span>
              )}
            </div>
          )}
          {msg?.err && <span className="tmE-save-status is-err">{msg.text}</span>}
          {reviewableChangeCount > 0 && originalDoc && (
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
              onClick={() => {
                track("target_job_click");
                onTargetJob(doc);
              }}
            >
              <Target size={14} /> Target a job
            </button>
          )}
          {(doc.coverLetter ?? "").trim() && (
            <button
              type="button"
              className="tm-btn tm-btn--outline tm-btn--sm"
              onClick={() => setCoverOpen(true)}
              title="Review the cover letter generated for this role."
            >
              <Mail size={14} /> Cover letter
            </button>
          )}
          <a
            className="tm-btn tm-btn--outline tm-btn--sm"
            href={pdfUrl ?? pdfHref(id)}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => track("pdf_click", { template: doc.template ?? DEFAULT_TEMPLATE })}
          >
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

      <div className="tmE-modetabs" role="tablist" aria-label="Editor mode">
        <button
          type="button"
          role="tab"
          aria-selected={mode === "edit"}
          className={"tmE-modetab" + (mode === "edit" ? " is-active" : "")}
          onClick={() => setMode("edit")}
        >
          <PenLine size={14} /> Edit
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mode === "design"}
          className={"tmE-modetab" + (mode === "design" ? " is-active" : "")}
          onClick={() => setMode("design")}
        >
          <LayoutTemplate size={14} /> Design
        </button>
        {showFeedbackTab && (
          <button
            type="button"
            role="tab"
            aria-selected={mode === "feedback"}
            className={"tmE-modetab" + (mode === "feedback" ? " is-active" : "")}
            onClick={() => setMode("feedback")}
          >
            <ListChecks size={14} /> {feedbackLabel}
            {shownPoints.length > 0 && (
              <span className="tmE-modetab-badge">{shownPoints.length}</span>
            )}
          </button>
        )}
      </div>

      <div className={"tmE-grid3" + (mode !== "edit" ? " is-flat" : "")}>
        {/* ---- section nav (Edit mode only) ---- */}
        {mode === "edit" && (
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
        )}

        {/* ---- one section at a time ---- */}
        <div className="tmE-main">
          {kind === "application" && fit && (
            <div className="tmF-anim" style={{ marginBottom: "14px" }}>
              <FitPanel
                fit={fit}
                history={fitHistory}
                onRecheck={canRecheck ? runRecheck : undefined}
                rechecking={rechecking}
                pendingChanges={dirty}
              />
            </div>
          )}
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
              {reviewLoading && <ReviewProgress />}
              {reviewError && <p className="tmE-review-status is-err">{reviewError}</p>}
              {!reviewLoading && !reviewError && review.items.length === 0 && (
                <p className="tmE-review-status">
                  Edit a line, then run this and the AI will check your changes against its version.
                </p>
              )}
              {!reviewLoading &&
                review.items.map((it) => (
                  <div
                    key={it.id}
                    className={"tmE-review-item is-" + it.verdict}
                    data-testid="review-item"
                    data-review-id={it.id}
                  >
                    <div className="tmE-review-top">
                      <span className="tmE-review-where">{it.where}</span>
                      <span className={"tmE-review-verdict is-" + it.verdict}>
                        {it.verdict === "improved" ? <Check size={12} /> : <AlertTriangle size={12} />}
                        {VERDICT_LABEL[it.verdict]}
                      </span>
                    </div>
                    {it.note && <p className="tmE-review-note">{it.note}</p>}
                    {it.verdict !== "improved" && it.original && (
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
          {mode === "edit" && (
            <>
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
                  ? "Accept, reject, or edit each AI rewrite. Struck-through words were removed; green words were added."
                  : "Edit any line. Highlighted text in the preview shows posting keywords and metrics."}
              </p>
              {doc.experience.map((e, ei) => {
                const open = openEntries.has(ei);
                const meta = [e.company, cleanResumeDate(e.dates)].filter(Boolean).join(" · ");
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
                  <div className="tmE-entry-fields">
                    <div className="tmE-field">
                      <label>Role</label>
                      <input className="tmE-input" value={e.role} onChange={(ev) => setEntry(ei, { role: ev.target.value })} />
                    </div>
                    <div className="tmE-field">
                      <label>Company</label>
                      <input className="tmE-input" value={e.company} onChange={(ev) => setEntry(ei, { company: ev.target.value })} />
                    </div>
                    <div className="tmE-field tmE-field--dates">
                      <label>Dates</label>
                      <DateRange value={e.dates} onChange={(v) => setEntry(ei, { dates: v })} />
                    </div>
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
                        <div
                          key={bi}
                          className={"tmE-diff" + (decision ? " is-decided" : " is-pending")}
                          data-testid={`revision-diff-${ei}-${bi}`}
                        >
                          <p className="tmE-diff-redline" aria-label={`Suggested rewrite. Original: ${diff.before}. New: ${diff.after}`}>
                            {wordDiff(diff.before, diff.after).map((seg, si) =>
                              seg.type === "equal" ? (
                                <span key={si}>{seg.text}</span>
                              ) : seg.type === "removed" ? (
                                <del key={si} className="tmE-diff-del">{seg.text}</del>
                              ) : (
                                <ins key={si} className="tmE-diff-ins">{seg.text}</ins>
                              ),
                            )}
                          </p>
                          {decision === "edited" && (
                            <textarea
                              className="tmE-textarea"
                              value={b}
                              onChange={(ev) => setBulletText(ei, bi, ev.target.value)}
                              placeholder="Your version…"
                              aria-label={`Custom bullet ${bi + 1}`}
                              data-testid={`revision-custom-bullet-${ei}-${bi}`}
                            />
                          )}
                          <div className="tmE-diff-actions">
                            <button
                              type="button"
                              className={"tmE-diff-btn" + (decision === "accepted" ? " is-on is-accept" : "")}
                              onClick={() => decide(ei, bi, "accepted")}
                              aria-pressed={decision === "accepted"}
                              data-testid={`revision-accept-${ei}-${bi}`}
                            >
                              <Check size={13} /> Accept
                            </button>
                            <button
                              type="button"
                              className={"tmE-diff-btn" + (decision === "rejected" ? " is-on is-reject" : "")}
                              onClick={() => decide(ei, bi, "rejected")}
                              aria-pressed={decision === "rejected"}
                              data-testid={`revision-reject-${ei}-${bi}`}
                            >
                              <X size={13} /> Reject
                            </button>
                            <button
                              type="button"
                              className={"tmE-diff-btn" + (decision === "edited" ? " is-on is-edit" : "")}
                              onClick={() => decide(ei, bi, "edited")}
                              aria-pressed={decision === "edited"}
                              data-testid={`revision-edit-${ei}-${bi}`}
                            >
                              <PenLine size={13} /> Edit
                            </button>
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
              <p className="tmE-panel-sub">Side projects, portfolio, or open source: the name plus what you did and any result.</p>
              {(doc.projects ?? []).map((p, i) => {
                const key = removeCardKey("project", i);
                return (
                  <div key={i} className={removeCardClass(key)}>
                      <div className="tmE-field">
                        <label>Project</label>
                        <input className="tmE-input" value={p.name} placeholder="Inventory dashboard" onChange={(e) => setProject(i, { name: e.target.value })} />
                      </div>
                      <div className="tmE-field" style={{ marginBottom: 0 }}>
                        <label>What you did</label>
                        <textarea className="tmE-textarea" value={p.description} placeholder="Built a React dashboard that cut stock-checks 30%." onChange={(e) => setProject(i, { description: e.target.value })} />
                      </div>
                      <button
                        type="button"
                        className="tmE-edu-remove"
                        onClick={(ev) =>
                          removeAfterAnimation("project", i, () => removeProject(i), ev.currentTarget)
                        }
                        disabled={removingCards.has(key)}
                      >
                        <Trash2 size={13} /> Remove
                      </button>
                  </div>
                );
              })}
              {(doc.projects ?? []).length === 0 && (
                <p className="tmE-note">
                  <Info size={14} /> No projects yet. Great for students or career changers
                  with a lighter work history.
                </p>
              )}
              <button type="button" className="tmE-add" onClick={addProject}>
                <Plus size={14} /> Add project
              </button>
            </section>
          )}

          {section === "certifications" && (
            <section className="tmE-panel tmF-anim">
              <h2 className="tmE-panel-title">Certifications</h2>
              <p className="tmE-panel-sub">Licenses and certifications: name, who issued it, and when.</p>
              {(doc.certifications ?? []).map((c, i) => {
                const key = removeCardKey("certification", i);
                return (
                  <div key={i} className={removeCardClass(key)}>
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
                      <button
                        type="button"
                        className="tmE-edu-remove"
                        onClick={(ev) =>
                          removeAfterAnimation("certification", i, () => removeCert(i), ev.currentTarget)
                        }
                        disabled={removingCards.has(key)}
                      >
                        <Trash2 size={13} /> Remove
                      </button>
                  </div>
                );
              })}
              {(doc.certifications ?? []).length === 0 && (
                <p className="tmE-note">
                  <Info size={14} /> No certifications yet. Optional, but a relevant license or
                  credential can boost credibility.
                </p>
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
              {(doc.education ?? []).map((ed, i) => {
                const key = removeCardKey("education", i);
                return (
                  <div key={i} className={removeCardClass(key)}>
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
                      <label>
                        Dates
                        <span
                          className="tmE-tip"
                          title="Optional. Many people leave off the graduation year to avoid age bias."
                        >
                          <Info size={12} />
                        </span>
                      </label>
                      <input className="tmE-input" value={ed.dates} placeholder="2012 – 2016" onChange={(e) => setEdu(i, { dates: e.target.value })} />
                    </div>
                  </div>
                      <button
                        type="button"
                        className="tmE-edu-remove"
                        onClick={(ev) =>
                          removeAfterAnimation("education", i, () => removeEdu(i), ev.currentTarget)
                        }
                        disabled={removingCards.has(key)}
                      >
                        <Trash2 size={13} /> Remove
                      </button>
                  </div>
                );
              })}
              {(doc.education ?? []).length === 0 && (
                <p className="tmE-note">
                  <Info size={14} /> No education on file yet. Add a degree so it shows on your
                  resume.
                </p>
              )}
              <button type="button" className="tmE-add" onClick={addEdu}>
                <Plus size={14} /> Add education
              </button>
            </section>
          )}

          {section === "skills" && (
            <section className="tmE-panel tmF-anim">
              <h2 className="tmE-panel-title">Skills</h2>
              {doc.skillGroups?.length ? (
                <>
                  <p className="tmE-panel-sub">
                    Grouped into categories. Edit labels directly; add or change skills before re-grouping with AI.
                  </p>
                  {doc.skillGroups.map((g, i) => {
                    const key = removeCardKey("skillGroup", i);
                    return (
                      <div key={i} className={removeCardClass(key)}>
                          <div className="tmE-field">
                            <label>Category</label>
                            <input
                              className="tmE-input"
                              value={g.label}
                              placeholder="Cloud & DevOps"
                              onChange={(e) => setGroupLabel(i, e.target.value)}
                            />
                          </div>
                          <div className="tmE-field" style={{ marginBottom: 0 }}>
                            <label>Skills (one per line)</label>
                            <textarea
                              className="tmE-textarea"
                              value={g.skills.join("\n")}
                              onChange={(e) => setGroupSkills(i, e.target.value)}
                            />
                          </div>
                          <button
                            type="button"
                            className="tmE-edu-remove"
                            onClick={(ev) =>
                              removeAfterAnimation("skillGroup", i, () => removeGroup(i), ev.currentTarget)
                            }
                            disabled={removingCards.has(key)}
                          >
                            <Trash2 size={13} /> Remove
                          </button>
                      </div>
                    );
                  })}
                  <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                    <button type="button" className="tmE-add" onClick={addGroup}>
                      <Plus size={14} /> Add category
                    </button>
                    <button
                      type="button"
                      className="tmE-add"
                      onClick={groupWithAI}
                      disabled={grouping || !skillsChangedSinceGrouping}
                      title={!skillsChangedSinceGrouping ? "Add or change skills before re-grouping." : undefined}
                    >
                      {grouping ? <Loader2 className="tmE-spin" size={14} /> : <Layers size={14} />}{" "}
                      {grouping ? "Re-grouping..." : "Re-group with AI"}
                    </button>
                    <button type="button" className="tmE-add" onClick={ungroupSkills}>
                      <Ungroup size={14} /> Ungroup
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <p className="tmE-panel-sub">
                    One skill per line. Group them into labeled categories for a sharper,
                    professional layout.
                  </p>
                  <div className="tmE-field">
                    <textarea
                      className="tmE-textarea tmE-textarea--lg"
                      value={doc.skills.join("\n")}
                      onChange={(e) => patch({ skills: parseSkillInput(e.target.value) })}
                    />
                  </div>
                  <button
                    type="button"
                    className="tmE-add"
                    onClick={groupWithAI}
                    disabled={grouping || doc.skills.length < 4}
                  >
                    {grouping ? <Loader2 className="tmE-spin" size={14} /> : <Layers size={14} />}{" "}
                    {grouping ? "Grouping..." : "Group into categories with AI"}
                  </button>
                </>
              )}
              {groupMsg && (
                <p className="tmE-hint" style={{ color: "var(--tm-zinc)", marginTop: 8 }}>
                  {groupMsg}
                </p>
              )}
            </section>
          )}
            </>
          )}

          {mode === "design" && (
            <section className="tmE-panel tmF-anim tmE-design">
              <h2 className="tmE-panel-title">Design</h2>
              <p className="tmE-panel-sub">
                Pick a resume style. It sets the look of your downloaded PDF, and switching is
                always free.
              </p>
              <div className="tmE-design-grid">
                {RESUME_TEMPLATES.map((t) => {
                  const on = (doc.template ?? DEFAULT_TEMPLATE) === t.id;
                  return (
                    <button
                      key={t.id}
                      type="button"
                      className={"tmE-design-opt" + (on ? " is-on" : "")}
                      onClick={() => chooseTemplate(t.id)}
                      aria-pressed={on}
                    >
                      <span className="tmE-design-opt-top">
                        <span className="tmE-design-opt-name">
                          {t.name}
                          {on && <Check size={13} />}
                        </span>
                        <span className={"tmE-tplopt-ats tmE-ats-" + t.ats}>
                          {t.ats === "safe" ? "ATS-safe" : "ATS-friendly"}
                        </span>
                      </span>
                      <span className="tmE-design-opt-blurb">{t.blurb}</span>
                    </button>
                  );
                })}
              </div>
            </section>
          )}

          {mode === "feedback" && (
            <section className="tmE-panel tmF-anim">
              <div className="tmE-fix-top">
                <div>
                  <h2 className="tmE-panel-title">
                    {onGetFeedback ? "Resume feedback" : "Suggestions from your audit"}
                  </h2>
                  <p className="tmE-panel-sub">
                    {!onGetFeedback
                      ? "Open a card to jump to its section."
                      : feedbackLoading
                        ? "Reviewing your content…"
                        : shownPoints.length > 0
                          ? "Open a card to jump to its section."
                          : "Run a review to see suggestions here."}
                  </p>
                </div>
                <div className="tmE-fix-top-actions">
                  <button
                    type="button"
                    className="tm-btn tm-btn--outline tm-btn--sm"
                    onClick={() => setManualSuggestionOpen((open) => !open)}
                  >
                    <Plus size={13} /> Add suggestion
                  </button>
                {onGetFeedback && (
                  <button
                    type="button"
                    className="tm-btn tm-btn--outline tm-btn--sm"
                    onClick={() => void getFeedback()}
                    disabled={feedbackLoading || feedbackUpToDate}
                    title={feedbackUpToDate ? "Your résumé hasn't changed since the last review." : undefined}
                  >
                    {feedbackUpToDate ? <Check size={13} /> : <ListChecks size={13} />}{" "}
                    {feedbackLoading
                      ? "Reviewing…"
                      : !shownPoints.length
                        ? "Get feedback"
                        : feedbackUpToDate
                          ? "Up to date"
                          : "Refresh"}
                  </button>
                )}
                </div>
              </div>
              {feedbackLoading && <ReviewProgress />}
              {feedbackError && <p className="tmE-fix-status">{feedbackError}</p>}
              {manualSuggestionOpen && (
                <div className="tmE-manual-suggestion">
                  <div className="tmE-row2">
                    <div className="tmE-field" style={{ marginBottom: 0 }}>
                      <label>Section</label>
                      <select
                        className="tmE-input"
                        value={manualSuggestion.section}
                        onChange={(e) =>
                          setManualSuggestion((s) => ({
                            ...s,
                            section: e.target.value as EditableSection,
                          }))
                        }
                      >
                        {EDITABLE_SECTIONS.map((key) => (
                          <option key={key} value={key}>
                            {SECTION_LABEL[key]}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="tmE-field" style={{ marginBottom: 0 }}>
                      <label>Title</label>
                      <input
                        className="tmE-input"
                        value={manualSuggestion.title}
                        placeholder="Add stronger support metric"
                        onChange={(e) =>
                          setManualSuggestion((s) => ({ ...s, title: e.target.value }))
                        }
                      />
                    </div>
                  </div>
                  <div className="tmE-field" style={{ marginTop: 10, marginBottom: 0 }}>
                    <label>Suggestion</label>
                    <textarea
                      className="tmE-textarea"
                      value={manualSuggestion.fix}
                      placeholder="Managed 3 enterprise accounts and reduced response backlog 28%."
                      onChange={(e) =>
                        setManualSuggestion((s) => ({ ...s, fix: e.target.value }))
                      }
                    />
                  </div>
                  <div className="tmE-fix-card-actions">
                    <button
                      type="button"
                      className="tmE-fix-apply"
                      onClick={addManualSuggestion}
                      disabled={!manualSuggestion.fix.trim()}
                    >
                      <Plus size={13} /> Add card
                    </button>
                    <button
                      type="button"
                      className="tmE-fix-goto"
                      onClick={() => setManualSuggestionOpen(false)}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
              {(["high", "medium", "low"] as const).map((sev) => {
                const group = shownPoints.filter((p) => p.severity === sev);
                if (group.length === 0) return null;
                // Global running index so cards fade in one after another across all
                // three severity groups (not restarting the stagger per group).
                const offset =
                  sev === "high"
                    ? 0
                    : shownPoints.filter(
                        (p) =>
                          p.severity === "high" ||
                          (sev === "low" && p.severity === "medium"),
                      ).length;
                return (
                  <div key={sev} className="tmE-fix-group">
                    <p className="tmE-fix-head" style={{ color: SEV[sev].color }}>
                      {SEV[sev].label}
                      <span style={{ background: SEV[sev].bg, color: SEV[sev].color }}>{group.length}</span>
                    </p>
                    {group.map((p, i) => {
                      const target = suggestionTarget(p);
                      const id = suggestionId(p);
                      const draft = suggestionDrafts[id];
                      const rewriting = rewritingIds.has(id);
                      return (
                        <div
                          key={i}
                          className="tmE-fix tmE-fix--in"
                          style={{ animationDelay: `${Math.min((offset + i) * 70, 700)}ms` }}
                          data-testid="feedback-suggestion"
                          data-suggestion-title={p.title}
                          data-rule-id={p.ruleId ?? ""}
                          onMouseEnter={() => highlightFinding(p.quote, target)}
                          onMouseLeave={clearHighlight}
                        >
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
                          <div className="tmE-fix-card-actions">
                            <button
                              type="button"
                              className="tmE-fix-apply"
                              onClick={() => openSuggestionDraft(p, target)}
                            >
                              <PenLine size={13} /> {draft == null ? "Draft fix with AI" : "Edit draft"}
                            </button>
                            <button
                              type="button"
                              className="tmE-fix-goto"
                              onClick={() => {
                                // Per-suggestion telemetry — counts/ids/categories
                                // only, never résumé content. rule_id is present
                                // only for rules-engine findings; sanitizeProps
                                // drops it when undefined (legacy LLM points).
                                track("resume_feedback_suggestion_clicked", {
                                  rule_id: p.ruleId,
                                  category: p.category,
                                  severity: p.severity,
                                  section: target,
                                });
                                setMode("edit");
                                setSection(target);
                              }}
                            >
                              Edit {SECTION_LABEL[target]} →
                            </button>
                          </div>
                          {draft != null && (
                            <div className="tmE-suggestion-draft">
                              <label>Draft</label>
                              {rewriting ? (
                                <p className="tmE-draft-hint tmE-draft-hint--ai">
                                  <Loader2 size={12} className="tmE-draft-spin" /> Drafting a rewrite
                                  with AI…
                                </p>
                              ) : (
                                /\[[^\]]+\]/.test(draft) && (
                                  <p className="tmE-draft-hint">
                                    <span className="tmE-draft-token">[ ]</span>
                                    Replace anything in brackets with your own details before
                                    applying.
                                  </p>
                                )
                              )}
                              <textarea
                                className={
                                  "tmE-textarea" +
                                  (/\[[^\]]+\]/.test(draft) ? " tmE-textarea--hasplaceholder" : "")
                                }
                                value={draft}
                                onChange={(e) => updateSuggestionDraft(id, e.target.value)}
                              />
                              <div className="tmE-fix-card-actions">
                                <button
                                  type="button"
                                  className="tmE-fix-apply is-primary"
                                  onClick={() => applySuggestionDraft(p, target, draft)}
                                  disabled={!draft.trim() || rewriting}
                                >
                                  <Check size={13} /> Apply to {SECTION_LABEL[target]}
                                </button>
                                <button
                                  type="button"
                                  className="tmE-fix-goto"
                                  onClick={() => closeSuggestionDraft(id)}
                                >
                                  Cancel
                                </button>
                              </div>
                            </div>
                          )}
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
        <div className="tmE-preview" ref={previewRef} data-testid="resume-live-preview">
          {hlDir === "up" && (
            <div className="tmE-hl-arrow tmE-hl-arrow--up" aria-hidden="true">
              <ChevronUp size={14} /> Highlighted above
            </div>
          )}
          <div className="tmE-preview-head">
            <p className="tmE-preview-label">Live preview</p>
            {(previewHits.kw || previewHits.metric) && (
              <button
                type="button"
                className="tmE-preview-toggle"
                aria-pressed={showMatches}
                onClick={() => setShowMatches((v) => !v)}
              >
                {showMatches ? <Eye size={13} /> : <EyeOff size={13} />}
                {showMatches ? "Hide match overlay" : "Show match overlay"}
              </button>
            )}
          </div>
          {showMatches && (previewHits.kw || previewHits.metric) && (
            <p className="tmE-preview-note">
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
              <span className="tmE-preview-overlaynote">
                <Info size={12} /> A review overlay, not part of your resume or PDF.
              </span>
            </p>
          )}
          <div
            className="tmE-doc-viewport"
            ref={viewportRef}
            style={{
              height: paged
                ? `${pageHeightScaled}px`
                : docHeight != null
                  ? `${docHeight}px`
                  : undefined,
            }}
          >
            <div
              ref={docWrapRef}
              className="tmE-doc-scaler"
              style={{
                transform: `scale(${docScale}) translateY(${-pageTranslate}px)`,
                transition: "transform 0.3s ease",
              }}
            >
              <PrintDoc doc={doc} id={id} resumeOnly hideToolbar highlightKeywords={showMatches ? previewKeywords : undefined} />
            </div>
            {cursorTop != null && (
              <div className="tmE-cursor" style={{ top: `${cursorTop}px` }} aria-hidden="true">
                <span className="tmE-cursor-badge">{avatarInitials}</span>
              </div>
            )}
          </div>
          {hlDir === "down" && (
            <div className="tmE-hl-arrow tmE-hl-arrow--down" aria-hidden="true">
              <ChevronDown size={14} /> Highlighted below
            </div>
          )}
          <div className="tmE-preview-foot">
            <span
              className={`tmE-saved ${saving ? "is-saving" : dirty ? "is-dirty" : "is-saved"}`}
              aria-live="polite"
            >
              {saving ? (
                <>
                  <Loader2 size={12} className="tmE-saved-spin" /> Saving…
                </>
              ) : dirty ? (
                <>
                  <span className="tmE-saved-dot" aria-hidden="true" /> Unsaved changes
                </>
              ) : (
                <>
                  <Check size={12} /> Saved
                </>
              )}
            </span>
            {totalPages > 1 && (
              <div className="tmE-pager">
                <button
                  type="button"
                  className="tmE-pager-btn"
                  onClick={() => goToPage(safePage - 1)}
                  disabled={safePage <= 1}
                  aria-label="Previous page"
                >
                  <ChevronLeft size={15} />
                </button>
                <span className="tmE-pager-count">
                  {safePage} / {totalPages}
                </span>
                <button
                  type="button"
                  className="tmE-pager-btn"
                  onClick={() => goToPage(safePage + 1)}
                  disabled={safePage >= totalPages}
                  aria-label="Next page"
                >
                  <ChevronRight size={15} />
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Cover letter — review-first (read by default), light edit behind a toggle. */}
      {coverOpen && (
        <div
          className="tmE-cover-backdrop"
          onClick={() => setCoverOpen(false)}
          role="presentation"
        >
          <div
            className="tmE-cover-modal"
            role="dialog"
            aria-modal="true"
            aria-label="Cover letter"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="tmE-cover-head">
              <div>
                <b>
                  <Mail size={15} /> Cover letter
                </b>
                <span>
                  AI-generated for {role}
                  {company ? ` at ${company}` : ""}. Review it. Light edits are optional.
                </span>
              </div>
              <button
                type="button"
                className="tmE-cover-x"
                onClick={() => setCoverOpen(false)}
                aria-label="Close"
              >
                <X size={16} />
              </button>
            </div>
            <div className="tmE-cover-body">
              {coverEditing ? (
                <textarea
                  className="tmE-textarea"
                  value={doc.coverLetter}
                  onChange={(e) => patch({ coverLetter: e.target.value })}
                  style={{ minHeight: 320 }}
                />
              ) : (
                (doc.coverLetter || "")
                  .split(/\n{2,}/)
                  .filter((p) => p.trim())
                  .map((p, i) => (
                    <p key={i} className="tmE-cover-para">
                      {p}
                    </p>
                  ))
              )}
            </div>
            <div className="tmE-cover-foot">
              <button
                type="button"
                className="tm-btn tm-btn--outline tm-btn--sm"
                onClick={() => setCoverEditing((v) => !v)}
              >
                {coverEditing ? (
                  <>
                    <Check size={13} /> Done editing
                  </>
                ) : (
                  <>
                    <PenLine size={13} /> Edit
                  </>
                )}
              </button>
              <button
                type="button"
                className="tm-btn tm-btn--primary tm-btn--sm"
                onClick={() => setCoverOpen(false)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
