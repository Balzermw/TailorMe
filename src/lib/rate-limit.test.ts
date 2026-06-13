import { afterEach, describe, expect, it } from "vitest";
import { consume, getClientIp, _resetForTests } from "./rate-limit";

afterEach(() => _resetForTests());

describe("consume (fixed-window limiter)", () => {
  it("allows up to the limit, then blocks within the window", () => {
    const rules = [{ limit: 3, windowMs: 1000 }];
    const t = 1_000_000;
    expect(consume("k", rules, t).allowed).toBe(true); // 1
    expect(consume("k", rules, t).allowed).toBe(true); // 2
    const third = consume("k", rules, t); // 3
    expect(third.allowed).toBe(true);
    expect(third.remaining).toBe(0);
    expect(consume("k", rules, t).allowed).toBe(false); // 4 → over
  });

  it("resets once the window elapses", () => {
    const rules = [{ limit: 1, windowMs: 1000 }];
    expect(consume("k", rules, 1000).allowed).toBe(true);
    expect(consume("k", rules, 1500).allowed).toBe(false); // same window
    expect(consume("k", rules, 2001).allowed).toBe(true); // new window
  });

  it("blocks when any of several windows is exceeded", () => {
    const rules = [
      { limit: 5, windowMs: 1000 }, // hourly-ish
      { limit: 2, windowMs: 10_000 }, // daily-ish
    ];
    const t = 5_000_000;
    expect(consume("k", rules, t).allowed).toBe(true); // daily 1/2
    expect(consume("k", rules, t).allowed).toBe(true); // daily 2/2
    expect(consume("k", rules, t).allowed).toBe(false); // daily exceeded
  });

  it("keys are independent", () => {
    const rules = [{ limit: 1, windowMs: 1000 }];
    expect(consume("a", rules, 1).allowed).toBe(true);
    expect(consume("b", rules, 1).allowed).toBe(true);
  });
});

describe("getClientIp", () => {
  it("takes the first x-forwarded-for entry", () => {
    const req = new Request("http://x", {
      headers: { "x-forwarded-for": "1.2.3.4, 5.6.7.8" },
    });
    expect(getClientIp(req)).toBe("1.2.3.4");
  });

  it("falls back to 'local' with no proxy headers", () => {
    expect(getClientIp(new Request("http://x"))).toBe("local");
  });
});
