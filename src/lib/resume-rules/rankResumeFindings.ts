// Score findings so the most leverage-y fixes surface first. ATS, role-fit,
// missing impact/metrics, weak bullets, positioning, and section problems beat
// small style/formatting nitpicks. Scoring is deterministic (no LLM).

import type { ResumeRuleFinding, ResumeRuleSeverity } from "./resumeAdviceRule.types";

const SEVERITY_BASE: Record<ResumeRuleSeverity, number> = {
  critical: 100,
  high: 75,
  medium: 45,
  low: 20,
};

const POSITIONING = new Set(["summary", "career_narrative"]);
const FORMATTING = new Set(["formatting", "readability", "concision"]);

export function scoreFinding(f: ResumeRuleFinding, opts: { hasJob?: boolean } = {}): number {
  let s = SEVERITY_BASE[f.severity];
  if (f.priorityGroup === "HIGH PRIORITY") s += 25;
  if (POSITIONING.has(f.category)) s += 15;
  if ((f.occurrences ?? 1) > 1) s += 8;
  if (f.category === "quantification") s += 12;
  if (f.category === "ats" && f.evidenceSnippet) s += 10;
  if (f.category === "section_completeness") s += 8;
  if (opts.hasJob && (f.category === "keywords" || f.category === "ats")) s += 20;
  if (FORMATTING.has(f.category)) s -= 10;
  if (f.confidence < 0.6) s -= 15;
  // Confidence tiebreak so higher-confidence wins within a tier.
  s += Math.round(f.confidence * 10);
  return s;
}

export interface RankedFinding {
  finding: ResumeRuleFinding;
  score: number;
}

/** Returns findings sorted by score desc (stable on ties via findingId). */
export function rankResumeFindings(
  findings: ResumeRuleFinding[],
  opts: { hasJob?: boolean } = {},
): RankedFinding[] {
  return findings
    .map((finding) => ({ finding, score: scoreFinding(finding, opts) }))
    .sort((a, b) => b.score - a.score || a.finding.findingId.localeCompare(b.finding.findingId));
}
