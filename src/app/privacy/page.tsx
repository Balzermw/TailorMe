import type { Metadata } from "next";
import LegalDoc, { type LegalDocData } from "@/components/legal/legal-doc";

export const metadata: Metadata = {
  title: "Privacy policy — TailorMe by Res.Me",
};

const TM_PRIVACY: LegalDocData = {
  title: "Privacy policy",
  updated:
    "Last updated June 14, 2026",
  sections: [
    [
      "What we collect",
      "Your account email, the resume you upload, job postings you paste, and the documents the pipeline produces for you. Payment details go directly to Stripe — we never see your card number.",
    ],
    [
      "How your resume data is used",
      "Only to run your applications: parsing your profile, tailoring documents, and generating reviewer feedback. Your resume data is never used to train AI models and never shared with employers or third parties.",
    ],
    [
      "Encryption & storage",
      "Resume data is encrypted at rest. Documents are stored so you can re-download past applications; you can delete any application — or everything — at any time.",
    ],
    [
      "One-click deletion",
      "Account settings include a single control that permanently deletes your profile, uploaded resumes, generated documents, and feedback history. Deletion is immediate and irreversible.",
    ],
    [
      "GDPR",
      "We are GDPR-aligned by design: you can export your data, correct it, or erase it. For data requests, contact us — we respond within 30 days.",
    ],
    [
      "Cookies & analytics",
      "We use essential cookies for sign-in sessions and minimal, privacy-respecting analytics to understand product usage. No advertising trackers.",
    ],
  ],
};

export default function PrivacyPage() {
  return <LegalDoc doc={TM_PRIVACY} />;
}
