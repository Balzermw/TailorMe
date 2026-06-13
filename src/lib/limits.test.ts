import { describe, expect, it } from "vitest";
import {
  MAX_POSTING_CHARS,
  MAX_RESUME_CHARS,
  validateApplyInput,
} from "./limits";

describe("validateApplyInput", () => {
  it("accepts normal-sized inputs", () => {
    expect(validateApplyInput("a".repeat(8000), "b".repeat(2000))).toBeNull();
  });

  it("rejects an oversized posting", () => {
    const msg = validateApplyInput("ok", "b".repeat(MAX_POSTING_CHARS + 1));
    expect(msg).toMatch(/posting is too long/i);
  });

  it("rejects an oversized resume", () => {
    const msg = validateApplyInput("a".repeat(MAX_RESUME_CHARS + 1), "ok");
    expect(msg).toMatch(/resume is too long/i);
  });
});
