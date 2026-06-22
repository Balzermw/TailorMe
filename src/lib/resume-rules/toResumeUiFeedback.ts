// Convert surfaced findings into the Grok-compatible ResumeUiFeedback payload.
// HIGH PRIORITY group first; group counts reflect ONLY surfaced items (not all
// internal findings). This is the exact shape resume_ui_feedback.json documents.

import type {
  ResumePriorityGroup,
  ResumeRuleFinding,
  ResumeUiFeedback,
  ResumeUiFeedbackItem,
} from "./resumeAdviceRule.types";

function toItem(f: ResumeRuleFinding): ResumeUiFeedbackItem {
  return {
    id: f.findingId,
    rule_id: f.ruleId,
    title: f.title,
    severity: f.uiSeverityLabel,
    priority_group: f.priorityGroup,
    from_resume: f.evidenceSnippet ?? "",
    why_it_matters: f.whyItMatters,
    how_we_fix_it: f.suggestedFix,
    target_section: f.targetSection,
    fix_action_label: f.fixActionLabel,
    suggested_rewrite: f.suggestedRewrite ?? "",
  };
}

const GROUP_ORDER: ResumePriorityGroup[] = ["HIGH PRIORITY", "WORTH FIXING"];

/** `surfaced` must already be ranked — item order within a group is preserved. */
export function toResumeUiFeedback(surfaced: ResumeRuleFinding[]): ResumeUiFeedback {
  const groups = GROUP_ORDER.map((label) => {
    const items = surfaced.filter((f) => f.priorityGroup === label).map(toItem);
    return { label, count: items.length, items };
  }).filter((g) => g.items.length > 0);

  return { version: "1.0", resume_format: "latex", groups };
}
