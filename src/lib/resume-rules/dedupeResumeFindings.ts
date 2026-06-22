// Collapse repetitive findings so the customer never sees the same problem
// twice. Findings sharing a dedupeFingerprint (canonicalIssue + section) — e.g.
// a deterministic finding and the legacy LLM finding for the same issue, or N
// bullet-level hits of one rule — merge into the single strongest finding.

import type { DedupeResult, ResumeRuleFinding, ResumeRuleSeverity } from "./resumeAdviceRule.types";

const SEVERITY_RANK: Record<ResumeRuleSeverity, number> = {
  critical: 4,
  high: 3,
  medium: 2,
  low: 1,
};

/** Strength order: severity, then confidence, then has-evidence, then occurrences. */
function isStronger(a: ResumeRuleFinding, b: ResumeRuleFinding): boolean {
  if (SEVERITY_RANK[a.severity] !== SEVERITY_RANK[b.severity])
    return SEVERITY_RANK[a.severity] > SEVERITY_RANK[b.severity];
  if (a.confidence !== b.confidence) return a.confidence > b.confidence;
  const ae = a.evidenceSnippet ? 1 : 0;
  const be = b.evidenceSnippet ? 1 : 0;
  if (ae !== be) return ae > be;
  return (a.occurrences ?? 1) > (b.occurrences ?? 1);
}

function mergeInto(winner: ResumeRuleFinding, loser: ResumeRuleFinding): void {
  winner.sourceRuleIds = Array.from(new Set([...winner.sourceRuleIds, ...loser.sourceRuleIds]));
  winner.occurrences = (winner.occurrences ?? 1) + (loser.occurrences ?? 1);
  // Borrow the loser's concrete evidence if the winner lacked one.
  if (!winner.evidenceSnippet && loser.evidenceSnippet) {
    winner.evidenceSnippet = loser.evidenceSnippet;
  }
}

export function dedupeResumeFindings(findings: ResumeRuleFinding[]): DedupeResult {
  const winners = new Map<string, ResumeRuleFinding>();
  const suppressed: DedupeResult["suppressed"] = [];

  for (const f of findings) {
    const key = f.dedupeFingerprint;
    const current = winners.get(key);
    if (!current) {
      // Clone so merge mutations don't alter the caller's array.
      winners.set(key, { ...f, sourceRuleIds: [...f.sourceRuleIds] });
      continue;
    }
    const repeatedBullet =
      current.canonicalIssueId === f.canonicalIssueId && current.section === f.section;
    if (isStronger(f, current)) {
      // Promote f, demote current.
      const promoted = { ...f, sourceRuleIds: [...f.sourceRuleIds] };
      mergeInto(promoted, current);
      winners.set(key, promoted);
      suppressed.push({
        finding: current,
        suppressedByFindingId: promoted.findingId,
        reason: repeatedBullet ? "repeated_bullet_issue" : "same_canonical_issue",
      });
    } else {
      mergeInto(current, f);
      suppressed.push({
        finding: f,
        suppressedByFindingId: current.findingId,
        reason: repeatedBullet ? "repeated_bullet_issue" : "same_canonical_issue",
      });
    }
  }

  return { kept: [...winners.values()], suppressed };
}
