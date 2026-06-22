import { describe, expect, it } from "vitest";
import {
  ALLOWED_EVENTS,
  isAllowedEvent,
  sanitizeProps,
  MAX_PROPS,
  MAX_VAL_LEN,
} from "./telemetry-events";

describe("telemetry allowlist", () => {
  it("includes the new pricing/checkout/add-on events", () => {
    for (const name of [
      "pricing_viewed",
      "plan_card_clicked",
      "checkout_started",
      "purchase_completed",
      "expert_review_viewed",
      "expert_review_added",
      "expert_review_removed",
      "human_revision_viewed",
      "human_revision_added",
      "human_revision_removed",
      "free_audit_started",
      "free_audit_completed",
      "paywall_seen",
      "refund_policy_clicked",
      "faq_opened",
      "resume_feedback_suggestions_surfaced",
      "resume_feedback_suggestion_clicked",
      "resume_feedback_suggestion_expanded",
      "resume_feedback_suggestion_applied",
      "resume_feedback_suggestion_dismissed",
    ]) {
      expect(isAllowedEvent(name), name).toBe(true);
    }
  });

  it("rejects unknown / non-string event names", () => {
    expect(isAllowedEvent("drop table users")).toBe(false);
    expect(isAllowedEvent("")).toBe(false);
    expect(isAllowedEvent(null)).toBe(false);
    expect(isAllowedEvent(42)).toBe(false);
  });

  it("keeps the allowlist small (no arbitrary growth)", () => {
    expect(ALLOWED_EVENTS.size).toBeLessThan(40);
  });
});

describe("sanitizeProps", () => {
  it("keeps small primitives only", () => {
    expect(sanitizeProps({ plan_slug: "starter", price: 79, on: true })).toEqual({
      plan_slug: "starter",
      price: 79,
      on: true,
    });
  });

  it("drops objects, arrays, null, undefined, NaN (no nested/PII payloads)", () => {
    expect(
      sanitizeProps({
        nested: { resume: "secret" },
        list: ["a", "b"],
        nothing: null,
        missing: undefined,
        bad: NaN,
        keep: "ok",
      }),
    ).toEqual({ keep: "ok" });
  });

  it("truncates long string values and caps the number of keys", () => {
    const long = "x".repeat(500);
    expect(sanitizeProps({ v: long }).v).toHaveLength(MAX_VAL_LEN);

    const many: Record<string, number> = {};
    for (let i = 0; i < 50; i++) many[`k${i}`] = i;
    expect(Object.keys(sanitizeProps(many)).length).toBe(MAX_PROPS);
  });

  it("returns {} for non-objects", () => {
    expect(sanitizeProps("nope")).toEqual({});
    expect(sanitizeProps(null)).toEqual({});
    expect(sanitizeProps(123)).toEqual({});
  });
});
