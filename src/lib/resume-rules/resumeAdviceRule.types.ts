// Canonical resume-advice rule model. Both the Grok master rules and the
// legacy LLM-generated feedback normalize into ResumeAdviceRule, so the rest of
// the pipeline (evaluate → dedupe → rank → surface → UI) is source-agnostic.
//
// A rule is NOT automatically a customer-facing suggestion. Rules produce
// internal candidate findings (ResumeRuleFinding); only a deduped, ranked,
// capped subset reaches the customer as ResumeUiFeedback.

export type ResumeRuleCategory =
  | "ats"
  | "keywords"
  | "hiring_manager"
  | "quantification"
  | "bullet_strength"
  | "formatting"
  | "readability"
  | "concision"
  | "section_completeness"
  | "career_narrative"
  | "evidence_strength"
  | "rewrite_readiness"
  | "header"
  | "experience"
  | "skills"
  | "summary"
  | "projects";

export type ResumeRuleAgent =
  | "ada"
  | "max"
  | "remy"
  | "strategist"
  | "editor";

export type ResumeRuleSeverity = "critical" | "high" | "medium" | "low";

export type ResumeRuleDetectionType =
  | "deterministic"
  | "heuristic"
  | "llm"
  | "hybrid";

export type ResumeTargetSection =
  | "header"
  | "experience"
  | "skills"
  | "summary"
  | "projects"
  | "formatting";

export type ResumeUiSeverityLabel = "High" | "Medium" | "Low";
export type ResumePriorityGroup = "HIGH PRIORITY" | "WORTH FIXING";

export type ResumeRuleSourceType =
  | "grok_master_rule"
  | "legacy"
  | "manual"
  | "book"
  | "expert";

export interface ResumeAdviceRule {
  ruleId: string;
  /** Stable identity shared by Grok + legacy rules that describe the same issue. */
  canonicalIssueId: string;

  title: string;

  category: ResumeRuleCategory;
  agent: ResumeRuleAgent;

  severity: ResumeRuleSeverity;
  /** 0–1 prior confidence that this rule's findings are real/actionable. */
  confidence: number;

  principle: string;
  whyItMatters: string;

  detectionType: ResumeRuleDetectionType;
  detectionHint?: string;
  latexDetectionHint?: string;

  feedbackTemplate: string;
  rewriteInstruction?: string;

  exampleBefore?: string;
  exampleAfter?: string;

  ui: {
    title: string;
    targetSection: ResumeTargetSection;
    fixActionLabel: string;
    severityLabel: ResumeUiSeverityLabel;
  };

  implementationPriority?: string;
  priorityGroup: ResumePriorityGroup;

  /** At most one rule from a mutually-exclusive group surfaces. */
  mutuallyExclusiveGroup?: string;
  /** Rule ids this rule supersedes (its finding wins on overlap). */
  subsumes?: string[];
  tags?: string[];

  enabled: boolean;
  customerVisibleDefault: boolean;

  source: {
    type: ResumeRuleSourceType;
    reference?: string;
    raw?: unknown;
  };
}

// ---- candidate finding (internal) ----

export interface ResumeRuleFinding {
  findingId: string;

  ruleId: string;
  canonicalIssueId: string;

  category: ResumeRuleCategory;
  agent: ResumeRuleAgent;

  severity: ResumeRuleSeverity;
  confidence: number;

  priorityGroup: ResumePriorityGroup;

  section?: string;
  lineRef?: string;
  evidenceSnippet?: string;

  title: string;
  message: string;
  whyItMatters: string;
  suggestedFix: string;
  suggestedRewrite?: string;

  targetSection: ResumeTargetSection;
  fixActionLabel: string;
  uiSeverityLabel: ResumeUiSeverityLabel;

  /** Stable key used to collapse repeated/equivalent findings. */
  dedupeFingerprint: string;
  /** All rule ids that contributed to this (merged) finding. */
  sourceRuleIds: string[];
  /** How many raw occurrences this finding represents (repeated bullets etc.). */
  occurrences?: number;
}

// ---- customer-facing UI payload (Grok-compatible) ----

export interface ResumeUiFeedbackItem {
  id: string;
  rule_id: string;
  title: string;
  severity: ResumeUiSeverityLabel;
  priority_group: ResumePriorityGroup;
  from_resume: string;
  why_it_matters: string;
  how_we_fix_it: string;
  target_section: ResumeTargetSection;
  fix_action_label: string;
  suggested_rewrite: string;
}

export interface ResumeUiFeedback {
  version: "1.0";
  resume_format: "latex";
  groups: Array<{
    label: ResumePriorityGroup;
    count: number;
    items: ResumeUiFeedbackItem[];
  }>;
}

// ---- dedupe result (internal/debug) ----

export type DedupeReason =
  | "same_canonical_issue"
  | "same_rule_and_section"
  | "mutually_exclusive_group"
  | "subsumed_by_rule"
  | "near_duplicate"
  | "repeated_bullet_issue"
  | "category_cap"
  | "global_cap"
  | "low_confidence";

export interface DedupeResult {
  kept: ResumeRuleFinding[];
  suppressed: Array<{
    finding: ResumeRuleFinding;
    suppressedByFindingId: string;
    reason: DedupeReason;
  }>;
}

// ---- raw Grok master-rule shape (loader input) ----

export interface GrokResumeRuleRaw {
  rule_id: string;
  category?: string;
  primary_agent?: string;
  supporting_agents?: string[];
  principle?: string;
  severity: string;
  implementation_priority?: string;
  complexity?: string;

  detection_hint?: string;
  latex_detection_hint?: string;

  why_it_matters?: string;
  how_we_fix_it?: string;
  feedback_template?: string;
  rewrite_instruction?: string;

  example_good?: string;
  example_bad?: string;

  confidence?: string;
  estimated_impact?: string;

  ui_title?: string;
  ui_target_section?: string;
  ui_fix_action?: string;
  ui_severity_label?: string;

  // Preserve any extra Grok fields without losing them.
  [key: string]: unknown;
}

export interface GrokMasterRulesFile {
  metadata?: Record<string, unknown>;
  rules: GrokResumeRuleRaw[];
}
