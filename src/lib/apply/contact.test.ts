import { describe, expect, it } from "vitest";
import { composeContact, parseContact } from "./contact";

describe("contact parse/compose", () => {
  it("round-trips a canonical-order string unchanged", () => {
    const s = "612-227-1149 | you@email.com | Portland, OR | linkedin.com/in/you";
    expect(composeContact(parseContact(s))).toBe(s);
  });

  it("preserves the source order when phone is last (the reorder bug)", () => {
    const s = "you@email.com | Portland, OR | 612-227-1149";
    // Before the fix this recomposed phone-first; it must stay as written.
    expect(composeContact(parseContact(s))).toBe(s);
  });

  it("editing the phone does not reshuffle the other fields", () => {
    const fields = parseContact("you@email.com | Portland, OR | 612-227-1149");
    const edited = { ...fields, phone: "555-000-1234" };
    expect(composeContact(edited)).toBe(
      "you@email.com | Portland, OR | 555-000-1234",
    );
  });

  it("appends a newly-filled field in canonical position at the end", () => {
    const fields = parseContact("you@email.com | 612-227-1149");
    const edited = { ...fields, linkedin: "linkedin.com/in/you" };
    expect(composeContact(edited)).toBe(
      "you@email.com | 612-227-1149 | linkedin.com/in/you",
    );
  });

  it("uses canonical order when no source order is present (scratch builder)", () => {
    expect(
      composeContact({
        phone: "612-227-1149",
        email: "you@email.com",
        location: "Portland, OR",
        linkedin: "",
      }),
    ).toBe("612-227-1149 | you@email.com | Portland, OR");
  });
});
