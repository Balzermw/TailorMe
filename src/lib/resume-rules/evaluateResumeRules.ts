// Orchestrates the whole deterministic pipeline:
//   Grok rules + legacy LLM findings
//   → candidate findings → dedupe → rank → surface (caps) → Grok UI payload.
// Zero new LLM calls: the legacy proof points are passed IN (reusing the one
// call the feedback route already makes); everything here is pure code.

import type { ProofPoint } from "@/lib/types";
import type { ResumeRuleFinding, ResumeUiFeedback } from "./resumeAdviceRule.types";
import { loadGrokResumeRules } from "./loadGrokResumeRules";
import { evaluateLatexResumeRules } from "./evaluateLatexResumeRules";
import { legacyProofPointsToFindings } from "./legacyCriteriaAdapter";
import { dedupeResumeFindings } from "./dedupeResumeFindings";
import { rankResumeFindings, type RankedFinding } from "./rankResumeFindings";
import { surfaceResumeSuggestions } from "./surfaceResumeSuggestions";
import { toResumeUiFeedback } from "./toResumeUiFeedback";
import { resumeFeedbackConfig } from "./resumeFeedbackConfig";

export interface EvaluateResumeInput {
  latexSource: string;
  jobText?: string;
  /** Legacy LLM feedback (parseResume output) to fold in + dedupe against. */
  legacyProofPoints?: ProofPoint[];
  tier?: "free" | "paid";
  /**
   * The résumé renders in OUR template (build-from-scratch / base resume), so
   * the template owns layout/ATS/spacing — suppress those findings (they're
   * genuine only on uploaded files). Mirrors parseResume's `templated` flag.
   */
  templated?: boolean;
}

// Categories the template controls; suppressed when `templated` is set.
const TEMPLATE_OWNED = new Set(["formatting", "ats", "readability"]);

export interface EvaluateResumeResult {
  ui: ResumeUiFeedback;
  surfaced: ResumeRuleFinding[];
  candidates: ResumeRuleFinding[];
  deduped: ResumeRuleFinding[];
  ranked: RankedFinding[];
  suppressed: Array<{ finding: ResumeRuleFinding; reason: string }>;
  stats: {
    rulesLoaded: number;
    grokRules: number;
    legacyRules: number;
    candidateFindingsCount: number;
    dedupedFindingsCount: number;
    surfacedSuggestionsCount: number;
    suppressedCount: number;
    byCategory: Record<string, number>;
    bySeverity: Record<string, number>;
    byPriorityGroup: Record<string, number>;
  };
}

export function evaluateResumeRules(input: EvaluateResumeInput): EvaluateResumeResult {
  const tier = input.tier ?? "free";
  const rules = resumeFeedbackConfig.enableGrokMasterRules ? loadGrokResumeRules() : [];

  const grokFindings = evaluateLatexResumeRules(input.latexSource, rules, {
    jobText: input.jobText,
  });
  const legacyFindings =
    resumeFeedbackConfig.enableLegacyCriteria && input.legacyProofPoints?.length
      ? legacyProofPointsToFindings(input.legacyProofPoints, rules)
      : [];

  const all = [...grokFindings, ...legacyFindings];
  // On our own template, drop layout/ATS/readability findings the template owns.
  const candidates = input.templated
    ? all.filter((f) => !TEMPLATE_OWNED.has(f.category))
    : all;

  const { kept: deduped, suppressed: dedupeSuppressed } = resumeFeedbackConfig.enableDedupe
    ? dedupeResumeFindings(candidates)
    : { kept: candidates, suppressed: [] };

  const ranked = rankResumeFindings(deduped, { hasJob: Boolean(input.jobText) });
  const { surfaced, suppressed: surfaceSuppressed } = surfaceResumeSuggestions(ranked, { tier });

  const tally = (arr: ResumeRuleFinding[], key: keyof ResumeRuleFinding) =>
    arr.reduce<Record<string, number>>((acc, f) => {
      const v = String(f[key]);
      acc[v] = (acc[v] ?? 0) + 1;
      return acc;
    }, {});

  return {
    ui: toResumeUiFeedback(surfaced),
    surfaced,
    candidates,
    deduped,
    ranked,
    suppressed: [
      ...dedupeSuppressed.map((s) => ({ finding: s.finding, reason: s.reason })),
      ...surfaceSuppressed.map((s) => ({ finding: s.finding, reason: s.reason })),
    ],
    stats: {
      rulesLoaded: rules.length,
      grokRules: grokFindings.length,
      legacyRules: legacyFindings.length,
      candidateFindingsCount: candidates.length,
      dedupedFindingsCount: deduped.length,
      surfacedSuggestionsCount: surfaced.length,
      suppressedCount: dedupeSuppressed.length + surfaceSuppressed.length,
      byCategory: tally(surfaced, "category"),
      bySeverity: tally(surfaced, "severity"),
      byPriorityGroup: tally(surfaced, "priorityGroup"),
    },
  };
}
