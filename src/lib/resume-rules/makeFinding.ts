// Build a canonical ResumeRuleFinding from a rule + detected evidence. Centralized
// so every detector (deterministic, heuristic, legacy adapter) produces the same
// shape with stable ids + dedupe fingerprints.

import type { ResumeAdviceRule, ResumeRuleFinding } from "./resumeAdviceRule.types";
import { makeFindingId, makeDedupeFingerprint } from "./stableId";

export interface FindingInput {
  section?: string;
  lineRef?: string;
  evidence?: string;
  message?: string; // overrides rule.feedbackTemplate
  suggestedFix?: string; // overrides rule.rewriteInstruction
  suggestedRewrite?: string;
  confidence?: number; // overrides rule.confidence
  occurrences?: number;
  /** Override which rule ids are credited (for merged/legacy findings). */
  sourceRuleIds?: string[];
}

export function makeFinding(rule: ResumeAdviceRule, input: FindingInput = {}): ResumeRuleFinding {
  const section = input.section ?? rule.ui.targetSection;
  return {
    findingId: makeFindingId({
      ruleId: rule.ruleId,
      canonicalIssueId: rule.canonicalIssueId,
      evidence: input.evidence,
      section,
      lineRef: input.lineRef,
    }),
    ruleId: rule.ruleId,
    canonicalIssueId: rule.canonicalIssueId,
    category: rule.category,
    agent: rule.agent,
    severity: rule.severity,
    confidence: input.confidence ?? rule.confidence,
    priorityGroup: rule.priorityGroup,
    section,
    lineRef: input.lineRef,
    evidenceSnippet: input.evidence,
    title: rule.ui.title,
    message: input.message ?? rule.feedbackTemplate,
    whyItMatters: rule.whyItMatters,
    suggestedFix: input.suggestedFix ?? rule.rewriteInstruction ?? rule.feedbackTemplate,
    suggestedRewrite: input.suggestedRewrite ?? rule.exampleAfter,
    targetSection: rule.ui.targetSection,
    fixActionLabel: rule.ui.fixActionLabel,
    uiSeverityLabel: rule.ui.severityLabel,
    dedupeFingerprint: makeDedupeFingerprint({
      canonicalIssueId: rule.canonicalIssueId,
      section,
    }),
    sourceRuleIds: input.sourceRuleIds ?? [rule.ruleId],
    occurrences: input.occurrences,
  };
}
