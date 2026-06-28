// Deterministic resume feedback: render the structured doc to LaTeX, run the
// rules engine over it, and fold in any legacy (LLM) proof points — deduped,
// ranked, and capped. Pure of network/LLM calls, so it can run at import time
// (zero token cost) AND inside the feedback route (alongside the LLM parse).
// Shared so import and the editor produce the SAME suggestions for one doc.

import { renderResumeTex } from "@/lib/apply/latex";
import { evaluateResumeRules } from "@/lib/resume-rules/evaluateResumeRules";
import type { ResumeRuleFinding } from "@/lib/resume-rules/resumeAdviceRule.types";
import { parseContact } from "@/lib/apply/contact";
import type { ProofPoint, TailoredDoc } from "@/lib/types";

// Bump when the rules/routing change so stale cached feedback is recomputed.
export const FEEDBACK_CACHE_VERSION = "rules-v3-bullet-evidence-routing";

// Safe, content-free funnel counts for telemetry (rules → candidates →
// deduped → surfaced). NEVER includes résumé text or evidence snippets.
export interface FeedbackStats {
  rulesLoaded: number;
  candidates: number;
  deduped: number;
  surfaced: number;
  suppressed: number;
}

// Map a surfaced rules-engine finding back to the editor's ProofPoint shape.
function findingToProofPoint(f: ResumeRuleFinding): ProofPoint {
  return {
    title: f.title,
    summary: f.message,
    quote: f.evidenceSnippet || undefined,
    why: f.whyItMatters,
    fix: f.suggestedFix,
    severity: f.uiSeverityLabel.toLowerCase() as ProofPoint["severity"],
    // Carry rule provenance so the editor can emit per-suggestion telemetry
    // (which rules users act on). Safe ids/categories only — never content.
    ruleId: f.ruleId,
    category: f.category,
    targetSection: f.targetSection,
  };
}

// LLM findings sometimes assert a fabricated count ("Quantify 28 bullets", "Trim
// 4 low-relevance bullets") that rarely matches the actual doc. Strip such counts
// from legacy (no-ruleId) titles so we never surface a hallucinated number. The
// lookbehind leaves real thresholds intact ("exceed 2 lines", "up to 3 items").
function stripUnverifiableCounts(p: ProofPoint): ProofPoint {
  if (p.ruleId) return p; // rules-engine counts are computed, not guessed
  const title = p.title
    .replace(
      /(?<!\b(?:than|over|under|exceeds?|least|most|up to|within|to)\s)\b\d+\s+(?=(?:[a-z-]+\s+){0,2}(?:bullets?|lines?|items?|points?)\b)/gi,
      "",
    )
    .replace(/\s{2,}/g, " ")
    .trim();
  return title === p.title ? p : { ...p, title };
}

function normalizedQuote(value: string | undefined): string {
  return (value ?? "")
    .toLowerCase()
    .replace(/^[\s•*\-–—]+/, "")
    .replace(/\s+/g, " ")
    .trim();
}

function quoteMatchesEditableBullet(doc: TailoredDoc, quote: string | undefined): boolean {
  const q = normalizedQuote(quote);
  if (q.length < 8) return false;
  const bullets = [
    ...doc.experience.flatMap((entry) => entry.bullets),
    ...(doc.projects ?? []).flatMap((project) => [project.description]),
  ];
  return bullets.some((bullet) => {
    const text = normalizedQuote(bullet);
    return text.includes(q) || q.includes(text);
  });
}

function filterContradictedProofPoints(doc: TailoredDoc, proofPoints: ProofPoint[]): ProofPoint[] {
  const hasSkills =
    (doc.skills ?? []).some((skill) => skill.trim()) ||
    (doc.skillGroups ?? []).some((group) => group.skills.some((skill) => skill.trim()));
  const experience = doc.experience ?? [];
  const allExperienceHasDates =
    experience.length > 0 && experience.every((entry) => entry.dates.trim().length > 0);

  return proofPoints.filter((point) => {
    if (point.ruleId === "skills_first_prominent" && hasSkills) return false;
    if (
      point.ruleId === "bullet_length_1_to_2_lines" &&
      !quoteMatchesEditableBullet(doc, point.quote)
    ) {
      return false;
    }
    if (point.ruleId === "include_start_end_dates_on_all_roles" && allExperienceHasDates) {
      return false;
    }
    // "Add 'Phone:'/'Email:' labels before each contact item" is a persistent LLM
    // myth — modern resumes and ATS parse an unlabeled contact line fine, and the
    // labels only clutter the header. Drop it (legacy LLM finding, no ruleId; our
    // real contact-gap checks below use ruleIds, so they're untouched).
    if (!point.ruleId) {
      const blob = `${point.title} ${point.summary} ${point.fix}`.toLowerCase();
      if (/\blabels?\b/.test(blob) && (/\bcontact\b/.test(blob) || /(?:phone|email)\s*:/.test(blob))) {
        return false;
      }
    }
    return true;
  });
}

// A resume with no email or no phone is hard for a recruiter or ATS to act on.
// We read the doc's OWN contact line (parseContact is the single source of truth;
// the LaTeX round-trip is lossy) and surface any gap as a header finding, ahead
// of style suggestions. Header category, so the template-owned suppression never
// hides a real content gap. Skipped when the legacy LLM already raised the same
// gap, so we never double-surface it.
function contactGapProofPoints(doc: TailoredDoc, existing: ProofPoint[]): ProofPoint[] {
  const contact = parseContact(doc.contact || "");
  const alreadyRaised = (re: RegExp) =>
    existing.some((p) => re.test(`${p.title} ${p.summary} ${p.fix}`));
  const gaps: ProofPoint[] = [];
  if (!contact.email && !alreadyRaised(/\bemail\b/i)) {
    gaps.push({
      title: "Add an email address",
      summary:
        "Your header has no email. It is the primary way recruiters reply and the field most ATS forms require, so a resume without one can stall.",
      why: "Email is the default reply channel for recruiters and is required by most online applications.",
      fix: "Add a professional email to the header line (Phone | Email | LinkedIn | City, ST).",
      severity: "high",
      ruleId: "header_missing_email",
      category: "header",
      targetSection: "header",
    });
  }
  if (!contact.phone && !alreadyRaised(/\bphone\b/i)) {
    gaps.push({
      title: "Add a phone number",
      summary:
        "Your header has no phone number. Many recruiters call or text first, and some ATS forms expect one.",
      why: "A direct line is often the fastest way a recruiter follows up on a strong resume.",
      fix: "Add a phone number to the header line (Phone | Email | LinkedIn | City, ST).",
      severity: "medium",
      ruleId: "header_missing_phone",
      category: "header",
      targetSection: "header",
    });
  }
  return gaps;
}

// A role with zero or one real bullet reads as filler and wastes prime résumé
// space. We suggest CREATING bullets (not revising) for thin entries. Counted
// straight from the structured doc (entry.bullets) so the number is computed,
// never fabricated. Surfaced ahead of style nits, like the contact-gap checks.
function sparseExperienceProofPoints(doc: TailoredDoc): ProofPoint[] {
  const isRealBullet = (b: string) => b.trim().length >= 8;
  const sparse = (doc.experience ?? []).filter(
    (entry) => entry.bullets.filter(isRealBullet).length < 2,
  );
  if (!sparse.length) return [];
  const first = sparse[0];
  const label = [first.role, first.company].filter((s) => s && s.trim()).join(" at ") || "a role";
  const others = sparse.length - 1;
  const summary =
    `The ${label} entry has fewer than two accomplishment bullets` +
    (others > 0
      ? ` (and ${others} other role${others > 1 ? "s are" : " is"} thin too).`
      : ".") +
    " Roles with one or no bullets read as filler and waste prime resume space.";
  return [
    {
      title: "Add bullets to a thin role",
      summary,
      why: "Recruiters spend the most time on recent roles. A role with no accomplishments signals little impact and weakens the whole section.",
      fix: "Add 2 to 4 accomplishment bullets for this role. Start each with a strong verb and a concrete result or scope (what you did and what changed).",
      quote: undefined,
      severity: "high",
      ruleId: "experience_sparse_bullets",
      category: "experience",
      targetSection: "experience",
    },
  ];
}

// Fold the LLM proof points + deterministic rule findings into one deduped,
// ranked, capped set. Falls back to the raw proof points if the doc can't be
// rendered to LaTeX (the engine's detectors read LaTeX structure).
export function refineFeedback(
  doc: TailoredDoc,
  proofPoints: ProofPoint[],
): { proofPoints: ProofPoint[]; stats: FeedbackStats | null } {
  try {
    const latexSource = renderResumeTex(doc);
    const result = evaluateResumeRules({
      latexSource,
      legacyProofPoints: proofPoints,
      tier: "paid", // the editor is an engaged workspace → allow up to 10
      templated: true, // base resume renders in our template (it owns layout/ATS)
    });
    const rawProofPoints = result.surfaced.map(findingToProofPoint).map(stripUnverifiableCounts);
    const filteredProofPoints = filterContradictedProofPoints(doc, rawProofPoints);
    const contradictionSuppressed = rawProofPoints.length - filteredProofPoints.length;
    // Real content gaps lead the list: missing email/phone, then thin roles that
    // need bullets written. Both are computed from the doc, ahead of style nits.
    const contactGaps = contactGapProofPoints(doc, filteredProofPoints);
    const sparseGaps = sparseExperienceProofPoints(doc);
    return {
      proofPoints: [...contactGaps, ...sparseGaps, ...filteredProofPoints],
      stats: {
        rulesLoaded: result.stats.rulesLoaded,
        candidates: result.stats.candidateFindingsCount,
        deduped: result.stats.dedupedFindingsCount,
        surfaced: filteredProofPoints.length + contactGaps.length + sparseGaps.length,
        suppressed: result.stats.suppressedCount + contradictionSuppressed,
      },
    };
  } catch {
    // LaTeX render failed; still surface the deterministic doc-based checks.
    return {
      proofPoints: [
        ...contactGapProofPoints(doc, proofPoints),
        ...sparseExperienceProofPoints(doc),
        ...proofPoints,
      ],
      stats: null,
    };
  }
}
