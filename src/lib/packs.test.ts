import { describe, expect, it } from "vitest";
import {
  PLANS,
  ADD_ONS,
  getPlan,
  getAddOn,
  resolveAddOns,
  buildCheckout,
  EXPERT_FEEDBACK_CENTS,
} from "./packs";

describe("pricing config", () => {
  it("has the three plans with the new pricing + credits", () => {
    expect(PLANS.starter.amountCents).toBe(2900);
    expect(PLANS.starter.credits).toBe(5);
    expect(PLANS.starter.per).toBe("$5.80");
    expect(PLANS.job_hunt.amountCents).toBe(6900);
    expect(PLANS.job_hunt.credits).toBe(15);
    expect(PLANS.job_hunt.per).toBe("$4.60");
    expect(PLANS.campaign.amountCents).toBe(12900);
    expect(PLANS.campaign.credits).toBe(35);
    expect(PLANS.campaign.per).toBe("$3.69");
  });

  it("per-application prices match price ÷ credits", () => {
    for (const p of Object.values(PLANS)) {
      const perApp = p.amountCents / 100 / p.credits;
      expect(Number(p.per.replace("$", ""))).toBeCloseTo(perApp, 1);
    }
  });

  it("has the two human add-ons at the new prices that grant no credits", () => {
    expect(ADD_ONS.expert_feedback.amountCents).toBe(7900);
    expect(ADD_ONS.human_revision.amountCents).toBe(14900);
    expect(ADD_ONS.expert_feedback.grantsCredits).toBe(0);
    expect(ADD_ONS.human_revision.grantsCredits).toBe(0);
    expect(EXPERT_FEEDBACK_CENTS).toBe(7900);
  });

  it("getPlan / getAddOn resolve by slug, null for unknown", () => {
    expect(getPlan("job_hunt")?.credits).toBe(15);
    expect(getPlan("allin")).toBeNull(); // old slug gone
    expect(getPlan("")).toBeNull();
    expect(getAddOn("expert_feedback")?.amountCents).toBe(7900);
    expect(getAddOn("nope")).toBeNull();
  });

  it("resolveAddOns validates, dedupes, and drops unknowns", () => {
    expect(resolveAddOns(["expert_feedback", "human_revision"]).map((a) => a.slug)).toEqual([
      "expert_feedback",
      "human_revision",
    ]);
    expect(resolveAddOns(["expert_feedback", "expert_feedback"]).length).toBe(1);
    expect(resolveAddOns(["bogus", 42, null])).toEqual([]);
    expect(resolveAddOns("expert_feedback")).toEqual([]); // not an array
    expect(resolveAddOns(undefined)).toEqual([]);
  });
});

describe("buildCheckout", () => {
  it("grants only the plan's credits — add-ons never add credits", () => {
    const noAddon = buildCheckout(PLANS.job_hunt, []);
    expect(noAddon.credits).toBe(15);
    const withAddons = buildCheckout(PLANS.job_hunt, [
      ADD_ONS.expert_feedback,
      ADD_ONS.human_revision,
    ]);
    expect(withAddons.credits).toBe(15); // unchanged
  });

  it("sums the plan + add-on amounts into the total", () => {
    const c = buildCheckout(PLANS.starter, [ADD_ONS.expert_feedback]);
    expect(c.totalCents).toBe(2900 + 7900);
    const c2 = buildCheckout(PLANS.campaign, [
      ADD_ONS.expert_feedback,
      ADD_ONS.human_revision,
    ]);
    expect(c2.totalCents).toBe(12900 + 7900 + 14900);
  });

  it("emits the add-on flags for order metadata", () => {
    const c = buildCheckout(PLANS.starter, [ADD_ONS.human_revision]);
    expect(c.expertFeedbackAdded).toBe(false);
    expect(c.humanRevisionAdded).toBe(true);
  });

  it("builds one line item per plan + add-on", () => {
    const c = buildCheckout(PLANS.job_hunt, [ADD_ONS.expert_feedback]);
    expect(c.lineItems).toHaveLength(2);
    expect(c.lineItems[0].amountCents).toBe(6900);
    expect(c.lineItems[1].amountCents).toBe(7900);
    expect(c.lineItems[0].name).toContain("Job Hunt");
  });
});
