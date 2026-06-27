import { describe, expect, it } from "vitest";
import {
  appendFitEntry,
  ensureInitialHistory,
  shouldEscalateToMichael,
  simulateRecheckScore,
} from "./fit-history";
import type { FitBreakdown, FitHistoryEntry } from "@/lib/types";

const AT = "2026-06-27T00:00:00.000Z";
const entry = (
  overall: number,
  source: FitHistoryEntry["source"],
): FitHistoryEntry => ({ overall, verdict: "Weak fit", at: AT, source });

const fit = (overall: number): FitBreakdown => ({
  overall,
  verdict: "Weak fit",
  dimensions: [],
  locationPass: true,
  locationNote: "",
  summary: "",
});

describe("appendFitEntry", () => {
  it("appends a new point and preserves order", () => {
    const h = appendFitEntry([entry(35, "initial")], 48, "Weak fit", "recheck", AT);
    expect(h).toHaveLength(2);
    expect(h[1]).toEqual({ overall: 48, verdict: "Weak fit", at: AT, source: "recheck" });
  });

  it("does not mutate the input array", () => {
    const orig = [entry(35, "initial")];
    appendFitEntry(orig, 48, "Weak fit", "recheck", AT);
    expect(orig).toHaveLength(1);
  });

  it("treats undefined history as empty", () => {
    expect(appendFitEntry(undefined, 35, "Weak fit", "initial", AT)).toHaveLength(1);
  });
});

describe("ensureInitialHistory", () => {
  it("backfills a single initial point from result.fit when empty", () => {
    const h = ensureInitialHistory({ fit: fit(42), fitHistory: undefined }, AT);
    expect(h).toEqual([{ overall: 42, verdict: "Weak fit", at: AT, source: "initial" }]);
  });

  it("is idempotent — returns an existing history unchanged", () => {
    const existing = [entry(35, "initial"), entry(48, "recheck")];
    expect(ensureInitialHistory({ fit: fit(48), fitHistory: existing }, AT)).toBe(existing);
  });
});

describe("shouldEscalateToMichael", () => {
  it("is false for empty / undefined history", () => {
    expect(shouldEscalateToMichael(undefined)).toBe(false);
    expect(shouldEscalateToMichael([])).toBe(false);
  });

  it("is false with only an initial score, even when under 70", () => {
    expect(shouldEscalateToMichael([entry(35, "initial")])).toBe(false);
  });

  it("is true after a re-check that is still under 70", () => {
    expect(shouldEscalateToMichael([entry(35, "initial"), entry(52, "recheck")])).toBe(true);
  });

  it("is false once a re-check reaches 70+", () => {
    expect(shouldEscalateToMichael([entry(60, "initial"), entry(75, "recheck")])).toBe(false);
  });

  it("uses the latest entry — a later 70+ re-check clears it", () => {
    expect(
      shouldEscalateToMichael([entry(35, "initial"), entry(52, "recheck"), entry(80, "recheck")]),
    ).toBe(false);
  });

  it("treats exactly 70 as not-escalated (strict < 70)", () => {
    expect(shouldEscalateToMichael([entry(40, "initial"), entry(70, "recheck")])).toBe(false);
  });
});

describe("simulateRecheckScore", () => {
  it("returns the previous score when the doc was not edited", () => {
    expect(simulateRecheckScore(35, "some resume text", false)).toBe(35);
  });

  it("is deterministic for the same inputs", () => {
    const a = simulateRecheckScore(35, "resume text", true);
    const b = simulateRecheckScore(35, "resume text", true);
    expect(a).toBe(b);
  });

  it("nudges the score up when edited", () => {
    expect(simulateRecheckScore(35, "resume text", true)).toBeGreaterThan(35);
  });

  it("never exceeds 96", () => {
    expect(simulateRecheckScore(95, "resume text", true)).toBeLessThanOrEqual(96);
  });
});
