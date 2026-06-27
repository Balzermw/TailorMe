import type { ApplyResult, FitHistoryEntry } from "@/lib/types";

// Pure, deterministic helpers for the fit-score improvement loop. No LLM, no I/O,
// so they run identically on the server, the client, and in tests. The score
// timeline lives inside ApplyResult.fitHistory; persistence writers (DB + local
// storage) just call these and store the result.

/**
 * Append a new point to the timeline without mutating the input array. `at` is
 * passed in (callers stamp it) so this stays pure and test-stable.
 */
export function appendFitEntry(
  history: FitHistoryEntry[] | undefined,
  overall: number,
  verdict: string,
  source: FitHistoryEntry["source"],
  at: string,
): FitHistoryEntry[] {
  const entry: FitHistoryEntry = { overall, verdict, at, source };
  return [...(history ?? []), entry];
}

/**
 * Returns a non-empty history for a result, backfilling a single "initial" point
 * from result.fit when none exists yet. This is a read-time migration: records
 * scored before this feature shipped render a one-point timeline with no data
 * migration. Idempotent — an already-populated history is returned unchanged.
 */
export function ensureInitialHistory(
  result: Pick<ApplyResult, "fit" | "fitHistory">,
  at: string,
): FitHistoryEntry[] {
  if (result.fitHistory && result.fitHistory.length > 0) return result.fitHistory;
  const fit = result.fit;
  if (!fit) return [];
  return [
    {
      overall: fit.overall,
      verdict: fit.verdict || "",
      at,
      source: "initial",
    },
  ];
}

/**
 * Whether to surface the human-coaching (Michael) escalation. The bar: the
 * client has actually tried — at least one re-check has run — AND the latest
 * score is still under 70 (the "Good fit" threshold). Escalation is earned, not
 * a cold upsell. Uses the LATEST entry only, so a later dip below 70 re-surfaces
 * it and a climb to 70+ removes it.
 */
export function shouldEscalateToMichael(
  history: FitHistoryEntry[] | undefined,
): boolean {
  if (!history || history.length === 0) return false;
  const hasRecheck = history.some((h) => h.source === "recheck");
  const latest = history[history.length - 1];
  return hasRecheck && latest.overall < 70;
}

/**
 * Deterministic demo-mode re-score. Demo mode has no LLM, so re-checking can't
 * call scoreFit; this stands in for it. It nudges the score up when the resume
 * changed (so the loop is demonstrable) by an amount seeded off the previous
 * score + a hash of the doc text — deterministic, so reloads and tests never
 * flicker. An unchanged doc returns the previous score. Capped at 96.
 */
export function simulateRecheckScore(
  prevOverall: number,
  docText: string,
  edited: boolean,
): number {
  if (!edited) return prevOverall;
  let hash = 0;
  for (let i = 0; i < docText.length; i++) {
    hash = (hash * 31 + docText.charCodeAt(i)) | 0;
  }
  // 4–12 point bump, deterministic for a given (prevOverall, docText).
  const bump = 4 + (Math.abs(hash) % 9);
  return Math.min(96, prevOverall + bump);
}
