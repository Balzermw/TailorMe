import { describe, expect, it } from "vitest";
import {
  groundFindings,
  isTemplateOwnedFinding,
  evidenceGrounded,
  normalizeForMatch,
} from "./groundFindings";
import type { ProofPoint } from "@/lib/types";

const pp = (over: Partial<ProofPoint>): ProofPoint => ({
  title: "",
  summary: "",
  why: "",
  fix: "",
  severity: "medium",
  ...over,
});

describe("isTemplateOwnedFinding — drops template-owned / myth findings", () => {
  it("contact scattered / consolidate myth", () => {
    expect(
      isTemplateOwnedFinding(
        pp({
          title: "Contact info lacks consistent formatting and is scattered",
          fix: "Consolidate contact info in a single header line for clear parsing.",
        }),
      ),
    ).toBe(true);
  });
  it("add Phone:/Email: labels myth", () => {
    expect(
      isTemplateOwnedFinding(
        pp({ title: "Missing contact information labels", fix: "Add labels such as 'Phone:', 'Email:'." }),
      ),
    ).toBe(true);
  });
  it("spacing / concatenation extraction artifacts", () => {
    expect(
      isTemplateOwnedFinding(pp({ title: "Spacing issues", summary: "bullets have missing spaces between words" })),
    ).toBe(true);
    expect(isTemplateOwnedFinding(pp({ title: "Skills concatenated without spaces" }))).toBe(true);
  });
  it("ATS / column / font / alignment formatting", () => {
    expect(isTemplateOwnedFinding(pp({ title: "Use a single-column ATS-friendly layout" }))).toBe(true);
    expect(isTemplateOwnedFinding(pp({ title: "Inconsistent font and alignment across sections" }))).toBe(true);
  });
});

describe("isTemplateOwnedFinding — keeps real content findings", () => {
  const keep: Array<[string, Partial<ProofPoint>]> = [
    ["keywords", { title: "Add 8 keywords the posting screens for", fix: "Work these into experience and skills." }],
    ["metrics", { title: "Bullet points lack quantified impact", fix: "Add a metric showing the result." }],
    ["summary", { title: "Lack of professional summary", fix: "Add a concise 1-2 sentence summary." }],
    ["bold verbs (not visual bold)", { title: "Use bold action verbs to lead each bullet" }],
    ["align WITH role (not alignment)", { title: "Align your experience with the role's priorities" }],
    ["responsibilities", { title: "Bullets read as responsibilities, not accomplishments" }],
  ];
  for (const [name, over] of keep) {
    it(name, () => expect(isTemplateOwnedFinding(pp(over))).toBe(false));
  }
});

describe("evidenceGrounded", () => {
  const hay = normalizeForMatch(
    "Built Stories Mode, an AI flow with React and Node.js. Increased Backcountry sales by 4.1M.",
  );
  it("keeps a quote present in the résumé", () => {
    expect(evidenceGrounded(hay, "Built Stories Mode, an AI flow with React")).toBe(true);
  });
  it("drops a hallucinated quote", () => {
    expect(evidenceGrounded(hay, "Managed a team of 40 engineers across five continents")).toBe(false);
  });
  it("keeps additive findings with no/short quote", () => {
    expect(evidenceGrounded(hay, undefined)).toBe(true);
    expect(evidenceGrounded(hay, "n/a")).toBe(true);
  });
  it("tolerates light edits via word overlap", () => {
    expect(evidenceGrounded(hay, "Built Stories Mode an AI-powered flow using React")).toBe(true);
  });
});

describe("groundFindings — end to end", () => {
  const hay = normalizeForMatch("Reduced costs by 30% across the platform. Led migration to Postgres.");
  it("drops template-owned + ungrounded, keeps real", () => {
    const out = groundFindings(
      [
        pp({ title: "Contact scattered", fix: "consolidate contact into one header line" }),
        pp({ title: "Quantify this bullet", quote: "Led migration to Postgres", fix: "add a metric" }),
        pp({ title: "Fabricated", quote: "Architected a global trading system handling billions daily", fix: "x" }),
        pp({ title: "Add keywords", fix: "include Kubernetes and Terraform" }),
      ],
      hay,
      { templated: true },
    );
    expect(out.map((p) => p.title)).toEqual(["Quantify this bullet", "Add keywords"]);
  });
  it("keeps template-owned findings when not templated (uploaded original)", () => {
    const out = groundFindings([pp({ title: "Inconsistent font" })], hay, { templated: false });
    expect(out).toHaveLength(1);
  });
});
