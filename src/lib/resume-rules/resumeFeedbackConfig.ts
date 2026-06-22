// Tuning knobs for the resume-feedback pipeline. Change behavior here without
// touching pipeline code. Env vars allow per-deploy overrides (e.g. kill Grok
// rules in prod without a code change).

function envFlag(name: string, fallback: boolean): boolean {
  const v = process.env[name];
  if (v === undefined) return fallback;
  return v === "1" || v.toLowerCase() === "true";
}

export const resumeFeedbackConfig = {
  enableGrokMasterRules: envFlag("RESUME_RULES_ENABLE_GROK", true),
  enableLegacyCriteria: envFlag("RESUME_RULES_ENABLE_LEGACY", true),

  resumeFormat: "latex" as const,

  // Surfacing caps — the customer sees a focused set, never the full rule sweep.
  maxSuggestionsFree: 5,
  maxSuggestionsPaid: 10,
  maxPerCategory: 2,
  maxFormattingSuggestions: 3,
  minConfidenceToSurface: 0.6,

  enableDedupe: true,
  enableRepeatedBulletCollapse: true,

  showSuppressedInDebug: true,

  // Mirrors the Grok grouping: HIGH PRIORITY iff high severity AND v1_core.
  priorityGroupLogic: {
    highPrioritySeverity: "high" as const,
    highPriorityImplementationPriority: "v1_core" as const,
  },
} as const;

export type ResumeFeedbackConfig = typeof resumeFeedbackConfig;
