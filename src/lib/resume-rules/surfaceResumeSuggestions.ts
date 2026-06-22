// Apply the surfacing caps to ranked findings: confidence floor, per-category
// cap, formatting cap, and the global free/paid cap. This is where "a rule is
// not a suggestion" is enforced — most ranked findings are dropped here.

import type { DedupeReason, ResumeRuleFinding } from "./resumeAdviceRule.types";
import type { RankedFinding } from "./rankResumeFindings";
import { resumeFeedbackConfig } from "./resumeFeedbackConfig";

const FORMATTING_CATEGORIES = new Set(["formatting", "readability", "concision"]);

export interface SurfaceResult {
  surfaced: ResumeRuleFinding[];
  suppressed: Array<{ finding: ResumeRuleFinding; reason: DedupeReason }>;
}

export function surfaceResumeSuggestions(
  ranked: RankedFinding[],
  opts: { tier: "free" | "paid"; config?: typeof resumeFeedbackConfig } = { tier: "free" },
): SurfaceResult {
  const cfg = opts.config ?? resumeFeedbackConfig;
  const globalCap = opts.tier === "paid" ? cfg.maxSuggestionsPaid : cfg.maxSuggestionsFree;

  const surfaced: ResumeRuleFinding[] = [];
  const suppressed: SurfaceResult["suppressed"] = [];
  const perCategory = new Map<string, number>();
  let formattingCount = 0;

  for (const { finding } of ranked) {
    if (finding.confidence < cfg.minConfidenceToSurface) {
      suppressed.push({ finding, reason: "low_confidence" });
      continue;
    }
    if (surfaced.length >= globalCap) {
      suppressed.push({ finding, reason: "global_cap" });
      continue;
    }
    const catCount = perCategory.get(finding.category) ?? 0;
    if (catCount >= cfg.maxPerCategory) {
      suppressed.push({ finding, reason: "category_cap" });
      continue;
    }
    if (FORMATTING_CATEGORIES.has(finding.category) && formattingCount >= cfg.maxFormattingSuggestions) {
      suppressed.push({ finding, reason: "category_cap" });
      continue;
    }

    surfaced.push(finding);
    perCategory.set(finding.category, catCount + 1);
    if (FORMATTING_CATEGORIES.has(finding.category)) formattingCount++;
  }

  return { surfaced, suppressed };
}
