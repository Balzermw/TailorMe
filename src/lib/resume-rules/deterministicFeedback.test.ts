import { describe, expect, it } from "vitest";
import { refineFeedback } from "./deterministicFeedback";
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
