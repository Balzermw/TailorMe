"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Check,
  ChevronDown,
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
  Sparkles,
  Target,
  Trash2,
  Ungroup,
  X,
} from "lucide-react";
import type {
  AgentPass,
  AgentPassId,
  AgentReviewState,
  AgentSuggestion,
  AgentSuggestionDecision,
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
import { groundFindings } from "@/lib/resume-rules/groundFindings";
import {
  composeContact,
  normalizeContactFields,
  normalizeContactLine,
  parseContact,
  type ContactFields,
} from "@/lib/apply/contact";
import { isPlaceholderName } from "@/lib/apply/placeholder-name";
import {
  cleanSkillGroups,
  normalizeHeadline,
  stripSkillLabel,
  stripTemplateGuidance,
} from "@/lib/apply/sanitize-doc";
import { type Section, SECTION_LABEL, fixSection } from "@/lib/apply/sections";
import { cleanResumeDate } from "@/lib/apply/dates";
import PrintDoc from "../print/print-doc";

const SEV: Record<ProofPoint["severity"], { label: string; color: string; bg: string }> = {
  high: { label: "High priority", color: "#b3261e", bg: "#fdecea" },
  medium: { label: "Worth fixing", color: "#854f0b", bg: "#fdf3e7" },
  low: { label: "Minor polish", color: "var(--tm-zinc)", bg: "rgba(24,24,27,0.06)" },
};

const AGENT_PASS_ORDER: AgentPassId[] = ["ada_ats", "remy_rolefit", "max_impact"];

const AGENT_PASS_SCORE_COPY: Record<AgentPassId, string> = {
  ada_ats: "ATS",
  remy_rolefit: "Role Fit",
  max_impact: "Impact",
};

const AGENT_PASS_SCORE_HELP: Record<AgentPassId, string> = {
  ada_ats: "Ada's ATS score estimates keyword coverage and parser readiness.",
  remy_rolefit: "Remy's Role Fit score estimates how directly the resume supports this target role.",
  max_impact: "Max's Impact score estimates how much proof, scale, and measurable outcome appears in the resume.",
};

function agentSuggestionKeyFromRule(ruleId: string | undefined): string | null {
  const key = ruleId?.match(/^agent:(.+)$/)?.[1]?.trim();
  return key || null;
}

function agentSuggestionKey(p: ProofPoint): string | null {
  return agentSuggestionKeyFromRule(p.ruleId);
}

function agentSuggestionToProofPoint(pass: AgentPass, suggestion: AgentSuggestion): ProofPoint {
  const targetSection =
    (suggestion.targetSection ?? (suggestion.section === "other" ? undefined : suggestion.section)) as
      | ProofPoint["targetSection"]
      | undefined;
  return {
    title: suggestion.title,
    summary: suggestion.explanation || suggestion.summary,
    quote: suggestion.quote,
    why: suggestion.why,
    fix: suggestion.suggestedRewrite
      ? `${suggestion.fix} Suggested rewrite: "${suggestion.suggestedRewrite}"`
      : suggestion.fix,
    severity: suggestion.severity,
    ruleId: `agent:${suggestion.id}`,
    category: suggestion.actionType,
    targetSection,
    agentId: pass.id,
    agentPersona: pass.persona,
    agentPassLabel: pass.scoreLabel,
    actionType: suggestion.actionType,
    suggestedRewrite: suggestion.suggestedRewrite,
    truthfulnessRisk: suggestion.truthfulnessRisk,
  };
}

function aiRewriteSuggestionKey(entry: number, bullet: number): string {
  return `ai-rewrite-${entry}-${bullet}`;
}

function aiRewriteTarget(p: ProofPoint): ProofPoint["aiRewrite"] | null {
  return p.aiRewrite ?? null;
}

function classifyAiRewrite(diff: BulletDiff): AgentPassId {
  const beforeHasMetric = /(\d|%|\$|\bpercent\b|million|billion|thousand|\bk\b)/i.test(diff.before);
  const afterHasMetric = /(\d|%|\$|\bpercent\b|million|billion|thousand|\bk\b)/i.test(diff.after);
  const impactLanguage = /\b(reduced|increased|improved|saved|cut|grew|accelerated|delivered|generated|resolved|prevented|optimized)\b/i;
  if ((afterHasMetric && !beforeHasMetric) || impactLanguage.test(diff.after)) return "max_impact";
  return "remy_rolefit";
}

function aiRewriteToProofPoint(diff: BulletDiff, doc: TailoredDoc): ProofPoint {
  const agentId = classifyAiRewrite(diff);
  const role = doc.experience?.[diff.entry]?.role?.trim();
  const persona = agentId === "max_impact" ? "Max" : "Remy";
  const actionType = agentId === "max_impact" ? "add_metric" : "strengthen_role_fit";
  const key = aiRewriteSuggestionKey(diff.entry, diff.bullet);
  return {
    title: agentId === "max_impact" ? "Review impact rewrite" : "Review role-fit rewrite",
    summary: role
      ? `${role} bullet ${diff.bullet + 1} was rewritten by AI. Keep it, edit it, or restore your original wording.`
      : `Experience bullet ${diff.bullet + 1} was rewritten by AI. Keep it, edit it, or restore your original wording.`,
    quote: diff.after,
    why:
      agentId === "max_impact"
        ? "Max checks whether the rewrite adds credible proof, scope, or measurable outcome without inventing details."
        : "Remy checks whether the rewrite makes the bullet more directly relevant to the target role.",
    fix: `Original wording: "${diff.before}"`,
    severity: "medium",
    ruleId: `agent:${key}`,
    category: actionType,
    targetSection: "experience",
    agentId,
    agentPersona: persona,
    agentPassLabel: agentId === "max_impact" ? "Impact Score" : "Role-Fit Score",
    actionType,
    suggestedRewrite: diff.after,
    truthfulnessRisk: agentId === "max_impact" ? "needs_user_input" : "none",
    aiRewrite: { ...diff },
  };
}

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
const HEADER_MISSING_FIELD_RE =
  /^(?:n\/a|none|unknown|tbd|to be determined|not (?:provided|specified|listed|available|disclosed|given|set|found))$/i;
const HEADLINE_PLACEHOLDER_RE =
  /^(?:headline|resume headline|title|job title|current title|role title|target role|professional title|your title|your headline|position title)$/i;
function hasResolvedHeaderName(name: string): boolean {
  const clean = name.replace(/\s+/g, " ").trim();
  return !!clean && !HEADER_MISSING_FIELD_RE.test(clean) && !isPlaceholderName(clean);
}
function hasResolvedHeaderTitle(headline: string): boolean {
  const clean = headline.replace(/\s+/g, " ").trim();
  return !!clean && !HEADER_MISSING_FIELD_RE.test(clean) && !HEADLINE_PLACEHOLDER_RE.test(clean);
}
function pruneResolvedFindings(
  points: ProofPoint[],
  doc: TailoredDoc,
  initialHay: string,
): ProofPoint[] {
  const hay = normForMatch(docPlainText(doc));
  return points.filter((p) => {
    // Header gaps resolve live: once the field has a value, the ask is done and
    // the suggestion checks itself off (no quote to match on these).
    if (p.ruleId === "header_missing_name") return !hasResolvedHeaderName(doc.name);
    if (p.ruleId === "header_missing_title") return !hasResolvedHeaderTitle(doc.headline);
    if (p.ruleId === "header_missing_location") return !parseContact(doc.contact).location;
    if (p.ruleId === "header_missing_email") return !parseContact(doc.contact).email;
    if (p.ruleId === "header_missing_phone") return !parseContact(doc.contact).phone;
    if (!p.quote) return true; // "missing section" issues have no quote to verify
    let q = normForMatch(p.quote);
    // Drop a leading section-header word (e.g. "Skills") that isn't in the body.
    const sp = q.indexOf(" ");
    if (sp > 0) q = q.slice(sp + 1);
    if (q.length < 12) return true; // too little to judge — keep
    // If the quote never matched the freshly-structured doc, it's a structuring
    // mismatch (not something the user resolved) — keep it, so the panel count
    // matches what the handoff promised instead of silently dropping one.
    if (initialHay && !initialHay.includes(q)) return true;
    // Otherwise keep only while the quoted text is still present; once an edit
    // removes it the finding is considered resolved and disappears.
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

// The preview's data-field anchor for an editable section. List sections point at
// a specific entry so a cross-page edit jumps to the exact item, not the section.
function previewAnchorFor(target: EditableSection, entry = 0): string {
  switch (target) {
    case "summary":
      return "summary";
    case "skills":
      return "skills";
    case "experience":
      return `exp-${entry}`;
    case "projects":
      return `proj-${entry}`;
    case "education":
      return `edu-${entry}`;
    case "certifications":
      return `cert-${entry}`;
    default:
      return "header";
  }
}

function diffTokenNorm(token: string): string {
  return token.toLowerCase().replace(/[^a-z0-9%$]+/g, "");
}

function addedTextFragments(before: string, after: string): string[] {
  const beforeTokens = before.match(/\S+/g) ?? [];
  const afterTokens = after.match(/\S+/g) ?? [];
  const beforeNorm = beforeTokens.map(diffTokenNorm);
  const afterNorm = afterTokens.map(diffTokenNorm);
  if (!afterNorm.some(Boolean)) return [];
  if (!beforeNorm.some(Boolean)) return [after.trim()].filter(Boolean);

  const dp = Array.from({ length: beforeTokens.length + 1 }, () =>
    Array(afterTokens.length + 1).fill(0),
  );
  for (let i = 1; i <= beforeTokens.length; i += 1) {
    for (let j = 1; j <= afterTokens.length; j += 1) {
      dp[i][j] =
        beforeNorm[i - 1] && beforeNorm[i - 1] === afterNorm[j - 1]
          ? dp[i - 1][j - 1] + 1
          : Math.max(dp[i - 1][j], dp[i][j - 1]);
    }
  }

  const keptAfter = new Set<number>();
  let i = beforeTokens.length;
  let j = afterTokens.length;
  while (i > 0 && j > 0) {
    if (beforeNorm[i - 1] && beforeNorm[i - 1] === afterNorm[j - 1]) {
      keptAfter.add(j - 1);
      i -= 1;
      j -= 1;
    } else if (dp[i - 1][j] >= dp[i][j - 1]) {
      i -= 1;
    } else {
      j -= 1;
    }
  }

  const fragments: string[] = [];
  let start: number | null = null;
  for (let idx = 0; idx <= afterTokens.length; idx += 1) {
    const isAdded = idx < afterTokens.length && afterNorm[idx] && !keptAfter.has(idx);
    if (isAdded && start == null) start = idx;
    if ((!isAdded || idx === afterTokens.length) && start != null) {
      const end = idx;
      const phrase = afterTokens.slice(start, end).join(" ").trim();
      if (phrase.length > 1 && /[a-z0-9]/i.test(phrase)) fragments.push(phrase);
      start = null;
    }
  }

  return [...new Set(fragments)].slice(0, 8);
}

// Top-level editor tabs (resume.co-style): Edit the content, pick a Design, or
// review Feedback. The preview stays mounted across all three.
type EditorMode = "edit" | "design" | "feedback";
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

// Whether an AI draft makes sense for this finding. Header identity/contact gaps
// need the user's own info, so those offer only "Edit manually" -- no AI draft.
function canAiDraft(p: ProofPoint): boolean {
  if (
    p.ruleId === "header_missing_name" ||
    p.ruleId === "header_missing_title" ||
    p.ruleId === "header_missing_location" ||
    p.ruleId === "header_missing_email" ||
    p.ruleId === "header_missing_phone"
  ) return false;
  const blob = `${p.title} ${p.summary} ${p.fix ?? ""}`.toLowerCase();
  return !(
    /\b(?:add|include|provide|enter|missing|no)\b/.test(blob) &&
    /\b(?:email address|e-?mail|phone number|telephone|mobile number)\b/.test(blob)
  );
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
  if (p.suggestedRewrite?.trim()) return p.suggestedRewrite.trim();
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

// --- Shorten-bullets flow (a multi-bullet fix, reviewed one bullet at a time) ---
// One over-long bullet and its AI/trimmed replacement, with the user's accept flag.
type ShortenRow = { ei: number; bi: number; original: string; shortened: string; accepted: boolean };

// Mirror bullet_length_1_to_2_lines (evaluateLatexResumeRules.ts): a bullet is
// over the 1-2 line target past ~220 chars or ~35 words.
function isLongBullet(text: string): boolean {
  const t = (text ?? "").trim();
  return t.length > 220 || t.split(/\s+/).filter(Boolean).length > 35;
}
// Mirror quantify_impact_metrics (evaluateLatexResumeRules.ts): a bullet "needs
// a metric" when it carries no number/%/$/scale word.
const HAS_METRIC = /(\d|%|\$|\bpercent\b|million|billion|thousand|\bk\b)/i;
function needsMetric(text: string): boolean {
  return !HAS_METRIC.test(text ?? "");
}
// Bullet-level findings that apply across MANY bullets (so they go through the
// batch reviewer, not the single-draft box). Returns the review mode or null.
function bulletReviewMode(p: ProofPoint): "shorten" | "quantify" | null {
  if (p.agentId) return null;
  if (p.ruleId === "bullet_length_1_to_2_lines") return "shorten";
  if (p.ruleId === "quantify_impact_metrics") return "quantify";
  const blob = `${p.title} ${p.fix ?? ""}`.toLowerCase();
  if (!/\bbullet|metric|number|result/.test(blob)) return null;
  if (/\b(shorten|too long|trim|cut down|over the)\b/.test(blob)) return "shorten";
  if (/\b(metric|quantif|number|measurable)\b/.test(blob)) return "quantify";
  return null;
}
// Demo/no-LLM fallback for quantify: we can't invent a real figure, so append a
// short bracketed placeholder for the user to fill in. Honest by construction.
function quantifyFallback(text: string): string {
  const t = (text ?? "").trim().replace(/[.\s]+$/, "");
  return `${t} ([add a metric: %, $, count, or time saved]).`;
}
// Demo/no-LLM fallback: trim a long bullet to one idea at a sentence or word
// boundary. Honest — no fabricated content, just a tighter version to confirm.
function trimBullet(text: string): string {
  const t = (text ?? "").trim().replace(/\s+/g, " ");
  if (t.length <= 200) return t;
  const sentence = t.match(/^.{60,200}?[.!?](?:\s|$)/)?.[0]?.trim();
  if (sentence) return sentence.replace(/[.!?]+$/, "");
  let cut = t.slice(0, 185);
  const sp = cut.lastIndexOf(" ");
  if (sp > 80) cut = cut.slice(0, sp);
  return cut.replace(/[\s,;:]+(?:and|or|with|to|for|the|a|an|that|which|including)?$/i, "").trim();
}

// An applied experience edit must be just the bullet. The AI rewrite is given
// section context, so it can echo a leading "Role — Company" header or bullet
// markers; strip those so the role title never lands inside a bullet.
function cleanBulletText(text: string): string {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.replace(/^[\s•*•‣▪\-–—]+/, "").trim())
    .filter(Boolean);
  if (lines.length > 1 && /\s[—–-]\s/.test(lines[0]) && lines[0].length <= 80) {
    lines.shift(); // drop a "Role — Company" style header line the rewrite echoed
  }
  return lines.join(" ").trim() || text.trim();
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
  // Self-heal skill groups a past bad apply may have mangled (labels dumped in
  // as skills, duplicates). No-op on clean groups.
  const healedGroups = doc.skillGroups?.length ? cleanSkillGroups(doc.skillGroups) : doc.skillGroups;
  const groupsChanged =
    !!doc.skillGroups?.length && JSON.stringify(healedGroups) !== JSON.stringify(doc.skillGroups);
  if (
    contact === doc.contact &&
    headline === doc.headline &&
    summary === doc.summary &&
    !groupsChanged
  ) {
    return doc;
  }
  return {
    ...doc,
    contact,
    headline,
    summary,
    ...(groupsChanged
      ? {
          skillGroups: healedGroups,
          skills: Array.from(new Set((healedGroups ?? []).flatMap((g) => g.skills))),
        }
      : {}),
  };
}

export default function EditEditor({
  id,
  doc: initialDoc,
  originalDoc,
  bulletDiffs,
  initialDecisions,
  agentPasses = [],
  initialAgentReview = null,
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
  agentPasses?: AgentPass[];
  initialAgentReview?: AgentReviewState | null;
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
    agentReview?: AgentReviewState;
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
  const availableAgentPasses = agentPasses.filter((pass) => AGENT_PASS_ORDER.includes(pass.id));
  const hasAgentPasses = availableAgentPasses.length > 0;
  const [activeAgentPass, setActiveAgentPass] = useState<AgentPassId>(
    initialAgentReview?.activeAgentPass && AGENT_PASS_ORDER.includes(initialAgentReview.activeAgentPass)
      ? initialAgentReview.activeAgentPass
      : availableAgentPasses[0]?.id ?? "ada_ats",
  );
  const [agentSuggestionDecisions, setAgentSuggestionDecisions] = useState<
    Record<string, AgentSuggestionDecision>
  >(initialAgentReview?.agentSuggestions ?? {});
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
  // Transient "we applied that, and here's where" confirmation toast. The `key`
  // bumps on every fire so re-firing the same text restarts the auto-dismiss.
  const [applied, setApplied] = useState<{ text: string; key: number; target?: EditableSection } | null>(null);
  // Posting keywords the user has added to Skills this session — so the keyword
  // suggestion card can show them as done instead of still prompting.
  const [addedKeywords, setAddedKeywords] = useState<Set<string>>(() => new Set());
  // Adding a keyword is an AI-driven change, so each one is reviewable (kept or
  // removed) and counts in the review banner alongside the bullet rewrites, until
  // the user signs off on it. Session-local, like addedKeywords.
  const [keywordDecisions, setKeywordDecisions] = useState<Record<string, "kept" | "removed">>({});
  // Suggested keywords the user has deselected (so "Add to skills" adds only the
  // ones they actually want, not all of them). Session-local.
  const [excludedKeywords, setExcludedKeywords] = useState<Set<string>>(() => new Set());
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
  const [appliedSuggestionIds, setAppliedSuggestionIds] = useState<Set<string>>(() => new Set());
  const [suggestionDrafts, setSuggestionDrafts] = useState<Record<string, string>>({});
  // Suggestions whose draft is currently being generated by the AI rewrite call.
  const [rewritingIds, setRewritingIds] = useState<Set<string>>(() => new Set());
  // The "shorten over-long bullets" batch reviewer: one row per long bullet, each
  // with its AI/trimmed replacement and an accept flag. Null when closed.
  const [shortenReview, setShortenReview] = useState<{
    id: string;
    p: ProofPoint;
    mode: "shorten" | "quantify";
    rows: ShortenRow[];
  } | null>(null);
  const [shortenLoading, setShortenLoading] = useState(false);
  // What the panel actually shows: findings whose quoted text still exists in the
  // doc. Derived (not stored) so it updates live as the user edits — applying a
  // suggested change drops its finding, and structuring-fixed ones never surface.
  // The doc's text at mount, captured once via a lazy initializer. Used to ground
  // findings (was the quoted evidence ever real in this résumé?) and by
  // pruneResolvedFindings (drop a finding only once an edit removes its quote).
  const [initialDocHay] = useState(() => normForMatch(docPlainText(doc)));
  // Trust layer: drop template-owned / myth findings and any whose quoted
  // evidence can't be verified in the résumé BEFORE the panel shows them. Manual
  // (user-added) suggestions are never grounded away.
  const agentProofPoints = useMemo(() => {
    const passPoints = agentPasses.flatMap((pass) =>
      pass.suggestions.map((s) => agentSuggestionToProofPoint(pass, s)),
    );
    if (!hasAgentPasses) return passPoints;
    return [...bulletDiffs.map((diff) => aiRewriteToProofPoint(diff, doc)), ...passPoints];
  }, [agentPasses, bulletDiffs, doc, hasAgentPasses]);
  const allProofPoints = useMemo(
    () => [
      ...groundFindings(proofPoints, initialDocHay, { templated: true }),
      ...groundFindings(agentProofPoints, initialDocHay, { templated: false }),
    ],
    [agentProofPoints, proofPoints, initialDocHay],
  );
  const shownPoints = useMemo(
    () =>
      pruneResolvedFindings(allProofPoints, doc, initialDocHay).filter(
        (p) => {
          if (appliedSuggestionIds.has(suggestionId(p))) return false;
          const agentKey = agentSuggestionKey(p);
          const aiRewrite = aiRewriteTarget(p);
          if (aiRewrite && decisions[bulletKey(aiRewrite.entry, aiRewrite.bullet)]) return false;
          return !(agentKey && agentSuggestionDecisions[agentKey]);
        },
      ),
    [allProofPoints, agentSuggestionDecisions, appliedSuggestionIds, decisions, doc, initialDocHay],
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
  // The edit-fields column. On a section change we scroll THIS into view (never
  // the résumé section), so switching sections keeps the text inputs visible.
  const editMainRef = useRef<HTMLDivElement>(null);
  // After an applied edit, the exact preview anchor to scroll to, so an edit lands
  // visibly in the (continuously-scrolling) preview rather than off-screen.
  const [pendingJump, setPendingJump] = useState<string | null>(null);
  const [appliedPreviewFlash, setAppliedPreviewFlash] = useState<{
    key: number;
    anchor: string;
    additions: string[];
  } | null>(null);
  // While a suggestion's draft is open, keep its targeted line highlighted in the
  // preview (not just on hover) so the user always sees WHAT they're editing.
  const [lockedFinding, setLockedFinding] = useState<{ quote?: string; section: Section } | null>(
    null,
  );
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
  const appliedPreviewHighlights = useMemo(
    () =>
      appliedPreviewFlash
        ? { [appliedPreviewFlash.anchor]: appliedPreviewFlash.additions }
        : undefined,
    [appliedPreviewFlash],
  );
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
      // Continuous scroll: the preview is one tall sheet that scrolls, so we only
      // need the document's true (natural) height scaled to the on-screen zoom, to
      // size the scroll area. No page splitting / sheet-fill padding.
      page.style.minHeight = "";
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
  // Scaled width of the document, so the scroll area (sizer) matches the zoomed
  // doc and centers it.
  const docWidthScaled = Math.round(PREVIEW_DOC_WIDTH * docScale);
  // Experience entries collapse to a one-line header. Don't auto-open every entry
  // with rewrites (that buries the list) — open just the topmost one with edits so
  // there's immediate context; the per-entry count badges show where the rest are.
  const [openEntries, setOpenEntries] = useState<Set<number>>(() =>
    bulletDiffs.length ? new Set([Math.min(...bulletDiffs.map((d) => d.entry))]) : new Set(),
  );
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
    // The off-screen thing we point an arrow at: a highlighted finding, else the
    // section being edited.
    const arrowTarget = (): HTMLElement | null =>
      (previewRef.current?.querySelector(".mcv-hl") as HTMLElement | null) ||
      (editingAnchor
        ? (docWrapRef.current?.querySelector(`[data-field="${editingAnchor}"]`) as HTMLElement | null)
        : null);
    // Arrow direction: is the target above or below the viewport? null when in view.
    const computeDir = () => {
      const el = arrowTarget();
      if (!el) {
        setHlDir(null);
        return;
      }
      const r = el.getBoundingClientRect();
      const vh = window.innerHeight || document.documentElement.clientHeight;
      setHlDir(r.bottom < 72 ? "up" : r.top > vh - 40 ? "down" : null);
    };
    // The "you are here" avatar sits at the section's offset inside the scroll
    // content, so it tracks the résumé as the page scrolls.
    const computeCursor = () => {
      const scaler = docWrapRef.current;
      const el = editingAnchor ? scaler?.querySelector(`[data-field="${editingAnchor}"]`) : null;
      if (!scaler || !el) {
        setCursorTop(null);
        return;
      }
      const sr = scaler.getBoundingClientRect();
      const er = (el as HTMLElement).getBoundingClientRect();
      setCursorTop(Math.max(2, er.top - sr.top));
    };
    const compute = () => {
      computeCursor();
      computeDir();
    };
    // On a SECTION change, keep the edit fields in view (scroll UP to them only if
    // needed) — never scroll DOWN to the résumé section. The arrow points there
    // instead, and the user can tap it to jump.
    const anchorChanged = prevAnchorRef.current !== editingAnchor;
    prevAnchorRef.current = editingAnchor;
    if (anchorChanged) {
      // Target the section TITLE (small), not the tall column — scrollIntoView
      // treats a viewport-spanning element as already "in view" and won't move.
      const titleEl = editMainRef.current?.querySelector(".tmE-panel-title");
      (titleEl ?? editMainRef.current)?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
    const raf = requestAnimationFrame(compute);
    const t = setTimeout(compute, 200); // settle after reflow
    // Keep the arrow accurate while the page scrolls (incl. our own smooth scroll).
    let sraf = 0;
    const onScroll = () => {
      cancelAnimationFrame(sraf);
      sraf = requestAnimationFrame(computeDir);
    };
    window.addEventListener("resize", compute);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      cancelAnimationFrame(raf);
      cancelAnimationFrame(sraf);
      clearTimeout(t);
      window.removeEventListener("resize", compute);
      window.removeEventListener("scroll", onScroll);
    };
  }, [editingAnchor, docScale, doc, openEntries]);
  // After an apply, let the doc re-render, then scroll the edited block into view
  // so the change is visible in the continuous preview. Clears itself once done.
  useEffect(() => {
    if (!pendingJump) return;
    let raf: number | null = null;
    let clearPulse: ReturnType<typeof setTimeout> | null = null;
    const t = setTimeout(() => {
      raf = window.requestAnimationFrame(() => {
        const el = docWrapRef.current?.querySelector(
          `[data-field="${pendingJump}"]`,
        ) as HTMLElement | null;
        if (el) {
          el.scrollIntoView({ behavior: "smooth", block: "center" });
          el.classList.add("mcv-apply-pulse");
          clearPulse = setTimeout(() => el.classList.remove("mcv-apply-pulse"), 2200);
        }
        setPendingJump(null);
      });
    }, 300);
    return () => {
      clearTimeout(t);
      if (clearPulse) clearTimeout(clearPulse);
      if (raf != null) window.cancelAnimationFrame(raf);
    };
  }, [pendingJump, doc]);
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
  // After "Edit manually" on a header gap, focus the matching input so the user
  // lands directly on the field to fill (and the gap checks off once it has a
  // value, via pruneResolvedFindings). The intent lives in a ref (cleared in the
  // effect without a re-render); a tick triggers the effect once the field mounts.
  type HeaderFocusField = "name" | "headline" | "phone" | "email" | "location";
  const nameInputRef = useRef<HTMLInputElement>(null);
  const headlineInputRef = useRef<HTMLInputElement>(null);
  const phoneInputRef = useRef<HTMLInputElement>(null);
  const emailInputRef = useRef<HTMLInputElement>(null);
  const locationInputRef = useRef<HTMLInputElement>(null);
  const pendingFocusRef = useRef<HeaderFocusField | null>(null);
  const [focusTick, setFocusTick] = useState(0);
  function focusHeaderField(field: HeaderFocusField) {
    pendingFocusRef.current = field;
    setFocusTick((t) => t + 1);
  }
  useEffect(() => {
    const field = pendingFocusRef.current;
    if (!field || mode !== "edit" || section !== "header") return;
    const el =
      field === "name"
        ? nameInputRef.current
        : field === "headline"
          ? headlineInputRef.current
          : field === "phone"
            ? phoneInputRef.current
            : field === "email"
              ? emailInputRef.current
              : locationInputRef.current;
    if (el) {
      el.focus();
      el.scrollIntoView({ block: "center", behavior: "smooth" });
    }
    pendingFocusRef.current = null;
  }, [focusTick, mode, section]);

  const diffs = diffMap(bulletDiffs);
  const totalPending = bulletDiffs.filter((d) => !decisions[bulletKey(d.entry, d.bullet)]).length;

  function touch() {
    setDirty(true);
    setMsg(null);
  }
  // Show a brief "applied to X" confirmation so the user knows content landed and
  // where. A useEffect handles auto-dismiss (keyed off `applied`).
  function flashApplied(text: string, target?: EditableSection) {
    setApplied((a) => ({ text, target, key: (a?.key ?? 0) + 1 }));
  }
  function flashAppliedPreview(anchor: string, before: string, after: string, additions?: string[]) {
    const added = additions?.length
      ? additions.map((a) => a.trim()).filter(Boolean)
      : addedTextFragments(before, after);
    if (!anchor || !added.length) return;
    setAppliedPreviewFlash((flash) => ({
      anchor,
      additions: [...new Set(added)],
      key: (flash?.key ?? 0) + 1,
    }));
  }
  useEffect(() => {
    if (!applied) return;
    const t = setTimeout(() => setApplied(null), 3600);
    return () => clearTimeout(t);
  }, [applied]);
  useEffect(() => {
    if (!appliedPreviewFlash) return;
    const t = setTimeout(() => setAppliedPreviewFlash(null), 3400);
    return () => clearTimeout(t);
  }, [appliedPreviewFlash]);
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
      // Flat comma list (NO group labels) so the rewrite returns a clean list we
      // can merge — feeding it "Label: a, b" made it echo labels back as skills.
      return (
        doc.skillGroups?.length
          ? doc.skillGroups.flatMap((g) => g.skills)
          : (doc.skills ?? [])
      ).join(", ");
    if (target === "header") return doc.contact ?? "";
    if (target === "experience")
      // Bullets only (no "Role — Company" headers) so the rewrite can't echo a
      // role title into the bullet it produces.
      return doc.experience
        .flatMap((e) => e.bullets)
        .join("\n")
        .slice(0, 2000);
    return "";
  }

  // Open a suggestion's draft. Show the template instantly, then ask the AI to
  // turn it into an actual ready-to-paste rewrite (replacing the placeholder only
  // if the user hasn't started editing). Demo/no-LLM keeps the template.
  function openSuggestionDraft(p: ProofPoint, target: EditableSection) {
    const id = suggestionId(p);
    if (suggestionDrafts[id] != null) return; // already open
    // Keep the targeted line highlighted while the draft is open, without
    // auto-scrolling the page away from the card the user is working in.
    setLockedFinding({ quote: p.quote, section: target });
    const fallback = draftFromFinding(p, target);
    if (aiRewriteTarget(p)) {
      setSuggestionDrafts((drafts) => (drafts[id] != null ? drafts : { ...drafts, [id]: fallback }));
      return;
    }
    // Open with an EMPTY draft + the AI spinner; the box stays blank until the
    // rewrite returns. Only fall back to the template draft in demo/no-LLM/error,
    // and only while the user hasn't started typing (draft still "").
    setSuggestionDrafts((drafts) => (drafts[id] != null ? drafts : { ...drafts, [id]: "" }));
    setRewritingIds((s) => new Set(s).add(id));
    void (async () => {
      const applyFallback = () =>
        setSuggestionDrafts((drafts) =>
          drafts[id] === "" ? { ...drafts, [id]: fallback } : drafts,
        );
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
            drafts[id] === "" ? { ...drafts, [id]: data.rewrite.trim() } : drafts,
          );
        } else {
          applyFallback(); // demo mode ({ demo: true }) or empty response
        }
      } catch {
        applyFallback();
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
    // Release the persistent preview highlight once the draft is gone.
    setLockedFinding(null);
    clearHighlight();
  }

  function markAgentSuggestionDecision(p: ProofPoint, decision: AgentSuggestionDecision) {
    const key = agentSuggestionKey(p);
    if (!key) return;
    setAgentSuggestionDecisions((state) => ({ ...state, [key]: decision }));
    touch();
  }

  function markSuggestionApplied(
    id: string,
    p?: ProofPoint,
    decision: AgentSuggestionDecision = "accepted",
  ) {
    setAppliedSuggestionIds((ids) => {
      const next = new Set(ids);
      next.add(id);
      return next;
    });
    if (p) markAgentSuggestionDecision(p, decision);
    closeSuggestionDraft(id);
  }

  function decideAiRewriteSuggestion(p: ProofPoint, decision: Extract<EditDecision, "accepted" | "rejected">) {
    const aiRewrite = aiRewriteTarget(p);
    if (!aiRewrite) return;
    decide(aiRewrite.entry, aiRewrite.bullet, decision);
    const anchor = `exp-${aiRewrite.entry}-bullet-${aiRewrite.bullet}`;
    setPendingJump(anchor);
    flashAppliedPreview(
      anchor,
      decision === "accepted" ? aiRewrite.before : aiRewrite.after,
      decision === "accepted" ? aiRewrite.after : aiRewrite.before,
    );
    markSuggestionApplied(suggestionId(p), p, decision);
    flashApplied(decision === "accepted" ? "AI rewrite kept" : "Original wording restored", "experience");
  }

  // Open the batch reviewer for a per-bullet finding (shorten or quantify):
  // collect every bullet that matches, ask the AI (or a deterministic fallback in
  // demo) for a revised version of each, and present them as accept/reject rows.
  async function openBulletReview(p: ProofPoint) {
    const mode = bulletReviewMode(p);
    if (!mode) return;
    const id = suggestionId(p);
    const select = mode === "shorten" ? isLongBullet : needsMetric;
    const targets = doc.experience.flatMap((entry, ei) =>
      entry.bullets.map((original, bi) => ({ ei, bi, original })).filter((t) => select(t.original)),
    );
    if (!targets.length) {
      markSuggestionApplied(id, p, "resolved"); // nothing matches anymore — clear the stale finding
      return;
    }
    setShortenReview({ id, p, mode, rows: [] });
    setShortenLoading(true);
    const issue =
      mode === "shorten"
        ? "This experience bullet is over the 1-2 line target."
        : "This experience bullet states the task but has no measurable result.";
    const advice =
      mode === "shorten"
        ? "Shorten it to one idea, result first. Stay strictly truthful; do not invent any detail."
        : "Turn each task into a result, leading with scope and specifics. Add a modest, realistic " +
          "metric only where it fits naturally, and vary the kind of metric across bullets. One line.";
    // One batched call (not one per bullet): the model sees every bullet at once and
    // varies its metrics, instead of stamping the same "15%" on each in isolation.
    let rewrites: string[] = [];
    try {
      const res = await fetch("/api/resume/rewrite", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-tm-session": getSessionId() ?? "" },
        body: JSON.stringify({
          section: "experience",
          issue,
          advice,
          bullets: targets.map((t) => t.original),
          allowEstimates: mode === "quantify",
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && Array.isArray(data.rewrites)) rewrites = data.rewrites;
    } catch {
      /* fall back to the deterministic rewrite per bullet below */
    }
    const rows: ShortenRow[] = targets.map((t, i) => {
      const ai = typeof rewrites[i] === "string" ? cleanBulletText(rewrites[i].trim()) : "";
      const fallback = mode === "shorten" ? trimBullet(t.original) : quantifyFallback(t.original);
      return { ...t, shortened: ai || fallback, accepted: true };
    });
    // Keep only rows that actually changed (and, for shorten, got shorter).
    const useful = rows.filter((r) => {
      const next = r.shortened.trim();
      if (!next || next === r.original.trim()) return false;
      return mode === "shorten" ? next.length < r.original.trim().length : true;
    });
    setShortenReview((cur) => (cur && cur.id === id ? { ...cur, rows: useful } : cur));
    setShortenLoading(false);
  }

  function patchShortenRow(index: number, patch: Partial<ShortenRow>) {
    setShortenReview((s) =>
      s ? { ...s, rows: s.rows.map((r, i) => (i === index ? { ...r, ...patch } : r)) } : s,
    );
  }
  function setAllShortenAccepted(accepted: boolean) {
    setShortenReview((s) => (s ? { ...s, rows: s.rows.map((r) => ({ ...r, accepted })) } : s));
  }

  function applyShorten() {
    const review = shortenReview;
    if (!review) return;
    const accepted = review.rows.filter(
      (r) => r.accepted && r.shortened.trim() && r.shortened.trim() !== r.original.trim(),
    );
    if (accepted.length) {
      setDoc((d) => ({
        ...d,
        experience: d.experience.map((entry, ei) => {
          const forEntry = accepted.filter((r) => r.ei === ei);
          if (!forEntry.length) return entry;
          return {
            ...entry,
            bullets: entry.bullets.map((bullet, bi) => {
              const row = forEntry.find((r) => r.bi === bi);
              return row ? row.shortened.trim() : bullet;
            }),
          };
        }),
      }));
      track("resume_feedback_suggestion_applied", {
        rule_id: review.p.ruleId,
        category: review.p.category,
        severity: review.p.severity,
        section: "experience",
      });
      touch();
      flashApplied(`Applied ${accepted.length} rewrite${accepted.length === 1 ? "" : "s"} to Experience`);
    }
    markSuggestionApplied(review.id, review.p, "accepted");
    setShortenReview(null);
    setShortenLoading(false);
  }

  function cancelShorten() {
    setShortenReview(null);
    setShortenLoading(false);
  }

  // The fit panel's "Biggest lever" turns missing posting keywords into a real
  // action: merge the genuinely-new ones into Skills (deduped) while the user
  // stays in their current review flow.
  // Toggle a suggested keyword in/out of the set to add (default: all selected).
  function toggleExcludedKeyword(term: string) {
    setExcludedKeywords((prev) => {
      const next = new Set(prev);
      if (next.has(term)) next.delete(term);
      else next.add(term);
      return next;
    });
  }
  function addKeywordsToSkills(terms: string[]) {
    const incoming = terms.map((s) => s.trim()).filter(Boolean);
    if (!incoming.length) return;
    const have = new Set(
      [...(doc.skills ?? []), ...(doc.skillGroups ?? []).flatMap((g) => g.skills)]
        .map((s) => s.trim().toLowerCase())
        .filter(Boolean),
    );
    const fresh = incoming.filter((s) => !have.has(s.toLowerCase()));
    // Always record them as handled (so the card shows them done), even if a term
    // was already present — the user's intent is satisfied either way.
    setAddedKeywords((prev) => new Set([...prev, ...incoming]));
    // Reset the selection so any keywords left over (deselected this round) default
    // back to selected — avoids a stale "Add 0 to skills" dead-end after a subset add.
    setExcludedKeywords(new Set());
    if (!fresh.length) {
      setPendingJump(previewAnchorFor("skills"));
      flashApplied("Those keywords are already in your Skills", "skills");
      return;
    }
    setDoc((d) => {
      const merged = Array.from(new Set([...(d.skills ?? []), ...fresh]));
      if (d.skillGroups?.length) {
        return {
          ...d,
          skills: merged,
          skillGroups: d.skillGroups.map((g, i) =>
            i === 0 ? { ...g, skills: [...g.skills, ...fresh] } : g,
          ),
        };
      }
      return { ...d, skills: merged };
    });
    touch();
    setPendingJump(previewAnchorFor("skills"));
    flashAppliedPreview("skills", "", fresh.join(", "), fresh);
    flashApplied(`Added ${fresh.length} keyword${fresh.length === 1 ? "" : "s"} to Skills`, "skills");
  }

  // Review an added keyword: keep it (sign-off) or remove it (revert from Skills).
  // Either way it counts as reviewed in the change banner.
  function keepAllKeywords(terms: string[]) {
    setKeywordDecisions((prev) => {
      const next = { ...prev };
      for (const t of terms) if (!next[t]) next[t] = "kept";
      return next;
    });
    flashApplied(`Kept ${terms.length} keyword${terms.length === 1 ? "" : "s"} in Skills`);
  }
  function removeAddedKeyword(term: string) {
    const low = term.trim().toLowerCase();
    setKeywordDecisions((prev) => ({ ...prev, [term]: "removed" }));
    setDoc((d) => ({
      ...d,
      skills: (d.skills ?? []).filter((s) => s.trim().toLowerCase() !== low),
      skillGroups: d.skillGroups?.map((g) => ({
        ...g,
        skills: g.skills.filter((s) => s.trim().toLowerCase() !== low),
      })),
    }));
    touch();
    flashApplied(`Removed "${term}" from Skills`);
  }

  function applySuggestionDraft(p: ProofPoint, target: EditableSection, draft: string) {
    const text = draft.trim();
    if (!text) return;
    const id = suggestionId(p);
    let jumpEntry = 0; // which list entry the edit landed on (for the page jump)
    let flashAnchor = previewAnchorFor(target, jumpEntry);
    let flashBefore = p.quote ?? "";
    let flashAfter = text;
    let flashAdditions: string[] | undefined;
    if (target === "experience") {
      const hit = findQuotedBullet(doc, p.quote);
      jumpEntry = hit?.ei ?? 0;
      const bulletText = cleanBulletText(text);
      flashAnchor = hit ? `exp-${hit.ei}-bullet-${hit.bi}` : previewAnchorFor("experience", jumpEntry);
      flashBefore = hit ? doc.experience[hit.ei]?.bullets[hit.bi] ?? p.quote ?? "" : "";
      flashAfter = bulletText;
      setDoc((d) => {
        if (hit && d.experience[hit.ei]?.bullets[hit.bi] != null) {
          return {
            ...d,
            experience: d.experience.map((entry, ei) =>
              ei === hit.ei
                ? {
                    ...entry,
                    bullets: entry.bullets.map((bullet, bi) => (bi === hit.bi ? bulletText : bullet)),
                  }
                : entry,
            ),
          };
        }
        if (d.experience.length) {
          return {
            ...d,
            experience: d.experience.map((entry, ei) =>
              ei === 0 ? { ...entry, bullets: [...entry.bullets, bulletText] } : entry,
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
              bullets: [bulletText],
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
      const quote = p.quote?.trim();
      flashAnchor = "summary";
      flashBefore = quote && doc.summary.includes(quote) ? quote : doc.summary;
      flashAfter = text;
      setDoc((d) => {
        if (quote && d.summary.includes(quote)) {
          return { ...d, summary: d.summary.replace(quote, text) };
        }
        // A summary draft is a complete rewrite — replace the whole summary rather
        // than appending (which stacked two summaries). Empty summary -> just sets it.
        return { ...d, summary: text };
      });
    } else if (target === "header") {
      const headline = normalizeHeadline(text.split(/\r?\n/)[0], role) || doc.headline;
      flashAnchor = "header";
      flashBefore = doc.headline;
      flashAfter = headline;
      setDoc((d) => ({ ...d, headline: normalizeHeadline(text.split(/\r?\n/)[0], role) || d.headline }));
    } else if (target === "skills") {
      const incoming = parseSkillInput(text).map(stripSkillLabel).filter(Boolean);
      const have = new Set(
        [...(doc.skills ?? []), ...(doc.skillGroups ?? []).flatMap((g) => g.skills)]
          .map((s) => s.trim().toLowerCase())
          .filter(Boolean),
      );
      const fresh = incoming.map((s) => s.trim()).filter((s) => s && !have.has(s.toLowerCase()));
      flashAnchor = "skills";
      flashBefore = "";
      flashAfter = fresh.join(", ");
      flashAdditions = fresh;
      setDoc((d) => {
        // Converge into existing skills: add only genuinely-new ones (deduped,
        // case-insensitive) and fold them into the first existing group rather
        // than spawning a separate "Suggested additions" group.
        if (!fresh.length) return d;
        const merged = Array.from(new Set([...(d.skills ?? []), ...fresh]));
        if (d.skillGroups?.length) {
          return {
            ...d,
            skills: merged,
            skillGroups: d.skillGroups.map((g, i) =>
              i === 0 ? { ...g, skills: [...g.skills, ...fresh] } : g,
            ),
          };
        }
        return { ...d, skills: merged };
      });
    } else if (target === "projects") {
      const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
      const name = (lines[0] ?? "Suggested project").replace(/^project name:\s*/i, "");
      const description = (lines.slice(1).join(" ") || lines[0] || text).replace(/^result:\s*/i, "");
      flashAnchor = previewAnchorFor("projects");
      flashAfter = description;
      setDoc((d) => ({
        ...d,
        projects: [...(d.projects ?? []), { name, description }],
      }));
    } else if (target === "education") {
      const [degree = text, school = "", dates = ""] = text.split(/,\s*/);
      flashAnchor = previewAnchorFor("education");
      flashAfter = [degree, school, dates].filter(Boolean).join(", ");
      setDoc((d) => ({
        ...d,
        education: [...(d.education ?? []), { degree, school, dates }],
      }));
    } else if (target === "certifications") {
      const [name = text, issuer = "", date = ""] = text.split(/,\s*/);
      flashAnchor = previewAnchorFor("certifications");
      flashAfter = [name, issuer, date].filter(Boolean).join(", ");
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
    // Flip the preview to the page the edit landed on, so a change that moves to
    // (or spans onto) page 2 is shown rather than left off-screen on page 1.
    setPendingJump(flashAnchor);
    flashAppliedPreview(flashAnchor, flashBefore, flashAfter, flashAdditions);
    const agentDecision =
      p.suggestedRewrite?.trim() && text !== p.suggestedRewrite.trim() ? "edited" : "accepted";
    const aiRewrite = aiRewriteTarget(p);
    if (aiRewrite) {
      setDecisions((state) => ({
        ...state,
        [bulletKey(aiRewrite.entry, aiRewrite.bullet)]:
          agentDecision === "accepted" ? "accepted" : "edited",
      }));
    }
    markSuggestionApplied(id, p, agentDecision);
    touch();
    flashApplied(`Applied to ${SECTION_LABEL[target]}`, target);
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
    setAgentSuggestionDecisions({});
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
        const r = await onSave({ doc: docToSave, decisions, agentReview: currentAgentReview, userEdited: true });
        ok = r.ok;
        error = r.error;
      } else {
        const res = await fetch(`/api/applications/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ doc: docToSave, decisions, agentReview: currentAgentReview, userEdited: true }),
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

  // Must-have posting keywords missing from the resume — surfaced as a Skills
  // suggestion (the "lever") so the action lives in its section, with a nav badge.
  const missingKeywords = (fit?.keywords ?? [])
    .filter((k) => !k.inResume)
    .map((k) => k.term)
    .slice(0, 8);
  // Keywords already added to Skills this session are AI changes pending review
  // (keep / remove); the rest are still unadded suggestions.
  const unaddedKeywords = missingKeywords.filter((t) => !addedKeywords.has(t));
  const addedKwList = missingKeywords.filter((t) => addedKeywords.has(t));
  const kwPending = addedKwList.filter((t) => !keywordDecisions[t]);

  // A posting-aware Summary suggestion: rework the summary to target the role and
  // its must-have keywords. Synthesized from the fit (the rules engine is résumé-
  // only) and threaded through the normal suggestion card, so "Draft fix with AI"
  // rewrites the summary toward the posting. Dropped once applied.
  const summaryFitPoint: ProofPoint | null =
    kind === "application" && missingKeywords.length > 0 && (doc.summary?.trim()?.length ?? 0) > 0
      ? {
          title: "Tailor your summary to this posting",
          summary:
            "Your summary reads generically. It is the first thing a recruiter reads, so pointing it at this role (and the keywords it screens for) lifts your fit right away.",
          why: "Recruiters and ATS weigh the summary heavily; one aimed at the posting signals fit in the first few seconds.",
          fix: `Rework your summary to target ${role || "this role"}, working in the keywords this posting screens for where you genuinely have them: ${missingKeywords.slice(0, 6).join(", ")}.`,
          severity: "high",
          ruleId: "summary_tailor_to_posting",
          category: "summary",
          targetSection: "summary",
        }
      : null;
  // The full surfaced set = deterministic findings + the synthesized summary point.
  const allShown =
    summaryFitPoint && !appliedSuggestionIds.has(suggestionId(summaryFitPoint))
      ? [summaryFitPoint, ...shownPoints]
      : shownPoints;
  const activeAgentShown = hasAgentPasses
    ? allShown.filter((p) => p.agentId === activeAgentPass)
    : allShown;
  const agentProgress = Object.fromEntries(
    AGENT_PASS_ORDER.map((id) => {
      const total = agentProofPoints.filter((p) => p.agentId === id).length;
      const unresolved = allShown.filter((p) => p.agentId === id).length;
      const reviewed = Math.max(0, total - unresolved);
      return [id, { reviewed, total, complete: total > 0 && unresolved === 0 }];
    }),
  ) as AgentReviewState["agentPassProgress"];
  const currentAgentReview: AgentReviewState | undefined = hasAgentPasses
    ? {
        agentSuggestions: agentSuggestionDecisions,
        activeAgentPass,
        agentPassProgress: agentProgress,
      }
    : undefined;
  const activeAgentPassData =
    availableAgentPasses.find((pass) => pass.id === activeAgentPass) ?? availableAgentPasses[0] ?? null;
  const feedbackShown = hasAgentPasses ? allShown.filter((p) => p.agentId) : allShown;
  const agentSectionChanges = hasAgentPasses
    ? (["header", "summary", "experience", "projects", "education", "certifications", "skills"] as Section[])
        .map((key) => ({
          key,
          label: SECTION_LABEL[key],
          badge: feedbackShown.filter((p) => suggestionTarget(p) === key).length,
        }))
        .filter((item) => item.badge > 0)
    : [];
  const allAgentPassesReviewed =
    hasAgentPasses &&
    availableAgentPasses.every((pass) => {
      const progress = agentProgress[pass.id];
      return !progress.total || progress.complete;
    });
  // Aggregate progress across all three passes, for the panel's progress meter.
  const agentTotal = AGENT_PASS_ORDER.reduce((sum, id) => sum + (agentProgress[id]?.total ?? 0), 0);
  const agentReviewed = AGENT_PASS_ORDER.reduce(
    (sum, id) => sum + (agentProgress[id]?.reviewed ?? 0),
    0,
  );
  // The first pass that still has open suggestions, in Ada → Remy → Max order.
  // Used to point the user at the next pass once the active one is cleared.
  const nextIncompletePass =
    availableAgentPasses.find((pass) => {
      const pr = agentProgress[pass.id];
      return pr && pr.total > 0 && !pr.complete;
    }) ?? null;

  // Suggestions that belong to a given section (deterministic findings carry a
  // targetSection), rendered inline at the top of that section's panel.
  const sectionFixes = (s: Section): ProofPoint[] =>
    (hasAgentPasses ? activeAgentShown : allShown).filter((p) => suggestionTarget(p) === s);
  // Nav badges count what each section surfaces inline: its suggestions, the
  // Experience AI rewrites (diffs), and the Skills keyword suggestions + reviews.
  const skillsKwAttention = unaddedKeywords.length + kwPending.length;
  const includePendingDiffs = !hasAgentPasses;
  const includeSkillKeywords = !hasAgentPasses || activeAgentPass === "ada_ats";
  const sectionBadge = (s: Section): number | undefined => {
    const n =
      sectionFixes(s).length +
      (s === "experience" && includePendingDiffs ? totalPending : 0) +
      (s === "skills" && includeSkillKeywords ? skillsKwAttention : 0);
    return n || undefined;
  };
  const NAV: { key: Section; label: string; badge?: number }[] = [
    { key: "header", label: "Header", badge: sectionBadge("header") },
    { key: "summary", label: "Summary", badge: sectionBadge("summary") },
    { key: "experience", label: "Experience", badge: sectionBadge("experience") },
    { key: "projects", label: "Projects", badge: sectionBadge("projects") },
    { key: "education", label: "Education", badge: sectionBadge("education") },
    { key: "certifications", label: "Certifications", badge: sectionBadge("certifications") },
    { key: "skills", label: "Skills", badge: sectionBadge("skills") },
  ];
  // Feedback is a top-level tab now (not a nav row); its label/badge live there.
  const feedbackLabel = hasAgentPasses ? "3 Agent Review" : onGetFeedback ? "Feedback" : "Suggestions";
  const showFeedbackTab = hasAgentPasses || allShown.length > 0 || Boolean(onGetFeedback);
  // Total open changes across every section (suggestions + Experience rewrites +
  // Skills keyword actions) — drives the Feedback tab badge and the by-section
  // summary inside it, so both match the per-section nav badges.
  const sectionsWithChanges = hasAgentPasses ? agentSectionChanges : NAV.filter((n) => n.badge);
  const totalOpenChanges = sectionsWithChanges.reduce((sum, n) => sum + (n.badge ?? 0), 0);

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
  // Tapping the directional arrow jumps to whatever is off-screen: a highlighted
  // finding, else the section being edited. User-initiated, so it's the one time
  // we scroll the page to a preview block (section clicks never auto-scroll).
  function jumpToArrowTarget() {
    const target =
      previewRef.current?.querySelector(".mcv-hl") ||
      (editingAnchor
        ? docWrapRef.current?.querySelector(`[data-field="${editingAnchor}"]`)
        : null);
    (target as HTMLElement | null)?.scrollIntoView({ behavior: "smooth", block: "center" });
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

  // Re-apply the locked highlight after the preview re-renders, so the targeted
  // line stays lit while the draft is open. Defined after highlightFinding so the
  // compiler can track it.
  useEffect(() => {
    if (!lockedFinding) return;
    const raf = requestAnimationFrame(() =>
      highlightFinding(lockedFinding.quote, lockedFinding.section),
    );
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lockedFinding, doc]);

  const reviewableChangeCount = collectChanges().length;
  // AI-changes review progress — surfaced in a banner across the top of the editor
  // (above the mode tabs) so "review your changes" is the first thing you see.
  // The review banner spans every AI-driven change: bullet rewrites AND keywords
  // added to Skills. Each added keyword is "pending" until kept or removed, so the
  // count reads e.g. "0 of 8 reviewed" right after a bulk keyword add.
  const agentTotalChanges = hasAgentPasses
    ? availableAgentPasses.reduce((sum, pass) => sum + (agentProgress[pass.id]?.total ?? 0), 0)
    : 0;
  const agentReviewedChanges = hasAgentPasses
    ? availableAgentPasses.reduce((sum, pass) => sum + (agentProgress[pass.id]?.reviewed ?? 0), 0)
    : 0;
  const totalChanges = hasAgentPasses ? agentTotalChanges : bulletDiffs.length + addedKwList.length;
  const reviewedChanges = hasAgentPasses
    ? agentReviewedChanges
    : totalChanges - (totalPending + kwPending.length);
  const pendingChanges = Math.max(0, totalChanges - reviewedChanges);
  const reviewProgressLabel = hasAgentPasses ? "agent changes reviewed" : "AI changes reviewed";
  const reviewProgressNode =
    totalChanges > 0 ? (
      <span
        className={"tmE-reviewprog" + (pendingChanges === 0 ? " is-done" : "")}
        data-testid="revision-reviewed-count"
        title={`${reviewedChanges} of ${totalChanges} ${reviewProgressLabel}`}
      >
        {pendingChanges === 0 ? <Check size={13} /> : <ListChecks size={13} />}
        <span className="tmE-reviewprog-dots" aria-hidden="true">
          {Array.from({ length: totalChanges }).map((_, i) => (
            <i key={i} className={i < reviewedChanges ? "is-done" : ""} />
          ))}
        </span>
        <span className="tmE-reviewprog-label">
          {reviewedChanges} of {totalChanges} {reviewProgressLabel}
        </span>
      </span>
    ) : null;
  const wideEditMode =
    mode !== "edit" || // Design + Feedback want the wider working layout
    section === "summary" ||
    section === "experience" ||
    section === "projects" ||
    section === "education" ||
    section === "certifications" ||
    section === "skills";

  // One suggestion card, reused by the Feedback tab AND each section panel, so a
  // finding shows up inside the section it belongs to. Closes over the draft/apply
  // handlers; `i` drives the fade-in stagger.
  const renderFix = (p: ProofPoint, i: number) => {
    const target = suggestionTarget(p);
    const id = suggestionId(p);
    const draft = suggestionDrafts[id];
    const rewriting = rewritingIds.has(id);
    // [bracket] slots in the draft the user must fill before applying.
    const phCount = draft ? (draft.match(/\[[^\]]+\]/g) || []).length : 0;
    // "Adds content" = net-new material (keywords, a summary), not a rework/removal.
    const fixText = `${p.title} ${p.category ?? ""} ${p.summary ?? ""} ${p.fix ?? ""}`.toLowerCase();
    const addsContent =
      !p.quote &&
      /\b(?:add|include|incorporate|introduce|missing|lack|absent)\b/.test(fixText) &&
      !/\b(?:trim|cut|remov|delet|drop|shorten|condens|quantif|metric|measur|number|spac|whitespace|format|capitali|casing|punctuat|consisten|align|reorder|reorganiz|rephras|reword|clarif|overlap|date|grammar|typo|tense)/.test(
        fixText,
      );
    const agentKey = agentSuggestionKey(p);
    const isAgentFix = Boolean(agentKey && p.agentId);
    const isAiRewriteFix = Boolean(aiRewriteTarget(p));
    // Jump to this finding's section in the editor (header gaps land on the field).
    const goEditManually = () => {
      track("resume_feedback_suggestion_clicked", {
        rule_id: p.ruleId,
        category: p.category,
        severity: p.severity,
        section: target,
      });
      setMode("edit");
      setSection(target);
      if (p.ruleId === "header_missing_name") focusHeaderField("name");
      else if (p.ruleId === "header_missing_title") focusHeaderField("headline");
      else if (p.ruleId === "header_missing_location") focusHeaderField("location");
      else if (p.ruleId === "header_missing_phone") focusHeaderField("phone");
      else if (p.ruleId === "header_missing_email") focusHeaderField("email");
    };
    return (
      <div
        key={id}
        className="tmE-fix tmE-fix--in"
        style={{ animationDelay: `${Math.min(i * 70, 700)}ms` }}
        data-testid="feedback-suggestion"
        data-suggestion-title={p.title}
        data-rule-id={p.ruleId ?? ""}
        onMouseEnter={() => highlightFinding(p.quote, target)}
        onMouseLeave={() =>
          lockedFinding ? highlightFinding(lockedFinding.quote, lockedFinding.section) : clearHighlight()
        }
      >
        <div className="tmE-fix-titlerow">
          <b>{p.title}</b>
          <span
            className={"tmE-fix-kind " + (addsContent ? "tmE-fix-kind--add" : "tmE-fix-kind--edit")}
            title={
              addsContent
                ? "Adds new content — nothing in your resume is replaced"
                : "Reworks text already in your resume"
            }
          >
            {addsContent ? (
              <>
                <Plus size={11} /> Adds content
              </>
            ) : (
              <>
                <PenLine size={11} /> Rewrites
              </>
            )}
          </span>
          {p.agentPersona && (
            <span className={`tmE-agent-chip is-${p.agentId ?? "agent"}`}>
              {p.agentPersona}
            </span>
          )}
        </div>
        {p.summary && <p className="tmE-fix-sum">{p.summary}</p>}
        {p.quote && (
          <p className="tmE-fix-quote" title={`From your ${SECTION_LABEL[target]} section`}>
            “{p.quote}”
          </p>
        )}
        {p.fix && (
          <p className="tmE-fix-fix">
            <span>Fix:</span> {p.fix}
          </p>
        )}
        {p.truthfulnessRisk === "needs_user_input" && (
          <p className="tmE-fix-note">
            <AlertTriangle size={12} /> Only add real metrics you can support.
          </p>
        )}
        <div className="tmE-fix-card-actions">
          {/* One clear primary action. For an AI rewrite that's Accept (keep it);
              otherwise it's the AI draft; for a header gap it's the manual jump. */}
          {isAiRewriteFix ? (
            <button
              type="button"
              className="tmE-fix-apply is-primary"
              onClick={() => decideAiRewriteSuggestion(p, "accepted")}
            >
              <Check size={13} /> Accept
            </button>
          ) : canAiDraft(p) ? (
            <button
              type="button"
              className="tmE-fix-apply"
              onClick={() =>
                bulletReviewMode(p) ? void openBulletReview(p) : openSuggestionDraft(p, target)
              }
            >
              <PenLine size={13} />{" "}
              {bulletReviewMode(p) === "shorten"
                ? "Shorten bullets with AI"
                : bulletReviewMode(p) === "quantify"
                  ? "Add metrics with AI"
                  : draft == null
                    ? "Draft fix with AI"
                    : "Edit draft"}
            </button>
          ) : (
            <button type="button" className="tmE-fix-apply" onClick={goEditManually}>
              Edit manually →
            </button>
          )}
          {/* Quiet secondary actions: tweak, jump to the section, or dismiss.
              Omitted entirely for a header gap (its only action is the primary). */}
          {(isAiRewriteFix || canAiDraft(p) || isAgentFix) && (
          <div className="tmE-fix-actions-minor">
            {isAiRewriteFix && (
              <button
                type="button"
                className="tmE-fix-goto"
                onClick={() => openSuggestionDraft(p, target)}
              >
                Edit
              </button>
            )}
            {!isAiRewriteFix && canAiDraft(p) && (
              <button type="button" className="tmE-fix-goto" onClick={goEditManually}>
                Edit manually →
              </button>
            )}
            {isAiRewriteFix ? (
              <button
                type="button"
                className="tmE-fix-goto"
                onClick={() => decideAiRewriteSuggestion(p, "rejected")}
              >
                Reject
              </button>
            ) : (
              isAgentFix && (
                <button
                  type="button"
                  className="tmE-fix-goto"
                  onClick={() => {
                    markAgentSuggestionDecision(p, "resolved");
                    flashApplied(`${p.agentPersona ?? "Agent"} suggestion dismissed`);
                  }}
                >
                  Dismiss
                </button>
              )
            )}
          </div>
          )}
        </div>
        {draft != null && (
          <div className="tmE-suggestion-draft">
            <label>Draft</label>
            {rewriting ? (
              <p className="tmE-draft-hint tmE-draft-hint--ai">
                <Loader2 size={12} className="tmE-draft-spin" /> Drafting a rewrite with AI…
              </p>
            ) : (
              phCount > 0 && (
                <p className="tmE-draft-hint">
                  <span className="tmE-draft-token">[ ]</span>
                  {phCount === 1
                    ? "1 highlighted spot needs your details"
                    : `${phCount} highlighted spots need your details`}{" "}
                  before applying.
                </p>
              )
            )}
            <div className={"tmE-draft-input" + (phCount > 0 ? " has-ph" : "")}>
              {phCount > 0 && (
                <div className="tmE-draft-marks" aria-hidden="true">
                  {draft.split(/(\[[^\]]+\])/g).map((seg, j) =>
                    /^\[[^\]]+\]$/.test(seg) ? (
                      <mark key={j} className="tmE-ph">
                        {seg}
                      </mark>
                    ) : (
                      <span key={j}>{seg}</span>
                    ),
                  )}
                  {"\n"}
                </div>
              )}
              <textarea
                className={"tmE-textarea tmE-draft-ta" + (phCount > 0 ? " tmE-textarea--hasplaceholder" : "")}
                value={draft}
                onChange={(e) => updateSuggestionDraft(id, e.target.value)}
                onScroll={(e) => {
                  const marks = e.currentTarget.parentElement?.querySelector(".tmE-draft-marks");
                  if (marks instanceof HTMLElement) {
                    marks.scrollTop = e.currentTarget.scrollTop;
                    marks.scrollLeft = e.currentTarget.scrollLeft;
                  }
                }}
              />
            </div>
            <div className="tmE-fix-card-actions">
              <button
                type="button"
                className="tmE-fix-apply is-primary"
                onClick={() => applySuggestionDraft(p, target, draft)}
                disabled={!draft.trim() || rewriting}
              >
                <Check size={13} /> Apply to {SECTION_LABEL[target]}
              </button>
              <button type="button" className="tmE-fix-goto" onClick={() => closeSuggestionDraft(id)}>
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    );
  };
  return (
    <div className={"tmE-wrap" + (wideEditMode ? " is-workmode" : "")}>
      {applied && (
        <div className="tmE-applied-toast" role="status" aria-live="polite">
          <Check size={14} /> <span>{applied.text}</span>
          {applied.target && (
            <button
              type="button"
              onClick={() => {
                setMode("edit");
                setSection(applied.target!);
              }}
            >
              Edit {SECTION_LABEL[applied.target]}
            </button>
          )}
        </div>
      )}
      <div className="tmE-head">
        <Link className="tmE-back" href={backHref}>
          <ArrowLeft size={15} /> {backLabel}
        </Link>
        <div className="tmE-head-title">
          <h1>
            {kind === "resume" ? doc.headline?.trim() || "Base resume" : role}
            {company && <span className="tmE-head-co"> at {company}</span>}
          </h1>
          {(allShown.length > 0 || originalDoc) && (
            <button
              type="button"
              className="tmE-optimized"
              onClick={() => setMode("feedback")}
              title="This resume has AI feedback — open the Feedback tab"
            >
              <Sparkles size={12} /> Optimized resume
            </button>
          )}
        </div>
        <div className="tmE-head-right">
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
          {/* Save lives on the preview's bottom-left pill (tmE-saved), so no
              duplicate save button up here. */}
        </div>
      </div>

      {/* A quiet progress strip. The standalone "Review N changes" CTA was removed
          as a duplicate of the "3 Agent Review" mode tab below (which carries the
          same count + an attention pulse) — one clear path into review, not two. */}
      {kind === "application" && reviewProgressNode && (
        <div className={"tmE-reviewbar tmF-anim" + (pendingChanges === 0 ? " is-done" : "")}>
          {reviewProgressNode}
        </div>
      )}

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
            {totalOpenChanges > 0 && (
              <span className="tmE-modetab-badge">{totalOpenChanges}</span>
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
        <div className="tmE-main" ref={editMainRef}>
          {kind === "application" && fit && (
            <div className="tmF-anim" style={{ marginBottom: "14px" }}>
              <FitPanel
                fit={fit}
                history={fitHistory}
                onRecheck={canRecheck ? runRecheck : undefined}
                rechecking={rechecking}
                pendingChanges={dirty}
                onReviewKeywords={() => {
                  setMode("edit");
                  setSection("skills");
                }}
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
              {sectionFixes("header").length > 0 && (
                <div className="tmE-secfixes">{sectionFixes("header").map((p, i) => renderFix(p, i))}</div>
              )}
              <div className="tmE-field">
                <label>Name</label>
                <input ref={nameInputRef} className="tmE-input" value={doc.name} onChange={(e) => patch({ name: e.target.value })} />
              </div>
              <div className="tmE-field">
                <label>Headline</label>
                <input ref={headlineInputRef} className="tmE-input" value={doc.headline} onChange={(e) => patch({ headline: e.target.value })} />
              </div>
              <label className="tmE-field-grouplabel">Contact</label>
              <div className="tmE-contact-grid">
                <div className="tmE-field" style={{ marginBottom: 0 }}>
                  <label>Phone</label>
                  <input ref={phoneInputRef} className="tmE-input" value={contactFields.phone} placeholder="612-227-1149" onChange={(e) => updateContact({ phone: e.target.value })} />
                </div>
                <div className="tmE-field" style={{ marginBottom: 0 }}>
                  <label>Email</label>
                  <input ref={emailInputRef} className="tmE-input" type="email" value={contactFields.email} placeholder="you@email.com" onChange={(e) => updateContact({ email: e.target.value })} />
                </div>
                <div className="tmE-field" style={{ marginBottom: 0 }}>
                  <label>City / State</label>
                  <input ref={locationInputRef} className="tmE-input" value={contactFields.location} placeholder="Portland, OR" onChange={(e) => updateContact({ location: e.target.value })} />
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
              {sectionFixes("summary").length > 0 && (
                <div className="tmE-secfixes">{sectionFixes("summary").map((p, i) => renderFix(p, i))}</div>
              )}
              <div className="tmE-field">
                <textarea className="tmE-textarea tmE-textarea--lg" value={doc.summary} onChange={(e) => patch({ summary: e.target.value })} />
              </div>
            </section>
          )}

          {section === "experience" && (
            <section className="tmE-panel tmF-anim">
              <h2 className="tmE-panel-title">Experience</h2>
              <p className="tmE-panel-sub">
                {bulletDiffs.length > 0 && !hasAgentPasses
                  ? "These AI rewrites are already in your resume. Keep each one, or revert to your original wording (struck-through words were removed, green words were added)."
                  : "Edit any line. Highlighted text in the preview shows posting keywords and metrics."}
              </p>
              {sectionFixes("experience").length > 0 && (
                <div className="tmE-secfixes">{sectionFixes("experience").map((p, i) => renderFix(p, i))}</div>
              )}
              {doc.experience.map((e, ei) => {
                const open = openEntries.has(ei);
                const meta = [e.company, cleanResumeDate(e.dates)].filter(Boolean).join(" · ");
                // Unreviewed AI rewrites in this entry — so the collapsed header shows
                // where the suggested edits are without opening everything.
                const entryEdits = bulletDiffs.filter(
                  (d) => d.entry === ei && !decisions[bulletKey(d.entry, d.bullet)],
                ).length;
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
                    {entryEdits > 0 && (
                      <span
                        className="tmE-entry-edits"
                        title={`${entryEdits} suggested edit${entryEdits === 1 ? "" : "s"} to review`}
                      >
                        <PenLine size={11} /> {entryEdits} edit{entryEdits === 1 ? "" : "s"}
                      </span>
                    )}
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
                      if (!diff || hasAgentPasses) {
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
                          <div className="tmE-diff-head">
                            <span className="tmE-diff-kind">
                              <Sparkles size={11} /> AI rewrite
                            </span>
                            <span className={"tmE-diff-status is-" + (decision || "applied")}>
                              {decision === "accepted"
                                ? "Kept"
                                : decision === "rejected"
                                  ? "Reverted to original"
                                  : decision === "edited"
                                    ? "Your edit"
                                    : "Applied"}
                            </span>
                          </div>
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
                              className={"tmE-diff-btn is-accept" + (decision === "accepted" ? " is-on" : "")}
                              onClick={() => decide(ei, bi, "accepted")}
                              aria-pressed={decision === "accepted"}
                              data-testid={`revision-accept-${ei}-${bi}`}
                              title="Keep this AI change"
                            >
                              <Check size={13} /> Keep
                            </button>
                            <button
                              type="button"
                              className={"tmE-diff-btn is-reject" + (decision === "rejected" ? " is-on" : "")}
                              onClick={() => decide(ei, bi, "rejected")}
                              aria-pressed={decision === "rejected"}
                              data-testid={`revision-reject-${ei}-${bi}`}
                              title="Restore your original wording"
                            >
                              <X size={13} /> Revert
                            </button>
                            <button
                              type="button"
                              className={"tmE-diff-btn is-edit" + (decision === "edited" ? " is-on" : "")}
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
              {sectionFixes("projects").length > 0 && (
                <div className="tmE-secfixes">{sectionFixes("projects").map((p, i) => renderFix(p, i))}</div>
              )}
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
              {sectionFixes("certifications").length > 0 && (
                <div className="tmE-secfixes">
                  {sectionFixes("certifications").map((p, i) => renderFix(p, i))}
                </div>
              )}
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
              {sectionFixes("education").length > 0 && (
                <div className="tmE-secfixes">{sectionFixes("education").map((p, i) => renderFix(p, i))}</div>
              )}
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
              {missingKeywords.length > 0 &&
                (() => {
                  // Three states: add (some still unadded) -> review (added,
                  // pending keep/remove) -> done (all reviewed). Added keywords
                  // count as AI changes in the banner until reviewed here.
                  const reviewing = unaddedKeywords.length === 0 && kwPending.length > 0;
                  const allReviewed = unaddedKeywords.length === 0 && kwPending.length === 0;
                  const keptCount = addedKwList.filter((t) => keywordDecisions[t] !== "removed").length;
                  // The unadded suggestions the user still has selected — what "Add
                  // to skills" will add. Default is all of them; deselecting drops one.
                  const selectedKeywords = unaddedKeywords.filter((t) => !excludedKeywords.has(t));
                  return (
                    <div
                      className={
                        "tmE-secsug" + (allReviewed ? " is-done" : reviewing ? " is-review" : "")
                      }
                    >
                      <div className="tmE-secsug-head">
                        <span className="tmE-secsug-eyebrow">
                          {allReviewed ? (
                            <Check size={12} />
                          ) : reviewing ? (
                            <ListChecks size={12} />
                          ) : (
                            <Sparkles size={12} />
                          )}{" "}
                          {allReviewed ? "Added" : reviewing ? "Review" : "Suggestion"}
                        </span>
                        <b>
                          {allReviewed
                            ? `${keptCount} keyword${keptCount === 1 ? "" : "s"} added to Skills`
                            : reviewing
                              ? `Review ${kwPending.length} added keyword${kwPending.length === 1 ? "" : "s"}`
                              : `Add ${unaddedKeywords.length} keyword${unaddedKeywords.length === 1 ? "" : "s"} the posting screens for`}
                        </b>
                      </div>
                      <div className="tmF-chips">
                        {missingKeywords
                          .filter((t) => keywordDecisions[t] !== "removed")
                          .map((t) => {
                            const added = addedKeywords.has(t);
                            const canRemove = added && keywordDecisions[t] !== "kept";
                            // Suggestion state: each chip is a toggle so the user can
                            // deselect the ones they don't want before adding.
                            if (!added && !reviewing && !allReviewed) {
                              const off = excludedKeywords.has(t);
                              return (
                                <button
                                  key={t}
                                  type="button"
                                  aria-pressed={!off}
                                  className={"tmEv-pill tmE-kw-toggle" + (off ? " is-off" : "")}
                                  onClick={() => toggleExcludedKeyword(t)}
                                  title={off ? `Include "${t}"` : `Skip "${t}"`}
                                >
                                  {off ? <Plus size={11} /> : <Check size={11} />} {t}
                                </button>
                              );
                            }
                            return (
                              <span
                                key={t}
                                className="tmEv-pill"
                                style={
                                  added
                                    ? {
                                        color: "var(--tm-mint-700)",
                                        background: "var(--tm-mint-50)",
                                        border: "0.5px solid rgba(33,146,107,.28)",
                                      }
                                    : {
                                        color: "#854f0b",
                                        background: "#fff",
                                        border: "0.5px solid rgba(133,79,11,.3)",
                                      }
                                }
                              >
                                {added ? <Check size={11} /> : <Plus size={11} />} {t}
                                {canRemove && (
                                  <button
                                    type="button"
                                    className="tmE-kw-x"
                                    aria-label={`Remove ${t} from Skills`}
                                    onClick={() => removeAddedKeyword(t)}
                                  >
                                    <X size={11} />
                                  </button>
                                )}
                              </span>
                            );
                          })}
                      </div>
                      <p className="tmE-secsug-note">
                        {allReviewed
                          ? "Added to your Skills below."
                          : reviewing
                            ? "Keep the ones your experience backs up; remove any it doesn't."
                            : "Tap a keyword to skip it. Add only the ones your experience genuinely backs."}
                      </p>
                      <div className="tmE-fix-card-actions">
                        {allReviewed ? (
                          <span className="tmE-secsug-done">
                            <Check size={13} /> Reviewed
                          </span>
                        ) : reviewing ? (
                          <button
                            type="button"
                            className="tmE-fix-apply"
                            onClick={() => keepAllKeywords(kwPending)}
                          >
                            <Check size={13} /> Keep all ({kwPending.length})
                          </button>
                        ) : (
                          <button
                            type="button"
                            className="tmE-fix-apply"
                            onClick={() => addKeywordsToSkills(selectedKeywords)}
                            disabled={selectedKeywords.length === 0}
                          >
                            <Plus size={13} /> Add {selectedKeywords.length} to skills
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })()}
              {sectionFixes("skills").length > 0 && (
                <div className="tmE-secfixes">{sectionFixes("skills").map((p, i) => renderFix(p, i))}</div>
              )}
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
                    {hasAgentPasses
                      ? "3 Agent Review"
                      : onGetFeedback
                        ? "Resume feedback"
                        : "Suggestions from your audit"}
                  </h2>
                  <p className="tmE-panel-sub">
                    {hasAgentPasses
                      ? "Three quick passes. Finish one, then move to the next."
                      : !onGetFeedback
                        ? "Open a card to jump to its section."
                        : feedbackLoading
                          ? "Reviewing your content…"
                          : allShown.length > 0
                            ? "Open a card to jump to its section."
                            : "Run a review to see suggestions here."}
                  </p>
                </div>
                <div className="tmE-fix-top-actions">
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
                      : !allShown.length
                        ? "Get feedback"
                        : feedbackUpToDate
                          ? "Up to date"
                          : "Refresh"}
                  </button>
                )}
                </div>
              </div>
              {hasAgentPasses && activeAgentPassData && (
                <div className="tmE-agent-review">
                  {/* One progress meter for all three passes — the single "how far
                      along am I" signal, replacing the old eyebrow + banner copy. */}
                  <div className="tmE-agent-progress">
                    <div className="tmE-agent-progress-track" aria-hidden="true">
                      <span
                        style={{
                          width: `${agentTotal ? Math.round((agentReviewed / agentTotal) * 100) : 100}%`,
                        }}
                      />
                    </div>
                    <p className="tmE-agent-progress-label">
                      {allAgentPassesReviewed
                        ? "All 3 agent passes reviewed."
                        : `${agentReviewed} of ${agentTotal} reviewed`}
                    </p>
                  </div>
                  {/* The three passes — the primary selector. Clicking one focuses
                      the card list below on just that pass (guided, one at a time). */}
                  <div className="tmE-agent-tabs" role="tablist" aria-label="3 agent review passes">
                    {availableAgentPasses.map((pass) => {
                      const progress = agentProgress[pass.id];
                      const unresolved = Math.max(0, progress.total - progress.reviewed);
                      const active = pass.id === activeAgentPass;
                      return (
                        <button
                          key={pass.id}
                          type="button"
                          role="tab"
                          aria-selected={active}
                          className={
                            "tmE-agent-tab is-" +
                            pass.id +
                            (active ? " is-active" : "") +
                            (progress.complete ? " is-done" : "")
                          }
                          onClick={() => {
                            setActiveAgentPass(pass.id);
                            setMode("feedback");
                          }}
                          data-testid={`agent-pass-${pass.id}`}
                        >
                          <span className="tmE-agent-tab-top">
                            <span className="tmE-agent-tab-name">{pass.persona}</span>
                            <span className="tmE-agent-score" title={AGENT_PASS_SCORE_HELP[pass.id]}>
                              {AGENT_PASS_SCORE_COPY[pass.id] ?? pass.scoreLabel}{" "}
                              {typeof pass.score === "number" ? `${pass.score}/100` : "--"}
                            </span>
                          </span>
                          <span className="tmE-agent-tab-status">
                            {progress.complete ? (
                              <>
                                <Check size={12} /> Reviewed
                              </>
                            ) : (
                              `${unresolved} to review`
                            )}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                  {/* One context line for the ACTIVE pass only (not all three) —
                      what this agent checks and the one specific thing it flagged. */}
                  <div className="tmE-agent-context">
                    <b>
                      {activeAgentPassData.persona} · {activeAgentPassData.specialty}
                    </b>
                    {activeAgentPassData.summary && <p>{activeAgentPassData.summary}</p>}
                    <small>{AGENT_PASS_SCORE_HELP[activeAgentPass]}</small>
                  </div>
                </div>
              )}
              {feedbackLoading && <ReviewProgress />}
              {feedbackError && <p className="tmE-fix-status">{feedbackError}</p>}
              {/* By-section jump grid — only in plain feedback mode. In agent mode the
                  cards are already focused per pass, so the grid is redundant noise. */}
              {!hasAgentPasses && sectionsWithChanges.length > 0 && (
                <div className="tmE-fixsum">
                  <p className="tmE-fixsum-head">
                    {totalOpenChanges} suggestion{totalOpenChanges === 1 ? "" : "s"} across{" "}
                    {sectionsWithChanges.length} section
                    {sectionsWithChanges.length === 1 ? "" : "s"}
                  </p>
                  <div className="tmE-fixsum-grid">
                    {sectionsWithChanges.map((n) => (
                      <button
                        key={n.key}
                        type="button"
                        className="tmE-fixsum-row"
                        onClick={() => {
                          setMode("edit");
                          setSection(n.key);
                        }}
                      >
                        <span className="tmE-fixsum-label">{n.label}</span>
                        <span className="tmE-tree-badge">{n.badge}</span>
                        <ArrowRight size={13} className="tmE-fixsum-arrow" />
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {/* Active pass cleared: confirm it, then point at the next pass (or
                  done). This is the "what's next" handoff between passes. */}
              {hasAgentPasses && activeAgentShown.length === 0 && (
                <div className="tmE-agent-done">
                  <p className="tmE-agent-done-msg">
                    <Check size={15} />{" "}
                    {activeAgentPassData
                      ? `${activeAgentPassData.persona}'s pass is complete.`
                      : "This pass is complete."}
                  </p>
                  {nextIncompletePass ? (
                    <button
                      type="button"
                      className="tmE-agent-next"
                      onClick={() => setActiveAgentPass(nextIncompletePass.id)}
                    >
                      Next: {nextIncompletePass.persona}&rsquo;s pass <ArrowRight size={14} />
                    </button>
                  ) : (
                    <p className="tmE-agent-done-sub">
                      Every pass is reviewed. Your resume is ready to download.
                    </p>
                  )}
                </div>
              )}
              {(["high", "medium", "low"] as const).map((sev) => {
                const group = activeAgentShown.filter((p) => p.severity === sev);
                if (group.length === 0) return null;
                // Global running index so cards fade in one after another across all
                // three severity groups (not restarting the stagger per group).
                const offset =
                  sev === "high"
                    ? 0
                    : activeAgentShown.filter(
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
                    {group.map((p, i) => renderFix(p, offset + i))}
                  </div>
                );
              })}
            </section>
          )}
        </div>

        {/* ---- wide résumé-only preview ---- */}
        <div className="tmE-preview" ref={previewRef} data-testid="resume-live-preview">
          {hlDir === "up" && (
            <button
              type="button"
              className="tmE-hl-arrow tmE-hl-arrow--up"
              onClick={jumpToArrowTarget}
              title="Scroll up to it"
            >
              <ChevronUp size={14} /> Jump to it
            </button>
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
                <Info size={12} /> Not part of your resume or PDF.
              </span>
            </p>
          )}
          <div className="tmE-preview-stage">
            <div className="tmE-doc-viewport" ref={viewportRef}>
              <div
                className="tmE-doc-sizer"
                style={{
                  width: docHeight != null ? `${docWidthScaled}px` : undefined,
                  height: docHeight != null ? `${docHeight}px` : undefined,
                }}
              >
                <div
                  ref={docWrapRef}
                  className="tmE-doc-scaler"
                  style={{ transform: `scale(${docScale})` }}
                >
                  <PrintDoc
                    doc={doc}
                    id={id}
                    resumeOnly
                    hideToolbar
                    markPlaceholders
                    highlightKeywords={showMatches ? previewKeywords : undefined}
                    appliedHighlights={appliedPreviewHighlights}
                  />
                </div>
                {cursorTop != null && (
                  <div className="tmE-cursor" style={{ top: `${cursorTop}px` }} aria-hidden="true">
                    <span className="tmE-cursor-badge">{avatarInitials}</span>
                  </div>
                )}
              </div>
            </div>
            {/* Saved pill floats over the scrolling résumé, bottom-right, so it
                stays visible without taking a row of its own. */}
            <button
              type="button"
              className={`tmE-saved tmE-saved--float ${saving ? "is-saving" : dirty ? "is-dirty" : "is-saved"}`}
              onClick={() => {
                if (dirty && !saving) void save();
              }}
              disabled={saving || !dirty}
              aria-live="polite"
              title={dirty ? "Save your changes" : "All changes saved"}
            >
              {saving ? (
                <>
                  <Loader2 size={12} className="tmE-saved-spin" /> Saving…
                </>
              ) : dirty ? (
                <>
                  <span className="tmE-saved-dot" aria-hidden="true" />{" "}
                  {kind === "resume" ? "Save resume" : "Save edits"}
                </>
              ) : (
                <>
                  <Check size={12} /> Saved
                </>
              )}
            </button>
            {hlDir === "down" && (
              <button
                type="button"
                className="tmE-hl-arrow tmE-hl-arrow--down"
                onClick={jumpToArrowTarget}
                title="Scroll down to it"
              >
                <ChevronDown size={14} /> Jump to it
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Batch reviewer for multi-bullet fixes (shorten / add metrics): review a
          revised version of each bullet, then apply the accepted ones at once. */}
      {shortenReview &&
        (() => {
          const acc = shortenReview.rows.filter(
            (r) => r.accepted && r.shortened.trim() && r.shortened.trim() !== r.original.trim(),
          ).length;
          const mode = shortenReview.mode;
          const title = mode === "shorten" ? "Shorten long bullets" : "Add metrics to bullets";
          const loadingText =
            mode === "shorten"
              ? "Finding and shortening your longest bullets…"
              : "Finding bullets that need a measurable result…";
          const emptyText =
            mode === "shorten"
              ? "These bullets are already concise. Nothing to shorten."
              : "Your bullets already carry numbers. Nothing to add.";
          const hasPlaceholders = shortenReview.rows.some((r) => /\[[^\]]+\]/.test(r.shortened));
          return (
            <div className="tmE-cover-backdrop" onClick={cancelShorten} role="presentation">
              <div
                className="tmE-cover-modal tmE-shorten-modal"
                role="dialog"
                aria-modal="true"
                aria-label={title}
                onClick={(e) => e.stopPropagation()}
              >
                <div className="tmE-cover-head">
                  <div>
                    <b>{title}</b>
                    <span className="tmE-shorten-sub">
                      {shortenLoading
                        ? "Drafting revised versions…"
                        : shortenReview.rows.length
                          ? `${acc} of ${shortenReview.rows.length} selected. Edit any before applying.`
                          : emptyText}
                    </span>
                  </div>
                  <button
                    type="button"
                    className="tmE-review-x"
                    onClick={cancelShorten}
                    aria-label="Close"
                  >
                    <X size={16} />
                  </button>
                </div>

                <div className="tmE-shorten-list">
                  {shortenLoading && !shortenReview.rows.length && (
                    <p className="tmE-draft-hint tmE-draft-hint--ai">
                      <Loader2 size={12} className="tmE-draft-spin" /> {loadingText}
                    </p>
                  )}
                  {!shortenLoading && mode === "quantify" && shortenReview.rows.length > 0 && (
                    <p className="tmE-draft-hint">
                      <Info size={12} /> These figures are AI estimates. Review and adjust to your
                      real numbers, then accept the ones that fit.
                    </p>
                  )}
                  {!shortenLoading && hasPlaceholders && (
                    <p className="tmE-draft-hint">
                      <span className="tmE-draft-token">[ ]</span> Fill the bracketed spots with your
                      real numbers before applying.
                    </p>
                  )}
                  {!shortenLoading && shortenReview.rows.length > 1 && (
                    <div className="tmE-shorten-bulk">
                      <button
                        type="button"
                        className="tmE-shorten-bulkbtn"
                        onClick={() => setAllShortenAccepted(true)}
                      >
                        Use all
                      </button>
                      <button
                        type="button"
                        className="tmE-shorten-bulkbtn"
                        onClick={() => setAllShortenAccepted(false)}
                      >
                        Keep all original
                      </button>
                    </div>
                  )}
                  {shortenReview.rows.map((r, i) => (
                    <div
                      key={`${r.ei}-${r.bi}`}
                      className={"tmE-shorten-row" + (r.accepted ? "" : " is-off")}
                    >
                      <div className="tmE-shorten-ctx">
                        {doc.experience[r.ei]?.role || "Role"}
                        {doc.experience[r.ei]?.company ? ` · ${doc.experience[r.ei].company}` : ""}
                      </div>
                      <p className="tmE-shorten-before">{r.original}</p>
                      {(() => {
                        const hasPh = /\[[^\]]+\]/.test(r.shortened);
                        return (
                          <div className={"tmE-draft-input" + (hasPh ? " has-ph" : "")}>
                            {hasPh && (
                              <div className="tmE-draft-marks" aria-hidden="true">
                                {r.shortened.split(/(\[[^\]]+\])/g).map((seg, j) =>
                                  /^\[[^\]]+\]$/.test(seg) ? (
                                    <mark key={j} className="tmE-ph">
                                      {seg}
                                    </mark>
                                  ) : (
                                    <span key={j}>{seg}</span>
                                  ),
                                )}
                                {"\n"}
                              </div>
                            )}
                            <textarea
                              className={
                                "tmE-textarea tmE-draft-ta tmE-shorten-after" +
                                (hasPh ? " tmE-textarea--hasplaceholder" : "")
                              }
                              value={r.shortened}
                              onChange={(e) => patchShortenRow(i, { shortened: e.target.value })}
                              onScroll={(e) => {
                                const marks =
                                  e.currentTarget.parentElement?.querySelector(".tmE-draft-marks");
                                if (marks instanceof HTMLElement) {
                                  marks.scrollTop = e.currentTarget.scrollTop;
                                  marks.scrollLeft = e.currentTarget.scrollLeft;
                                }
                              }}
                              rows={2}
                            />
                          </div>
                        );
                      })()}
                      <div className="tmE-shorten-rowactions">
                        <button
                          type="button"
                          className={"tmE-diff-btn is-accept" + (r.accepted ? " is-on" : "")}
                          onClick={() => patchShortenRow(i, { accepted: true })}
                        >
                          <Check size={13} /> Use
                        </button>
                        <button
                          type="button"
                          className={"tmE-diff-btn is-reject" + (!r.accepted ? " is-on" : "")}
                          onClick={() => patchShortenRow(i, { accepted: false })}
                        >
                          <X size={13} /> Keep original
                        </button>
                      </div>
                    </div>
                  ))}
                  {!shortenLoading && !shortenReview.rows.length && (
                    <p className="tmE-shorten-empty">{emptyText}</p>
                  )}
                </div>

                <div className="tmE-shorten-foot">
                  <button
                    type="button"
                    className="tmE-fix-apply is-primary"
                    onClick={applyShorten}
                    disabled={shortenLoading || acc === 0}
                  >
                    <Check size={13} /> Apply {acc} {acc === 1 ? "change" : "changes"}
                  </button>
                  <button type="button" className="tmE-fix-goto" onClick={cancelShorten}>
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          );
        })()}

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
