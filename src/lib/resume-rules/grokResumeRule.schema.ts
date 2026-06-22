// Lightweight validator for the Grok master-rules file. The repo has no zod, so
// this matches the existing plain-guard style (see lib/apply/sanitize-doc.ts).
// Philosophy: fail loudly in dev/test on a malformed file or rule; in prod,
// skip the bad rule and keep going (a single bad rule must not kill feedback).

import type { GrokResumeRuleRaw } from "./resumeAdviceRule.types";

export interface RuleValidationIssue {
  index: number;
  ruleId?: string;
  level: "error" | "warning";
  message: string;
}

export interface ValidatedGrokRules {
  rules: GrokResumeRuleRaw[]; // valid rules only
  issues: RuleValidationIssue[];
  totalSeen: number;
}

const SEVERITIES = new Set(["high", "medium", "low"]);

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

/**
 * Validate a parsed master-rules file. Throws on structural failure (not an
 * object, `rules` not an array) so a broken file is never silently empty.
 * Per-rule problems are returned as issues; rules missing `rule_id`/`severity`
 * are dropped (error issue), unknown/odd optional fields produce warnings.
 */
export function validateGrokMasterRules(raw: unknown): ValidatedGrokRules {
  if (!isObject(raw)) {
    throw new Error("master rules: file is not a JSON object");
  }
  const rulesRaw = (raw as { rules?: unknown }).rules;
  if (!Array.isArray(rulesRaw)) {
    throw new Error("master rules: `rules` is missing or not an array");
  }

  const issues: RuleValidationIssue[] = [];
  const rules: GrokResumeRuleRaw[] = [];
  const seenIds = new Set<string>();

  rulesRaw.forEach((r, index) => {
    if (!isObject(r)) {
      issues.push({ index, level: "error", message: "rule is not an object" });
      return;
    }
    const ruleId = r.rule_id;
    const severity = r.severity;

    if (typeof ruleId !== "string" || !ruleId.trim()) {
      issues.push({ index, level: "error", message: "missing/invalid rule_id" });
      return;
    }
    if (typeof severity !== "string" || !severity.trim()) {
      issues.push({ index, ruleId, level: "error", message: "missing/invalid severity" });
      return;
    }
    if (!SEVERITIES.has(severity)) {
      issues.push({
        index,
        ruleId,
        level: "warning",
        message: `unexpected severity "${severity}" (expected high|medium|low)`,
      });
    }
    if (seenIds.has(ruleId)) {
      issues.push({ index, ruleId, level: "warning", message: "duplicate rule_id" });
    }
    seenIds.add(ruleId);

    rules.push(r as GrokResumeRuleRaw);
  });

  return { rules, issues, totalSeen: rulesRaw.length };
}

/** True if there are no error-level issues. */
export function rulesAreValid(v: ValidatedGrokRules): boolean {
  return v.issues.every((i) => i.level !== "error");
}
