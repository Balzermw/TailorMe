// Deterministic resume feedback: render the structured doc to LaTeX, run the
// rules engine over it, and fold in any legacy (LLM) proof points — deduped,
// ranked, and capped. Pure of network/LLM calls, so it can run at import time
// (zero token cost) AND inside the feedback route (alongside the LLM parse).
// Shared so import and the editor produce the SAME suggestions for one doc.

import { renderResumeTex } from "@/lib/apply/latex";
import { evaluateResumeRules } from "@/lib/resume-rules/evaluateResumeRules";
import type { ResumeRuleFinding } from "@/lib/resume-rules/resumeAdviceRule.types";
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
    return true;
  });
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
    const rawProofPoints = result.surfaced.map(findingToProofPoint);
    const filteredProofPoints = filterContradictedProofPoints(doc, rawProofPoints);
    const contradictionSuppressed = rawProofPoints.length - filteredProofPoints.length;
    return {
      proofPoints: filteredProofPoints,
      stats: {
        rulesLoaded: result.stats.rulesLoaded,
        candidates: result.stats.candidateFindingsCount,
        deduped: result.stats.dedupedFindingsCount,
        surfaced: filteredProofPoints.length,
        suppressed: result.stats.suppressedCount + contradictionSuppressed,
      },
    };
  } catch {
    return { proofPoints, stats: null };
  }
}
