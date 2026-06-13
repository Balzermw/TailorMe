import { describe, expect, it } from "vitest";
import { initials } from "./session";

describe("initials", () => {
  it("takes the first letter of the first two words, uppercased", () => {
    expect(initials("Alex Mercer")).toBe("AM");
    expect(initials("rubber ducky")).toBe("RD");
    expect(initials("madonna")).toBe("M");
    expect(initials("a b c d")).toBe("AB"); // capped at two
  });

  it("falls back when empty", () => {
    expect(initials("")).toBe("AM");
    expect(initials(undefined)).toBe("AM");
  });
});
