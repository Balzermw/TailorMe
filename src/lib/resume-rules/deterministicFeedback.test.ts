import { describe, expect, it } from "vitest";
import { refineFeedback } from "./deterministicFeedback";
import { groundFindings } from "./groundFindings";
import type { TailoredDoc } from "@/lib/types";

function docWith(contact: string): TailoredDoc {
  return {
    name: "Michael Balzer",
    headline: "Advisory Solutions Consultant",
    contact,
    summary: "Senior consultant with enterprise cloud-platform experience.",
    experience: [
      {
        role: "Consultant",
        company: "ServiceNow",
        dates: "2021 - Present",
        bullets: ["Delivered platform rollouts for enterprise clients."],
      },
    ],
    skills: ["ServiceNow", "ITSM"],
    coverLetter: "",
  };
}

describe("refineFeedback contact-gap detection", () => {
  it("flags a missing email and phone, leading the list", () => {
    const { proofPoints } = refineFeedback(
      docWith("Sacramento, California, United States"),
      [],
    );
    const ids = proofPoints.map((p) => p.ruleId);
    expect(ids).toContain("header_missing_email");
    expect(ids).toContain("header_missing_phone");
    expect(proofPoints[0].targetSection).toBe("header");
  });

  it("does not flag when email and phone are present", () => {
    const { proofPoints } = refineFeedback(
      docWith("612-227-1149 | you@example.com | Sacramento, CA"),
      [],
    );
    const ids = proofPoints.map((p) => p.ruleId);
    expect(ids).not.toContain("header_missing_email");
    expect(ids).not.toContain("header_missing_phone");
  });

  it("does not double-surface when the LLM already raised the email gap", () => {
    const { proofPoints } = refineFeedback(docWith("Sacramento, CA"), [
      {
        title: "Missing email",
        summary: "No email in the header.",
        why: "Recruiters cannot reply.",
        fix: "Add your email.",
        severity: "high",
      },
    ]);
    expect(proofPoints.filter((p) => p.ruleId === "header_missing_email")).toHaveLength(0);
  });
});

// Email + phone present so contact gaps don't crowd these assertions.
function docWithExperience(experience: TailoredDoc["experience"]): TailoredDoc {
  return {
    name: "Michael Balzer",
    headline: "Advisory Solutions Consultant",
    contact: "612-227-1149 | you@example.com | Sacramento, CA",
    summary: "Senior consultant with enterprise cloud-platform experience.",
    experience,
    skills: ["ServiceNow", "ITSM"],
    coverLetter: "",
  };
}

describe("refineFeedback sparse-experience detection", () => {
  it("flags a role with fewer than two real bullets", () => {
    const { proofPoints } = refineFeedback(
      docWithExperience([
        {
          role: "Consultant",
          company: "ServiceNow",
          dates: "2021 - Present",
          bullets: ["Delivered platform rollouts for enterprise clients."],
        },
      ]),
      [],
    );
    const sparse = proofPoints.filter((p) => p.ruleId === "experience_sparse_bullets");
    expect(sparse).toHaveLength(1);
    expect(sparse[0].targetSection).toBe("experience");
  });

  it("does not nag a role that already has two or more real bullets", () => {
    const { proofPoints } = refineFeedback(
      docWithExperience([
        {
          role: "Consultant",
          company: "ServiceNow",
          dates: "2021 - Present",
          bullets: [
            "Delivered platform rollouts for enterprise clients.",
            "Cut onboarding time 40% across three teams.",
          ],
        },
      ]),
      [],
    );
    expect(proofPoints.filter((p) => p.ruleId === "experience_sparse_bullets")).toHaveLength(0);
  });

  it("surfaces a single finding for multiple thin roles and counts the rest", () => {
    const { proofPoints } = refineFeedback(
      docWithExperience([
        {
          role: "Consultant",
          company: "ServiceNow",
          dates: "2021 - Present",
          bullets: ["Delivered platform rollouts for enterprise clients."],
        },
        { role: "Analyst", company: "Acme", dates: "2019 - 2021", bullets: [] },
      ]),
      [],
    );
    const sparse = proofPoints.filter((p) => p.ruleId === "experience_sparse_bullets");
    expect(sparse).toHaveLength(1);
    expect(sparse[0].summary).toMatch(/other role/i);
  });

  // The editor + audit run every finding through groundFindings (the trust
  // layer). Its template-owned suppression drops anything mentioning spacing /
  // formatting, so the sparse finding's copy must never trip those patterns or
  // it would silently vanish from the real surfaces (caught in PR #19 review).
  it("survives the groundFindings trust layer (copy avoids template-owned words)", () => {
    const { proofPoints } = refineFeedback(
      docWithExperience([
        {
          role: "Consultant",
          company: "ServiceNow",
          dates: "2021 - Present",
          bullets: ["Delivered platform rollouts for enterprise clients."],
        },
      ]),
      [],
    );
    const grounded = groundFindings(proofPoints, "", { templated: true });
    expect(grounded.some((p) => p.ruleId === "experience_sparse_bullets")).toBe(true);
  });
});
