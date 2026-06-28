import type { Metadata } from "next";
import LegalDoc, { type LegalDocData } from "@/components/legal/legal-doc";

export const metadata: Metadata = {
  title: "Terms of service · TailorMe by Res.Me",
};

const TM_TERMS: LegalDocData = {
  title: "Terms of service",
  updated:
    "Last updated June 14, 2026",
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
      "Unused credits are refundable in full within 30 days of purchase. Credits already spent on an application and completed human reviews are non-refundable. To request a refund, email balzermw@gmail.com.",
    ],
    [
      "No employment guarantees",
      "TailorMe improves how your experience is presented. We do not and cannot guarantee interviews, job offers, response rates, or salary outcomes, and we make no claims of bypassing applicant tracking systems.",
    ],
    [
      "Acceptable use",
      "Use TailorMe only with your own resume and truthful information. The service must not be used to fabricate experience, credentials, or identities.",
    ],
    [
      "Human review",
      "Expert feedback is a human review pass for one completed application. Human revision and coaching packages are separate hands-on services. Completed human services are non-refundable once delivered.",
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
