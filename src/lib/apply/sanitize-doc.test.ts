import { describe, expect, it } from "vitest";
import { normalizeHeadline, sanitizeDoc, stripTemplateGuidance } from "./sanitize-doc";

describe("normalizeHeadline", () => {
  it("uses the target role when an AI headline is a mini summary", () => {
    expect(
      normalizeHeadline(
        "Engineer with implementation, integration, and cross-functional project leadership experience",
        "Oracle CX Implementation Consultant (Utilities) - Director",
      ),
    ).toBe("Oracle CX Implementation Consultant (Utilities) - Director");
  });

  it("compacts sentence-like headlines when no target role is available", () => {
    expect(
      normalizeHeadline(
        "Engineer with implementation, integration, and cross-functional project leadership experience",
      ),
    ).toBe("Implementation Engineer");
  });

  it("keeps concise role titles intact", () => {
    expect(normalizeHeadline("Senior Platform Engineer")).toBe("Senior Platform Engineer");
  });

  it("preserves a multi-part role title (does not truncate at the comma)", () => {
    expect(normalizeHeadline("Lead, Product Management")).toBe("Lead, Product Management");
  });

  it("still collapses a pipe-separated buzzword pile to the lead role", () => {
    expect(
      normalizeHeadline("Senior Product Leader | SaaS & AI Innovator | Growth Driver"),
    ).toBe("Senior Product Leader");
  });

  it("recovers a title truncated to a prefix of the target role", () => {
    expect(normalizeHeadline("Lead", "Lead, Product Management")).toBe("Lead, Product Management");
  });

  it("does not over-extend an unrelated longer headline", () => {
    expect(normalizeHeadline("Senior Platform Engineer", "Engineer")).toBe("Senior Platform Engineer");
  });

  it("does not recover a fallback that only shares a character prefix", () => {
    // "Lead" must not become "Leadership Coach" (different title); the prefix
    // has to end on a word boundary to count as a truncation.
    expect(normalizeHeadline("Lead", "Leadership Coach")).toBe("Lead");
  });
});

describe("sanitizeDoc", () => {
  it("normalizes oversized resume headlines before persisting", () => {
    const doc = sanitizeDoc({
      name: "Redon Kalemaj",
      headline:
        "Engineer with implementation, integration, and cross-functional project leadership experience",
      contact: "St. Louis, MO",
      summary: "",
      experience: [
        {
          role: "Associate RF Sensor Engineer",
          company: "Boeing",
          dates: "May 2023 - Jan 2025",
          bullets: ["Implemented RF sensor systems."],
        },
      ],
      skills: ["Implementation"],
    });

    expect(doc?.headline).toBe("Implementation Engineer");
  });

  it("strips leftover template guidance from the summary", () => {
    const doc = sanitizeDoc({
      name: "Jane Doe",
      summary:
        "Reliability-focused engineer. Add a concise 1-2 sentence professional summary highlighting skills and career goals.",
      experience: [
        { role: "Engineer", company: "Acme", dates: "2020", bullets: ["Did things"] },
      ],
      skills: [],
    });
    expect(doc?.summary).toBe("Reliability-focused engineer.");
  });
});

describe("stripTemplateGuidance", () => {
  it("drops a leftover template instruction but keeps the real summary", () => {
    const input =
      "Computer Science student and builder of full-stack projects who translates complex ideas into clear value. Bilingual in English and Spanish, with hands-on experience integrating APIs.\n\nAdd a concise 1-2 sentence professional summary highlighting skills and career goals.";
    const out = stripTemplateGuidance(input);
    expect(out).toContain("Computer Science student");
    expect(out).toContain("Bilingual in English and Spanish");
    expect(out).not.toMatch(/Add a concise/i);
    expect(out).not.toMatch(/career goals/i);
  });

  it("drops bracketed placeholders and a single all-guidance sentence", () => {
    expect(stripTemplateGuidance("[Your professional summary here]")).toBe("");
    expect(stripTemplateGuidance("Add your professional summary highlighting key skills.")).toBe("");
  });

  it("leaves a genuine summary untouched", () => {
    const real =
      "Senior platform engineer with 8 years building reliable distributed systems. Cut p95 latency 38% across 2.4M daily transactions.";
    expect(stripTemplateGuidance(real)).toBe(real);
  });

  it("does not strip real sentences that merely start with risky words", () => {
    const a = "Detail-oriented engineer with 5 years of experience shipping APIs.";
    expect(stripTemplateGuidance(a)).toBe(a);
    const b = "Highlight of my career was leading the billing rewrite. Bilingual in two languages.";
    expect(stripTemplateGuidance(b)).toContain("Highlight of my career");
  });
});
