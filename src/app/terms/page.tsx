import type { Metadata } from "next";
import LegalDoc, { type LegalDocData } from "@/components/legal/legal-doc";

export const metadata: Metadata = {
  title: "Terms of service — TailorMe by Res.Me",
};

const TM_TERMS: LegalDocData = {
  title: "Terms of service",
  updated:
    "Last updated June 2026 · placeholder draft — requires legal review before publishing",
  sections: [
    [
      "The service",
      "TailorMe by Res.Me tailors your resume and cover letter to specific job postings, reviews them with specialist AI agents, and offers optional human expert review. You keep full ownership of your documents.",
    ],
    [
      "Credits",
      "One credit runs one application against one job posting, including re-runs against that same posting. Credits are purchased in packs, never expire, and are tied to your account. There is no subscription.",
    ],
    [
      "Refunds",
      "Unused credits are refundable in full within 30 days of purchase. Used credits and completed human reviews are non-refundable. [Placeholder — confirm final policy.]",
    ],
    [
      "No employment guarantees",
      "TailorMe improves how your experience is presented. We do not and cannot guarantee interviews, job offers, response rates, or salary outcomes — and we make no claims of bypassing applicant tracking systems.",
    ],
    [
      "Acceptable use",
      "Use TailorMe only with your own resume and truthful information. The service must not be used to fabricate experience, credentials, or identities.",
    ],
    [
      "Human review",
      "The optional expert review is performed by a Res.Me professional within the stated turnaround (typically 48 hours) and consists of editorial feedback on your documents.",
    ],
    [
      "Changes",
      "We may update these terms; material changes will be announced by email at least 14 days in advance.",
    ],
  ],
};

export default function TermsPage() {
  return <LegalDoc doc={TM_TERMS} />;
}
