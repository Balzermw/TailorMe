import { describe, expect, it } from "vitest";
import { PACKS, MICHAEL_ADDON_CENTS, getPack, packIdByName } from "./packs";

describe("packs", () => {
  it("has the three packs with the brief's pricing and credits", () => {
    expect(PACKS.starter.amountCents).toBe(1900);
    expect(PACKS.starter.credits).toBe(5);
    expect(PACKS.jobhunt.amountCents).toBe(4900);
    expect(PACKS.jobhunt.credits).toBe(15);
    expect(PACKS.allin.amountCents).toBe(9900);
    expect(PACKS.allin.credits).toBe(40);
    expect(MICHAEL_ADDON_CENTS).toBe(4900);
  });

  it("getPack returns a pack by id, null for unknown", () => {
    expect(getPack("jobhunt")?.credits).toBe(15);
    expect(getPack("nope")).toBeNull();
    expect(getPack("")).toBeNull();
  });

  it("packIdByName maps display names to ids and defaults to jobhunt", () => {
    expect(packIdByName("Starter")).toBe("starter");
    expect(packIdByName("Job hunt")).toBe("jobhunt");
    expect(packIdByName("All in")).toBe("allin");
    expect(packIdByName("Unknown")).toBe("jobhunt");
  });
});
