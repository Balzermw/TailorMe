// Rule Lab — developer iteration tool. Runs the deterministic pipeline on a
// résumé (+ optional JD) and writes the full debug bundle to ./debug, plus a
// readable funnel report to the console. Zero LLM.
//
//   npm run rules:test
//   RULE_LAB_RESUME=./samples/x.tex RULE_LAB_JOB=./samples/jd.txt npm run rules:test
//
// (vitest is the repo's only TS runner, so the CLI rides on it; env vars stand
// in for the spec's --resume/--job flags.)

import { describe, expect, it } from "vitest";
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { evaluateResumeRules } from "./evaluateResumeRules";

function read(pathFromEnv: string | undefined, fallbackUrl: string): string {
  if (pathFromEnv && existsSync(pathFromEnv)) return readFileSync(pathFromEnv, "utf-8");
  return readFileSync(fileURLToPath(new URL(fallbackUrl, import.meta.url)), "utf-8");
}

describe("rules:test (Rule Lab)", () => {
  it("runs the pipeline + writes ./debug artifacts", () => {
    const latexSource = read(process.env.RULE_LAB_RESUME, "./__fixtures__/weak-resume.tex");
    const jobText = process.env.RULE_LAB_JOB
      ? readFileSync(process.env.RULE_LAB_JOB, "utf-8")
      : undefined;
    const tier = process.env.RULE_LAB_TIER === "paid" ? "paid" : "free";

    const r = evaluateResumeRules({ latexSource, jobText, tier });

    const debugDir = fileURLToPath(new URL("../../../debug/", import.meta.url));
    try {
      mkdirSync(debugDir, { recursive: true });
      const w = (name: string, data: unknown) =>
        writeFileSync(`${debugDir}${name}`, JSON.stringify(data, null, 2));
      w("rule-run-candidates.json", r.candidates);
      w("rule-run-deduped.json", r.deduped);
      w("rule-run-suppressed.json", r.suppressed);
      w("rule-run-surfaced.json", r.surfaced);
      w("rule-run-ui-feedback.json", r.ui);
    } catch {
      /* read-only FS in CI is fine — the report below is the point */
    }

    console.log(
      "\n========== RULE LAB ==========\n" +
        `tier: ${tier}\n` +
        JSON.stringify(
          {
            rulesLoaded: r.stats.rulesLoaded,
            candidateFindingsCount: r.stats.candidateFindingsCount,
            dedupedFindingsCount: r.stats.dedupedFindingsCount,
            surfacedSuggestionsCount: r.stats.surfacedSuggestionsCount,
            suppressedCount: r.stats.suppressedCount,
            byCategory: r.stats.byCategory,
            bySeverity: r.stats.bySeverity,
            byPriorityGroup: r.stats.byPriorityGroup,
          },
          null,
          2,
        ) +
        "\n\nSURFACED SUGGESTIONS (what the customer sees):\n" +
        r.surfaced
          .map(
            (f, i) =>
              `${i + 1}. [${f.uiSeverityLabel}/${f.priorityGroup}] ${f.title}` +
              `\n    → ${f.suggestedFix}` +
              (f.occurrences && f.occurrences > 1 ? `  (×${f.occurrences})` : "") +
              `  {${f.ruleId}}`,
          )
          .join("\n") +
        "\n==============================\n",
    );

    expect(r.surfaced.length).toBeGreaterThan(0);
    expect(r.surfaced.length).toBeLessThanOrEqual(10);
  });
});
