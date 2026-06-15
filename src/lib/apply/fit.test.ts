import { describe, expect, it } from "vitest";
import { shouldSuggestManualReview, verdictTier } from "./pipeline";
import { POOR_FIT_CASES } from "./fit-fixtures";

describe("verdictTier", () => {
  it("maps overall scores to the repo's verdict tiers", () => {
    expect(verdictTier(90)).toBe("Strong");
    expect(verdictTier(75)).toBe("Strong");
    expect(verdictTier(74)).toBe("Good");
    expect(verdictTier(60)).toBe("Good");
    expect(verdictTier(50)).toBe("Moderate");
    expect(verdictTier(40)).toBe("Weak");
    expect(verdictTier(20)).toBe("Poor");
  });
});

describe("shouldSuggestManualReview", () => {
  it("nudges a review for anything short of a clear Strong fit", () => {
    expect(shouldSuggestManualReview({ overall: 50 })).toBe(true);
    expect(shouldSuggestManualReview({ overall: 74 })).toBe(true);
  });

  it("nudges a review when several must-have keywords are missing, even at a high score", () => {
    expect(
      shouldSuggestManualReview({
        overall: 82,
        keywords: [
          { inResume: false },
          { inResume: false },
          { inResume: false },
          { inResume: true },
        ],
      }),
    ).toBe(true);
  });

  it("does not nudge for a clear strong fit with good keyword coverage", () => {
    expect(
      shouldSuggestManualReview({
        overall: 88,
        keywords: [{ inResume: true }, { inResume: true }, { inResume: false }],
      }),
    ).toBe(false);
  });
});

describe("poor-fit fixtures", () => {
  it("provides several intentionally weak resume/target pairs for honesty checks", () => {
    expect(POOR_FIT_CASES.length).toBeGreaterThanOrEqual(4);
    for (const c of POOR_FIT_CASES) {
      expect(c.resume.length).toBeGreaterThan(40);
      expect(c.target.length).toBeGreaterThan(40);
      expect(["Good", "Moderate", "Weak", "Poor"]).toContain(c.expectAtMost);
    }
  });
});
