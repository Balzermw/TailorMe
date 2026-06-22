// Load + validate + normalize the vendored Grok master rules into canonical
// ResumeAdviceRule[]. The JSON is bundled (resolveJsonModule), so this works in
// every runtime (server, test, edge) with no filesystem access.

import masterRulesJson from "./data/resme_master_rules.json";
import {
  validateGrokMasterRules,
  rulesAreValid,
  type ValidatedGrokRules,
} from "./grokResumeRule.schema";
import { normalizeGrokResumeRule } from "./normalizeGrokResumeRule";
import type { ResumeAdviceRule } from "./resumeAdviceRule.types";

export interface LoadedRules {
  rules: ResumeAdviceRule[];
  validation: ValidatedGrokRules;
}

/** Validate the bundled master rules; throws only on a structurally broken file. */
export function loadRawGrokRules(): ValidatedGrokRules {
  const validation = validateGrokMasterRules(masterRulesJson);
  // In dev/test, a malformed rule should be loud, not silently dropped.
  if (process.env.NODE_ENV !== "production" && !rulesAreValid(validation)) {
    const errs = validation.issues
      .filter((i) => i.level === "error")
      .map((i) => `[${i.index}] ${i.ruleId ?? "?"}: ${i.message}`)
      .join("; ");
    throw new Error(`master rules: ${errs}`);
  }
  return validation;
}

let cached: ResumeAdviceRule[] | null = null;

/** All enabled, normalized Grok rules (memoized — the file is static). */
export function loadGrokResumeRules(): ResumeAdviceRule[] {
  if (cached) return cached;
  const { rules } = loadRawGrokRules();
  cached = rules.map(normalizeGrokResumeRule).filter((r) => r.enabled);
  return cached;
}

/** Full load result incl. validation issues — for the validate CLI / Rule Lab. */
export function loadGrokResumeRulesWithReport(): LoadedRules {
  const validation = loadRawGrokRules();
  return { rules: validation.rules.map(normalizeGrokResumeRule), validation };
}
