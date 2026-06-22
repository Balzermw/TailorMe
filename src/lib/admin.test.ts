import { describe, expect, it } from "vitest";
import { emailIsAdmin, parseAdmins } from "./admin";

describe("admin allowlist", () => {
  const csv = "owner@resme.io, Ops@ResMe.io";

  it("matches allowlisted emails case-insensitively", () => {
    expect(emailIsAdmin("owner@resme.io", csv)).toBe(true);
    expect(emailIsAdmin("OWNER@RESME.IO", csv)).toBe(true);
    expect(emailIsAdmin("ops@resme.io", csv)).toBe(true);
  });

  it("rejects non-admins and empty/missing input", () => {
    expect(emailIsAdmin("random@user.com", csv)).toBe(false);
    expect(emailIsAdmin("", csv)).toBe(false);
    expect(emailIsAdmin(null, csv)).toBe(false);
    expect(emailIsAdmin(undefined, csv)).toBe(false);
  });

  it("denies everyone when the allowlist is empty (safe default)", () => {
    expect(emailIsAdmin("owner@resme.io", "")).toBe(false);
    expect(emailIsAdmin("owner@resme.io", undefined)).toBe(false);
    expect(parseAdmins("").size).toBe(0);
  });

  it("parses + normalizes the csv", () => {
    expect([...parseAdmins(" a@b.com , C@D.com ")]).toEqual(["a@b.com", "c@d.com"]);
  });
});
