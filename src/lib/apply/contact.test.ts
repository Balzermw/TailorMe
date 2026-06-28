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

  it("normalizes malformed US phone punctuation", () => {
    expect(composeContact(parseContact("314) 898-7073 | redonkale@gmail.com | St. Louis, Missouri"))).toBe(
      "314-898-7073 | redonkale@gmail.com | St. Louis, Missouri",
    );
  });

  it("normalizes common US phone variants before composing", () => {
    expect(
      composeContact({
        phone: "(314) 898-7073",
        email: "redonkale@gmail.com",
        location: "St. Louis, Missouri",
        linkedin: "",
      }),
    ).toBe("314-898-7073 | redonkale@gmail.com | St. Louis, Missouri");
  });

  it("moves a LinkedIn URL embedded in city/state into the LinkedIn field", () => {
    const fields = parseContact(
      "1222-121-2323 | fdfffgdg@gmail.com | dfdfamento, CA, linkedin.com/2332323",
    );

    expect(fields.location).toBe("dfdfamento, CA");
    expect(fields.linkedin).toBe("linkedin.com/2332323");
    expect(composeContact(fields)).toBe(
      "1222-121-2323 | fdfffgdg@gmail.com | dfdfamento, CA | linkedin.com/2332323",
    );
  });

  it("moves a portfolio URL embedded in city/state out to a trailing segment", () => {
    const fields = parseContact(
      "612-227-1149 | you@email.com | San Diego, CA, github.com/you | linkedin.com/in/you",
    );

    expect(fields.location).toBe("San Diego, CA");
    expect(fields.extra).toBe("github.com/you");
    expect(composeContact(fields)).toBe(
      "612-227-1149 | you@email.com | San Diego, CA | linkedin.com/in/you | github.com/you",
    );
  });

  it("keeps a standalone github link out of city/state", () => {
    const fields = parseContact("you@email.com | Denver, CO | github.com/you");

    expect(fields.location).toBe("Denver, CO");
    expect(fields.extra).toBe("github.com/you");
  });

  it("does not mistake a normal city/state with periods for a URL", () => {
    const fields = parseContact("612-227-1149 | you@email.com | St. Louis, MO");

    expect(fields.location).toBe("St. Louis, MO");
    expect(fields.extra).toBeUndefined();
  });

  it("treats a linkedgin.com typo as LinkedIn contact info without rewriting it", () => {
    const fields = parseContact(
      "1222-121-2323 | fdfffgdg@gmail.com | dfdfamento, CA, linkedgin.com/2332323",
    );

    expect(fields.location).toBe("dfdfamento, CA");
    expect(fields.linkedin).toBe("linkedgin.com/2332323");
    expect(composeContact(fields)).toBe(
      "1222-121-2323 | fdfffgdg@gmail.com | dfdfamento, CA | linkedgin.com/2332323",
    );
  });

  it("normalizes a pasted LinkedIn URL before composing scratch-builder fields", () => {
    expect(
      composeContact({
        phone: "612-227-1149",
        email: "you@email.com",
        location: "Sacramento, CA, LinkedIn: https://www.linkedin.com/in/michael",
        linkedin: "",
      }),
    ).toBe(
      "612-227-1149 | you@email.com | Sacramento, CA | https://www.linkedin.com/in/michael",
    );
  });

  it("keeps a citizenship token out of city/state and preserves it as its own segment", () => {
    const fields = parseContact(
      "551-249-9072 | mdmonir@example.com | United States | U.S. Citizen | LinkedIn",
    );
    expect(fields.location).toBe("United States"); // not "United States, U.S. Citizen"
    expect(fields.extra).toBe("U.S. Citizen");
    expect(composeContact(fields)).toBe(
      "551-249-9072 | mdmonir@example.com | United States | U.S. Citizen",
    );
  });

  it("round-trips a work-authorization phrase without polluting the location", () => {
    const s =
      "612-227-1149 | you@email.com | Austin, TX | Authorized to work in the US | linkedin.com/in/you";
    const fields = parseContact(s);
    expect(fields.location).toBe("Austin, TX");
    expect(fields.extra).toBe("Authorized to work in the US");
    // The auth segment trails the standard fields, but the city/state stays clean
    // and no information is dropped.
    const composed = composeContact(fields);
    expect(composed).toContain("Austin, TX");
    expect(composed).toContain("Authorized to work in the US");
    expect(composed).toContain("linkedin.com/in/you");
    // Stable across a second round-trip.
    expect(composeContact(parseContact(composed))).toBe(composed);
  });

  it("editing the city/state does not drop the preserved work-authorization segment", () => {
    const fields = parseContact(
      "551-249-9072 | mdmonir@example.com | United States | U.S. Citizen",
    );
    const edited = { ...fields, location: "Jersey City, NJ" };
    expect(composeContact(edited)).toBe(
      "551-249-9072 | mdmonir@example.com | Jersey City, NJ | U.S. Citizen",
    );
  });

  it("does not mistake a city containing 'visa' (Visalia) for work authorization", () => {
    const fields = parseContact("612-227-1149 | you@email.com | Visalia, CA");
    expect(fields.location).toBe("Visalia, CA");
    expect(fields.extra).toBeUndefined();
  });

  it("strips a LinkedIn header title + pronouns from the location", () => {
    const fields = parseContact(
      "you@email.com | Sacramento, California, United States, Advisory Solutions Consultant @ ServiceNow, He/Him",
    );
    expect(fields.location).toBe("Sacramento, California, United States");
  });

  it("strips a missing-field placeholder from the location", () => {
    expect(
      parseContact(
        "you@email.com | Sacramento, California, United States, profile not provided",
      ).location,
    ).toBe("Sacramento, California, United States");
    expect(parseContact("you@email.com | Austin, TX, location not specified").location).toBe(
      "Austin, TX",
    );
  });

  it("strips trailing pronouns even without a title", () => {
    const fields = parseContact("you@email.com | Portland, OR, They/Them");
    expect(fields.location).toBe("Portland, OR");
  });

  it("leaves a normal multi-part location untouched", () => {
    const fields = parseContact("you@email.com | San Diego, California, United States");
    expect(fields.location).toBe("San Diego, California, United States");
  });
});
