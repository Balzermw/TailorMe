import type { TailoredDoc } from "@/lib/types";

// Sample resume text for the "Try with the sample resume" path — the flagship
// composite persona (Alex M.), so the audit works for real with the Anthropic
// pipeline even before a user uploads anything. Labeled composite, not a real client.
export const SAMPLE_RESUME = `Alex Mercer
Senior Software Engineer · Copenhagen · alex.m@email.com

EXPERIENCE
Senior Software Engineer — Brightline Commerce (2019 – present)
- Responsible for developing and maintaining features for the web app using React and Node.js.
- Led migration of the checkout system to a distributed Node.js service across 2.4M daily transactions.
- Participated in code reviews and mentoring of junior engineers.
- Owned Kubernetes deployment standards for the platform team.
- Built order-events processing with Datadog dashboards for observability.

Software Engineer — Versa Labs (2014 – 2019)
- Built and maintained PHP and Node.js services for the order pipeline.
- Handled 40k messages/min in the events pipeline.

SKILLS
React, Node.js, Kubernetes, PostgreSQL, Distributed systems, Observability, Mentoring, TypeScript, AWS, CI/CD, Docker

EDUCATION
BSc Computer Science`;

// A fully tailored sample document (Alex M. → Nordpeak) — labeled composite,
// not a real client. Powers /applications/sample/print so the moderncv render
// is previewable in demo mode without a persisted application.
export const SAMPLE_DOC: TailoredDoc = {
  name: "Alex Mercer",
  headline: "Senior Platform Engineer",
  contact: "Copenhagen · alex.m@email.com · +45 00 00 00 00",
  summary:
    "Senior engineer with 7 years building distributed backend systems at scale. Owns platform reliability end to end — from Node.js services and Kubernetes standards to observability — and grows the teams around them.",
  experience: [
    {
      role: "Senior Software Engineer",
      company: "Brightline Commerce",
      dates: "2019 – present",
      bullets: [
        "Led migration of checkout to a distributed Node.js service, cutting p95 latency 38% across 2.4M daily transactions.",
        "Owned Kubernetes deployment standards for the platform team and rolled them out across 12 services.",
        "Built order-events processing with Datadog dashboards, taking observability coverage from 0 to full request tracing.",
        "Mentored 6 engineers through promotion cycles while running the team's code-review practice.",
      ],
    },
    {
      role: "Software Engineer",
      company: "Versa Labs",
      dates: "2014 – 2019",
      bullets: [
        "Built the order-events pipeline handling 40k messages/min with at-least-once delivery.",
        "Migrated legacy PHP services to Node.js, halving median response time.",
      ],
    },
  ],
  skills: [
    "Distributed systems",
    "Node.js at scale",
    "Kubernetes",
    "Observability (Datadog)",
    "PostgreSQL",
    "Mentorship",
  ],
  coverLetter:
    "Dear Nordpeak team,\n\nYour posting asks for someone who has run distributed Node.js services in production — that has been my work for the past five years, most recently leading the checkout migration at Brightline that cut p95 latency 38% across 2.4M daily transactions.\n\nWhat draws me to Nordpeak is the mandate to own platform evolution. I've set Kubernetes deployment standards, built observability from the ground up, and grown the engineers around me — exactly the scope your role describes.\n\nI'd welcome the chance to bring that platform experience to your team.\n\nSincerely,\nAlex Mercer",
};
