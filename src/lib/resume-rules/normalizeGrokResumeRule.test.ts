import { describe, expect, it } from "vitest";
import { normalizeGrokResumeRule } from "./normalizeGrokResumeRule";
import { validateGrokMasterRules } from "./grokResumeRule.schema";
import { loadGrokResumeRules } from "./loadGrokResumeRules";
import { makeFindingId, makeDedupeFingerprint, fnv1a } from "./stableId";
import type { GrokResumeRuleRaw } from "./resumeAdviceRule.types";

const HIGH_CORE: GrokResumeRuleRaw = {
  rule_id: "quantify_impact_metrics",
  category: "Quantification, metrics & impact",
  primary_agent: "quantifier",
  principle: "Quantify impact with metrics wherever truthfully possible.",
  severity: "high",
  implementation_priority: "v1_core",
  why_it_matters: "Metrics make impact concrete.",
  rewrite_instruction: "Add a supportable metric.",
  example_bad: "Responsible for features.",
  example_good: "Shipped features that cut load time 40%.",
  confidence: "high",
  ui_title: "Impact is described, not quantified",
  ui_target_section: "experience",
  ui_fix_action: "Rewrite bullet",
  ui_severity_label: "High",
  latex_detection_hint: "Inspect each \\item under \\section{Experience} for numbers.",
};

describe("normalizeGrokResumeRule", () => {
  it("maps core fields + ui block", () => {
    const r = normalizeGrokResumeRule(HIGH_CORE);
    expect(r.ruleId).toBe("quantify_impact_metrics");
    expect(r.canonicalIssueId).toBe("quantify_impact_metrics");
    expect(r.title).toBe("Impact is described, not quantified");
    expect(r.category).toBe("quantification");
    expect(r.agent).toBe("max"); // quantifier → max
    expect(r.severity).toBe("high");
    expect(r.ui.targetSection).toBe("experience");
    expect(r.ui.fixActionLabel).toBe("Rewrite bullet");
    expect(r.ui.severityLabel).toBe("High");
    expect(r.exampleBefore).toBe("Responsible for features.");
    expect(r.exampleAfter).toBe("Shipped features that cut load time 40%.");
    expect(r.source.type).toBe("grok_master_rule");
    expect(r.source.raw).toBe(HIGH_CORE); // raw preserved
  });

  it("priorityGroup: high + v1_core → HIGH PRIORITY", () => {
    expect(normalizeGrokResumeRule(HIGH_CORE).priorityGroup).toBe("HIGH PRIORITY");
  });

  it("priorityGroup: everything else → WORTH FIXING", () => {
    expect(
      normalizeGrokResumeRule({ ...HIGH_CORE, severity: "medium" }).priorityGroup,
    ).toBe("WORTH FIXING");
    expect(
      normalizeGrokResumeRule({ ...HIGH_CORE, implementation_priority: "v1_enhancement" })
        .priorityGroup,
    ).toBe("WORTH FIXING");
  });

  it("maps each primary_agent to a canonical agent", () => {
    const agentOf = (a: string) =>
      normalizeGrokResumeRule({ ...HIGH_CORE, primary_agent: a }).agent;
    expect(agentOf("ats")).toBe("ada");
    expect(agentOf("quantifier")).toBe("max");
    expect(agentOf("hiring_manager")).toBe("remy");
    expect(agentOf("strategist")).toBe("strategist");
    expect(agentOf("editor")).toBe("editor");
    expect(agentOf("unknown")).toBe("editor"); // conservative fallback
  });

  it("falls back to section-derived category + experience section on unknowns", () => {
    const r = normalizeGrokResumeRule({
      rule_id: "x",
      severity: "low",
      category: "Totally Unknown Category",
      ui_target_section: "skills",
    });
    expect(r.category).toBe("skills"); // from section fallback
    expect(r.ui.targetSection).toBe("skills");
    const r2 = normalizeGrokResumeRule({ rule_id: "y", severity: "low" });
    expect(r2.ui.targetSection).toBe("experience");
    expect(r2.ui.fixActionLabel).toBe("Fix");
  });
});

describe("validateGrokMasterRules", () => {
  it("throws on a non-object file or missing rules array", () => {
    expect(() => validateGrokMasterRules(null)).toThrow();
    expect(() => validateGrokMasterRules({})).toThrow();
    expect(() => validateGrokMasterRules({ rules: "nope" })).toThrow();
  });

  it("drops rules missing rule_id/severity with an error issue, keeps valid ones", () => {
    const v = validateGrokMasterRules({
      rules: [
        { rule_id: "ok", severity: "high" },
        { severity: "high" }, // no rule_id
        { rule_id: "nosev" }, // no severity
        { rule_id: "weird", severity: "spicy" }, // warning, still kept
      ],
    });
    expect(v.rules.map((r) => r.rule_id)).toEqual(["ok", "weird"]);
    expect(v.issues.filter((i) => i.level === "error").length).toBe(2);
    expect(v.issues.some((i) => i.level === "warning")).toBe(true);
  });
});

describe("loadGrokResumeRules (bundled file)", () => {
  it("loads all 79 rules and normalizes them", () => {
    const rules = loadGrokResumeRules();
    expect(rules.length).toBe(79);
    expect(rules.every((r) => r.ruleId && r.category && r.agent)).toBe(true);
    expect(rules.some((r) => r.priorityGroup === "HIGH PRIORITY")).toBe(true);
  });
});

describe("stableId", () => {
  it("fnv1a is deterministic + stable width", () => {
    expect(fnv1a("abc")).toBe(fnv1a("abc"));
    expect(fnv1a("abc")).not.toBe(fnv1a("abd"));
    expect(fnv1a("abc")).toHaveLength(8);
  });

  it("makeFindingId is deterministic for the same inputs", () => {
    const a = makeFindingId({ ruleId: "r", canonicalIssueId: "r", evidence: "x", section: "experience" });
    const b = makeFindingId({ ruleId: "r", canonicalIssueId: "r", evidence: "x", section: "experience" });
    const c = makeFindingId({ ruleId: "r", canonicalIssueId: "r", evidence: "y", section: "experience" });
    expect(a).toBe(b);
    expect(a).not.toBe(c);
    expect(a.startsWith("r_")).toBe(true);
  });

  it("dedupe fingerprint ignores evidence (same issue+section collapses)", () => {
    const a = makeDedupeFingerprint({ canonicalIssueId: "r", section: "experience" });
    const b = makeDedupeFingerprint({ canonicalIssueId: "r", section: "experience" });
    expect(a).toBe(b);
  });
});
