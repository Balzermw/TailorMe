import type { ApplyResult, EditDecision, ProofPoint, TailoredDoc } from "@/lib/types";

export const E2E_REVISION_APP_ID = "e2e-revision-fixture";
export const E2E_REVISION_STORAGE_KEY = "tm_e2e_revision_application_v1";

export interface E2ERevisionState {
  doc: TailoredDoc;
  decisions: Record<string, EditDecision>;
  userEdited: boolean;
}

export const E2E_REVISION_QUOTED_TEXT =
  "maintained an outdated escalation tracker for monthly leadership updates";
export const E2E_REVISION_ACCEPTED_TEXT =
  "Built Tableau reporting for 6 support managers, cutting weekly status prep by 40%.";
export const E2E_REVISION_REJECTED_SOURCE_TEXT =
  "Helped with customer escalations.";
export const E2E_REVISION_BAD_AI_TEXT =
  "Owned executive escalations for 48 enterprise accounts and saved $2.1M.";
export const E2E_REVISION_CUSTOM_TEXT =
  "Rebuilt escalation reporting with SQL and Tableau so support leads could spot SLA risks weekly.";

const originalResumeDoc: TailoredDoc = {
  name: "Avery Stone",
  headline: "Operations Analyst",
  contact: "555-010-2200 | avery.synthetic@example.com | Raleigh, NC",
  summary:
    "Operations analyst focused on reporting, escalation hygiene, and practical workflow improvements for customer teams.",
  experience: [
    {
      role: "Operations Analyst",
      company: "Northwind Support",
      dates: "Jan 2021 - Present",
      bullets: [
        "Managed reports for support team.",
        E2E_REVISION_REJECTED_SOURCE_TEXT,
        "Updated escalation tracker for leadership updates.",
      ],
    },
    {
      role: "Support Coordinator",
      company: "Harbor Desk",
      dates: "Feb 2019 - Dec 2020",
      bullets: ["Coordinated weekly coverage notes for team leads."],
    },
  ],
  skills: ["Tableau", "SQL", "Zendesk", "SLA reporting"],
  education: [{ degree: "BS Business Analytics", school: "State University", dates: "2018" }],
  projects: [],
  certifications: [],
  coverLetter: "Dear hiring team,\n\nI am excited to bring operations reporting experience to your team.",
};

export const E2E_REVISION_AI_DOC: TailoredDoc = {
  ...originalResumeDoc,
  experience: [
    {
      ...originalResumeDoc.experience[0],
      bullets: [
        E2E_REVISION_ACCEPTED_TEXT,
        E2E_REVISION_BAD_AI_TEXT,
        "Maintained an outdated escalation tracker for monthly leadership updates.",
      ],
    },
    originalResumeDoc.experience[1],
  ],
};

export const E2E_REVISION_PROOF_POINTS: ProofPoint[] = [
  {
    title: "Rewrite the stale tracker line",
    summary: "This bullet still reads like maintenance instead of measurable ownership.",
    quote: E2E_REVISION_QUOTED_TEXT,
    why: "Recruiters scan bullets for ownership, tools, and outcomes.",
    fix: "Replace the tracker wording with a concrete reporting outcome.",
    severity: "high",
    ruleId: "e2e_quote_resolves",
    category: "impact",
  },
  {
    title: "Add a project section",
    summary: "A small reporting project would make the operations toolkit easier to scan.",
    why: "Project sections can surface relevant tools when role bullets are dense.",
    fix: "Add one concise project with the tool, audience, and measurable result.",
    severity: "medium",
    ruleId: "e2e_missing_project_persists",
    category: "structure",
  },
];

export const E2E_REVISION_RESULT: ApplyResult = {
  company: "Acme Systems",
  role: "Customer Operations Analyst",
  fit: {
    overall: 84,
    verdict: "Strong fit",
    dimensions: [],
    locationStatus: "pass",
    locationPass: true,
    locationNote: "Remote role.",
    summary: "Why 84 - strong fit: deterministic revision fixture.",
  },
  bullets: [],
  keywords: ["Tableau", "SQL", "SLA"],
  agentNotes: [],
  doc: E2E_REVISION_AI_DOC,
  originalDoc: E2E_REVISION_AI_DOC,
  bulletDiffs: [
    {
      entry: 0,
      bullet: 0,
      before: originalResumeDoc.experience[0].bullets[0],
      after: E2E_REVISION_ACCEPTED_TEXT,
    },
    {
      entry: 0,
      bullet: 1,
      before: E2E_REVISION_REJECTED_SOURCE_TEXT,
      after: E2E_REVISION_BAD_AI_TEXT,
    },
    {
      entry: 0,
      bullet: 2,
      before: originalResumeDoc.experience[0].bullets[2],
      after: E2E_REVISION_AI_DOC.experience[0].bullets[2],
    },
  ],
  edits: {
    savedAt: new Date(0).toISOString(),
    decisions: {},
    userEdited: false,
  },
  proofPoints: E2E_REVISION_PROOF_POINTS,
};

export function defaultE2ERevisionState(): E2ERevisionState {
  return {
    doc: JSON.parse(JSON.stringify(E2E_REVISION_AI_DOC)) as TailoredDoc,
    decisions: {},
    userEdited: false,
  };
}

export function e2eRevisionFeedback(doc: TailoredDoc): ProofPoint[] {
  const plain = [
    doc.summary,
    ...doc.experience.flatMap((entry) => entry.bullets),
    ...(doc.projects ?? []).flatMap((project) => [project.name, project.description]),
  ]
    .join(" ")
    .toLowerCase();
  return E2E_REVISION_PROOF_POINTS.filter((point) => {
    if (!point.quote) return !(doc.projects ?? []).some((project) => project.name || project.description);
    return plain.includes(point.quote.toLowerCase());
  });
}
