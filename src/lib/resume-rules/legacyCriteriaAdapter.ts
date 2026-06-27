// Adapter for the EXISTING feedback, which is NOT a static rule list — it's the
// LLM output of parseResume() (ProofPoint[]) and the three agents. We map each
// legacy finding onto a canonicalIssueId (= a Grok rule_id) by keyword, so a
// legacy "missing metrics" finding and the Grok quantify_impact_metrics rule
// collapse into ONE customer suggestion in dedupe (instead of double-surfacing).
//
// Matched findings keep the LLM's specific evidence/message but are credited to
// the canonical rule. Unmatched legacy findings stay in the pipeline under a
// legacy_* issue id (they just won't collapse with a Grok rule).

import type { ProofPoint } from "@/lib/types";
import type {
  ResumeRuleCategory,
  ResumeAdviceRule,
  ResumeRuleFinding,
  ResumeRuleSeverity,
  ResumeTargetSection,
} from "./resumeAdviceRule.types";
import { makeFinding } from "./makeFinding";
import { makeFindingId, makeDedupeFingerprint } from "./stableId";

// Ordered: first pattern that matches the proof point's combined text wins, so
// SPECIFIC issues (name, title) come before broad ones (ATS). The ATS pattern
// is deliberately narrow ("applicant tracking", "single/multi-column",
// "machine-readable") — bare "parse"/"format" over-matched and mis-routed
// header findings here.
const ISSUE_PATTERNS: Array<{ issueId: string; re: RegExp }> = [
  {
    issueId: "clear_full_name_in_header",
    re: /\b(candidate|legal|full)\s+name\b|\bname\s+(missing|unclear|not clear|not stated)\b|\bheader\b.*\bname\b|\bname\b.*\bheader\b/i,
  },
  { issueId: "explicit_current_role_title", re: /role title|job title|current title|target role|headline|titles?\b/i },
  { issueId: "has_dedicated_skills_section", re: /skills?\s+(section|are\s+(not|missing)|missing|buried)|dedicated skills|no skills/i },
  { issueId: "include_start_end_dates_on_all_roles", re: /\bdates?\b|timeline|employment period|tenure/i },
  { issueId: "avoid_first_person_pronouns", re: /first.?person|pronoun/i },
  { issueId: "quantify_impact_metrics", re: /metric|quantif|number|measurab|impact|outcome|\bresults?\b|\bpercent\b|%/i },
  { issueId: "accomplishments_not_responsibilities", re: /responsib|duties|duty|task[- ]?listing|accomplishment/i },
  { issueId: "qualifications_summary_over_traditional_objective", re: /summary|objective|profile|positioning|branding/i },
  { issueId: "ats_clean_single_column", re: /applicant tracking|\bats\b|single.?column|multi.?column|machine.?read/i },
  { issueId: "kill_buzzwords_proof", re: /buzzword|cliché|cliche|generic phras|fluff|jargon/i },
  {
    issueId: "bullet_length_1_to_2_lines",
    re: /\bbullets?\b.{0,48}\b(too long|wordy|verbose|length|scan)\b|\b(too long|wordy|verbose)\b.{0,48}\bbullets?\b|\bbullet length\b/i,
  },
];

function severityToConfidence(s: ResumeRuleSeverity | ProofPoint["severity"]): number {
  return s === "high" ? 0.85 : s === "medium" ? 0.7 : 0.55;
}

function matchIssueId(pp: ProofPoint): string | null {
  const text = `${pp.title} ${pp.summary} ${pp.why} ${pp.fix}`;
  for (const { issueId, re } of ISSUE_PATTERNS) if (re.test(text)) return issueId;
  return null;
}

function slug(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 40);
}

function inferLegacySection(pp: ProofPoint): "header" | "experience" | "skills" | "summary" | "projects" {
  const text = `${pp.title} ${pp.summary} ${pp.why} ${pp.fix}`.toLowerCase();
  if (/\bskills?\b|tool|technolog|list entry|misspell/.test(text)) return "skills";
  if (/\bsummary\b|objective|profile/.test(text)) return "summary";
  if (/\bproject|portfolio/.test(text)) return "projects";
  if (/\bheader\b|\bheadline\b|\bcontact\b|\blinkedin\b|\bemail\b|\bphone\b|\bname\b/.test(text)) return "header";
  return "experience";
}

function legacyCategory(section: ResumeTargetSection): ResumeRuleCategory {
  if (section === "skills" || section === "summary" || section === "projects" || section === "header") {
    return section;
  }
  return "bullet_strength";
}

function legacyFixActionLabel(section: ResumeTargetSection): string {
  switch (section) {
    case "skills":
      return "Edit Skills";
    case "summary":
      return "Edit Summary";
    case "projects":
      return "Edit Projects";
    case "header":
      return "Edit Header";
    default:
      return "Rewrite bullet";
  }
}

/** Build a standalone finding for a legacy proof point that matched no rule. */
function unmatchedFinding(pp: ProofPoint): ResumeRuleFinding {
  const canonicalIssueId = `legacy_${slug(pp.title) || "finding"}`;
  const section = inferLegacySection(pp);
  return {
    findingId: makeFindingId({ ruleId: canonicalIssueId, canonicalIssueId, evidence: pp.quote, section }),
    ruleId: canonicalIssueId,
    canonicalIssueId,
    category: legacyCategory(section),
    agent: "editor",
    severity: pp.severity,
    confidence: severityToConfidence(pp.severity),
    priorityGroup: pp.severity === "high" ? "HIGH PRIORITY" : "WORTH FIXING",
    section,
    evidenceSnippet: pp.quote,
    title: pp.title,
    message: pp.summary,
    whyItMatters: pp.why,
    suggestedFix: pp.fix,
    targetSection: section,
    fixActionLabel: legacyFixActionLabel(section),
    uiSeverityLabel: pp.severity === "high" ? "High" : pp.severity === "medium" ? "Medium" : "Low",
    dedupeFingerprint: makeDedupeFingerprint({ canonicalIssueId, section }),
    sourceRuleIds: [canonicalIssueId],
    occurrences: 1,
  };
}

/**
 * Convert legacy LLM proof points into canonical findings. `rules` is the loaded
 * catalog; a matched proof point is credited to its canonical rule (so it shares
 * a dedupeFingerprint with the deterministic finding) while keeping the LLM's
 * specific quote/message/fix.
 */
export function legacyProofPointsToFindings(
  proofPoints: ProofPoint[],
  rules: ResumeAdviceRule[],
): ResumeRuleFinding[] {
  const byId = new Map(rules.map((r) => [r.canonicalIssueId, r]));
  return proofPoints.map((pp) => {
    const issueId = matchIssueId(pp);
    const rule = issueId ? byId.get(issueId) : undefined;
    if (!rule) return unmatchedFinding(pp);
    return makeFinding(rule, {
      evidence: pp.quote,
      message: pp.summary,
      suggestedFix: pp.fix,
      confidence: severityToConfidence(pp.severity),
      // Provenance: this canonical issue was also raised by the legacy LLM.
      sourceRuleIds: [`legacy:${slug(pp.title)}`, rule.ruleId],
    });
  });
}
