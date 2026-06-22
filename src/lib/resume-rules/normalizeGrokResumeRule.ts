// Map a raw Grok master rule into the canonical ResumeAdviceRule. Prefer the
// rule's own category/agent when present; infer conservatively otherwise.
// Unknown raw fields are preserved on source.raw (never dropped).

import type {
  GrokResumeRuleRaw,
  ResumeAdviceRule,
  ResumeRuleAgent,
  ResumeRuleCategory,
  ResumeRuleSeverity,
  ResumeTargetSection,
  ResumeUiSeverityLabel,
  ResumePriorityGroup,
} from "./resumeAdviceRule.types";
import { resumeFeedbackConfig } from "./resumeFeedbackConfig";

const TARGET_SECTIONS = new Set<ResumeTargetSection>([
  "header",
  "experience",
  "skills",
  "summary",
  "projects",
  "formatting",
]);

// Grok primary_agent → canonical agent. The three customer-facing personas are
// ada (ATS/keywords), max (metrics/impact), remy (role-fit/hiring-manager);
// strategist/editor are internal lenses.
const AGENT_MAP: Record<string, ResumeRuleAgent> = {
  ats: "ada",
  quantifier: "max",
  hiring_manager: "remy",
  strategist: "strategist",
  editor: "editor",
};

// Grok category (verbose) → canonical category. Anything unmapped falls back to
// the rule's ui_target_section, then "bullet_strength".
const CATEGORY_MAP: Record<string, ResumeRuleCategory> = {
  "Job targeting & tailoring": "career_narrative",
  "Bullet writing & structure": "bullet_strength",
  "Quantification, metrics & impact": "quantification",
  "Recruiter & hiring manager psychology / scan behavior": "hiring_manager",
  "Skills section & competency mapping": "skills",
  "Formatting, layout & scannability": "formatting",
  "ATS compatibility, keywords & semantic matching": "ats",
  "Professional summary / profile / branding": "summary",
  "Career gaps, non-linear paths & positive framing": "career_narrative",
  "Leadership, executive & senior-level resumes": "career_narrative",
  "References, additional information & “fluff” sections": "section_completeness",
  "Education, certifications, projects & credentials": "section_completeness",
  "LinkedIn / personal branding alignment": "career_narrative",
  "Cover letters (if covered)": "career_narrative",
  "Bias reduction, inclusive language & demographic signaling": "readability",
  "Action verbs, language strength & voice": "bullet_strength",
  "Projects, portfolio & non-traditional proof": "projects",
  "Experience selection & prioritization": "experience",
  "Header & contact information": "header",
};

// ui_target_section → a reasonable canonical category fallback.
const SECTION_TO_CATEGORY: Record<ResumeTargetSection, ResumeRuleCategory> = {
  header: "header",
  experience: "experience",
  skills: "skills",
  summary: "summary",
  projects: "projects",
  formatting: "formatting",
};

function targetSection(raw: GrokResumeRuleRaw): ResumeTargetSection {
  const s = raw.ui_target_section;
  return typeof s === "string" && TARGET_SECTIONS.has(s as ResumeTargetSection)
    ? (s as ResumeTargetSection)
    : "experience";
}

function category(raw: GrokResumeRuleRaw, section: ResumeTargetSection): ResumeRuleCategory {
  if (raw.category && CATEGORY_MAP[raw.category]) return CATEGORY_MAP[raw.category];
  return SECTION_TO_CATEGORY[section] ?? "bullet_strength";
}

function agent(raw: GrokResumeRuleRaw): ResumeRuleAgent {
  const a = raw.primary_agent;
  return (a && AGENT_MAP[a]) || "editor";
}

function severity(raw: GrokResumeRuleRaw): ResumeRuleSeverity {
  const s = raw.severity;
  if (s === "high" || s === "medium" || s === "low") return s;
  return "medium";
}

function confidence(raw: GrokResumeRuleRaw): number {
  switch (raw.confidence) {
    case "high":
      return 0.9;
    case "medium":
      return 0.7;
    case "low":
      return 0.5;
    default:
      return 0.75;
  }
}

function severityLabel(raw: GrokResumeRuleRaw, sev: ResumeRuleSeverity): ResumeUiSeverityLabel {
  const l = raw.ui_severity_label;
  if (l === "High" || l === "Medium" || l === "Low") return l;
  if (sev === "critical" || sev === "high") return "High";
  if (sev === "medium") return "Medium";
  return "Low";
}

function priorityGroup(raw: GrokResumeRuleRaw, sev: ResumeRuleSeverity): ResumePriorityGroup {
  const { highPrioritySeverity, highPriorityImplementationPriority } =
    resumeFeedbackConfig.priorityGroupLogic;
  return sev === highPrioritySeverity &&
    raw.implementation_priority === highPriorityImplementationPriority
    ? "HIGH PRIORITY"
    : "WORTH FIXING";
}

function detectionType(raw: GrokResumeRuleRaw): ResumeAdviceRule["detectionType"] {
  // Section presence/absence is deterministic; everything else needs heuristics
  // or an LLM. Real classification happens in the evaluator — this is a default.
  if (typeof raw.latex_detection_hint === "string" && /\\section\{/.test(raw.latex_detection_hint)) {
    return "hybrid";
  }
  return "heuristic";
}

export function normalizeGrokResumeRule(raw: GrokResumeRuleRaw): ResumeAdviceRule {
  const sec = targetSection(raw);
  const sev = severity(raw);
  const title =
    (typeof raw.ui_title === "string" && raw.ui_title.trim()) ||
    (typeof raw.principle === "string" ? raw.principle.slice(0, 60) : raw.rule_id);
  const why = typeof raw.why_it_matters === "string" ? raw.why_it_matters : "";
  const feedbackTemplate =
    (typeof raw.feedback_template === "string" && raw.feedback_template) ||
    (typeof raw.how_we_fix_it === "string" && raw.how_we_fix_it) ||
    (typeof raw.rewrite_instruction === "string" && raw.rewrite_instruction) ||
    "";

  return {
    ruleId: raw.rule_id,
    // rule_id is already canonical-ish (e.g. "quantify_impact_metrics"); legacy
    // findings map onto these same ids so old + new collapse to one issue.
    canonicalIssueId: raw.rule_id,
    title,
    category: category(raw, sec),
    agent: agent(raw),
    severity: sev,
    confidence: confidence(raw),
    principle: typeof raw.principle === "string" ? raw.principle : title,
    whyItMatters: why,
    detectionType: detectionType(raw),
    detectionHint: typeof raw.detection_hint === "string" ? raw.detection_hint : undefined,
    latexDetectionHint:
      typeof raw.latex_detection_hint === "string" ? raw.latex_detection_hint : undefined,
    feedbackTemplate,
    rewriteInstruction:
      typeof raw.rewrite_instruction === "string" ? raw.rewrite_instruction : undefined,
    exampleBefore: typeof raw.example_bad === "string" ? raw.example_bad : undefined,
    exampleAfter: typeof raw.example_good === "string" ? raw.example_good : undefined,
    ui: {
      title,
      targetSection: sec,
      fixActionLabel: (typeof raw.ui_fix_action === "string" && raw.ui_fix_action) || "Fix",
      severityLabel: severityLabel(raw, sev),
    },
    implementationPriority:
      typeof raw.implementation_priority === "string" ? raw.implementation_priority : undefined,
    priorityGroup: priorityGroup(raw, sev),
    tags: Array.isArray(raw.supporting_agents)
      ? raw.supporting_agents.filter((t): t is string => typeof t === "string")
      : undefined,
    enabled: true,
    customerVisibleDefault: true,
    source: {
      type: "grok_master_rule",
      reference: "resme_master_rules.json",
      raw,
    },
  };
}
