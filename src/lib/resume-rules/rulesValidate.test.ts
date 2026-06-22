// `npm run rules:validate` runs this via vitest (the repo has no standalone TS
// runner). It loads + validates the bundled Grok master rules, prints a report,
// and fails if any rule has an error-level issue.

import { describe, expect, it } from "vitest";
import { loadGrokResumeRulesWithReport } from "./loadGrokResumeRules";

describe("rules:validate", () => {
  it("loads + validates the Grok master rules with no errors", () => {
    const { rules, validation } = loadGrokResumeRulesWithReport();
    const errors = validation.issues.filter((i) => i.level === "error");
    const warnings = validation.issues.filter((i) => i.level === "warning");

    const byCategory: Record<string, number> = {};
    const bySeverity: Record<string, number> = {};
    const byPriority: Record<string, number> = {};
    for (const r of rules) {
      byCategory[r.category] = (byCategory[r.category] ?? 0) + 1;
      bySeverity[r.severity] = (bySeverity[r.severity] ?? 0) + 1;
      byPriority[r.priorityGroup] = (byPriority[r.priorityGroup] ?? 0) + 1;
    }

    console.log(
      "\n[rules:validate]\n" +
        JSON.stringify(
          {
            totalSeen: validation.totalSeen,
            valid: rules.length,
            errors: errors.length,
            warnings: warnings.length,
            byCategory,
            bySeverity,
            byPriority,
            sampleWarnings: warnings.slice(0, 5),
          },
          null,
          2,
        ),
    );

    expect(errors).toEqual([]);
    expect(rules.length).toBeGreaterThan(0);
  });
});
