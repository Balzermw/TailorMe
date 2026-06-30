import type { AgentReviewState, ApplyResult, EditDecision, ProofPoint, TailoredDoc } from "@/lib/types";

export const E2E_REVISION_APP_ID = "e2e-revision-fixture";
export const E2E_AGENT_REVIEW_APP_ID = "e2e-agent-review-fixture";
export const E2E_REVISION_STORAGE_KEY = "tm_e2e_revision_application_v1";
export const E2E_AGENT_REVIEW_STORAGE_KEY = "tm_e2e_agent_review_application_v2";

export interface E2ERevisionState {
  doc: TailoredDoc;
  decisions: Record<string, EditDecision>;
  agentReview?: AgentReviewState;
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
export const E2E_AGENT_ADA_KEYWORD = "Field Service";
export const E2E_AGENT_MAX_ORIGINAL =
  "Collaborate with customers to provide technical support, ensuring high levels of satisfaction and operational efficiency.";
export const E2E_AGENT_MAX_EDITED =
  "Collaborated with fab customers to provide technical support across [insert real metric], improving satisfaction and operational efficiency.";
export const E2E_AGENT_AI_REWRITE_ORIGINAL =
  "Engage with hospital staff via incoming help desk calls and emails to offer technical support and guidance.";
export const E2E_AGENT_AI_REWRITE_EDITED =
  "Provided technical support to hospital staff across phone and email channels, resolving hardware, software, network, printer, and access issues.";

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

const anieciaOriginalDoc: TailoredDoc = {
  name: "Aniecia Browning",
  headline: "Customer Engineer",
  contact: "214-555-0198 | candidate@example.com | Ovilla, TX | LinkedIn",
  summary:
    "Results-oriented customer engineer and technical support professional with experience in semiconductor equipment maintenance, healthcare IT support, application processing, project coordination, and customer-facing troubleshooting.",
  experience: [
    {
      role: "Customer Engineer (C1)",
      company: "Applied Materials",
      dates: "July 2024 - Present",
      bullets: [
        "Install, maintain, and troubleshoot semiconductor manufacturing equipment to ensure optimal performance and minimal downtime.",
        "Perform preventative and corrective maintenance, conducting root cause analysis to resolve technical issues efficiently.",
        E2E_AGENT_MAX_ORIGINAL,
        "Interpret schematics, mechanical drawings, and technical documentation to diagnose and repair complex equipment failures.",
        "Adhere to cleanroom protocols, safety standards, and compliance regulations to maintain a secure work environment.",
      ],
    },
    {
      role: "IT Help Desk Analyst",
      company: "Methodist Health Systems",
      dates: "March 2024 - Present",
      bullets: [
        E2E_AGENT_AI_REWRITE_ORIGINAL,
        "Initiate troubleshooting procedures to identify root causes and corrective actions for hardware, software, network connectivity, and printer issues.",
        "Orchestrate installation and configuration of new software and hardware, including laptops, desktop computers, and mobile devices.",
        "Set up and maintain user accounts, including email, network, and application access.",
        "Train hospital staff on new technologies and software applications to promote adoption and best practices.",
      ],
    },
    {
      role: "Application Processing Clerk / Data Entry",
      company: "First American Payment Systems",
      dates: "July 2023 - March 2024",
      bullets: [
        "Ensured accuracy, completeness, integrity, and accessibility of application and transaction data in database systems.",
        "Verified application completeness and quality to assure alignment with business rules.",
        "Interfaced with department representatives to collect missing data or address inconsistencies.",
        "Offered suggestions for improving data entry processes and streamlining workflows.",
      ],
    },
    {
      role: "Project Manager",
      company: "Hot Dog Trucking",
      dates: "February 2022 - December 2022",
      bullets: [
        "Researched business processes and marketing designs to identify opportunities to enhance performance.",
        "Delegated tasks to balance workloads, resulting in a 30% increase in team productivity.",
        "Engaged with customers and executive leaders to relay team status and progress, achieving a 99% customer satisfaction rating.",
        "Oversaw production line preparation and equipment changeovers to support efficient operations.",
      ],
    },
    {
      role: "Audio Visual Technician",
      company: "Texas A&M University - Commerce",
      dates: "July 2020 - November 2021",
      bullets: [
        "Guided installation, setup, and configuration of audio-visual equipment for 100+ events.",
        "Executed regular equipment tests, reducing equipment downtime by 30% through early detection and prompt repairs.",
        "Troubleshot and resolved 90% of field issues on the first visit, preventing downtime for clients.",
      ],
    },
  ],
  skills: [
    "Semiconductor equipment",
    "Preventative maintenance",
    "Root cause analysis",
    "Technical support",
    "Cleanroom protocols",
    "Application support",
    "Microsoft Office",
    "C++",
    "Java",
    "Business analysis",
  ],
  education: [
    {
      degree: "Master of Supply Chain Management",
      school: "East Texas A&M University - Commerce",
      dates: "2026",
    },
    {
      degree: "Bachelor of Science and Engineering in Technology Management",
      school: "East Texas A&M University - Commerce",
      dates: "2024",
    },
  ],
  projects: [],
  certifications: [],
  coverLetter:
    "Dear hiring team,\n\nI am excited to bring semiconductor equipment support, technical troubleshooting, and customer-facing service experience to your customer engineering team.",
};

export const E2E_AGENT_REVIEW_AI_DOC: TailoredDoc = {
  ...anieciaOriginalDoc,
  experience: anieciaOriginalDoc.experience.map((entry, index) =>
    index === 1
      ? {
          ...entry,
          bullets: entry.bullets.map((bullet, bulletIndex) =>
            bulletIndex === 0 ? E2E_AGENT_AI_REWRITE_EDITED : bullet,
          ),
        }
      : entry,
  ),
};

export const E2E_AGENT_REVIEW_RESULT: ApplyResult = {
  ...E2E_REVISION_RESULT,
  company: "Applied Materials",
  role: "Customer Engineer",
  fit: {
    overall: 78,
    verdict: "Solid fit",
    dimensions: [],
    locationStatus: "pass",
    locationPass: true,
    locationNote: "Candidate is local to the Dallas area.",
    summary: "Why 78 - solid fit: strong customer engineering and technical support evidence with a few ATS keyword and impact gaps.",
    keywords: [
      { term: "Field Service", inResume: false },
      { term: "Semiconductor equipment", inResume: true },
      { term: "Preventative maintenance", inResume: true },
      { term: "Root cause analysis", inResume: true },
      { term: "Cleanroom", inResume: true },
    ],
  },
  keywords: ["Semiconductor equipment", "Preventative maintenance", "Root cause analysis", "Cleanroom"],
  doc: E2E_AGENT_REVIEW_AI_DOC,
  originalDoc: E2E_AGENT_REVIEW_AI_DOC,
  bulletDiffs: [
    {
      entry: 1,
      bullet: 0,
      before: E2E_AGENT_AI_REWRITE_ORIGINAL,
      after: E2E_AGENT_AI_REWRITE_EDITED,
    },
  ],
  proofPoints: [],
  agentPasses: [
    {
      id: "ada_ats",
      persona: "Ada",
      specialty: "ATS & keywords",
      scoreLabel: "ATS Score",
      score: 72,
      title: "Ada checks parser fit first",
      summary: "One backed keyword from the posting needs a home in Skills.",
      detail: "Ada compares role keywords against the resume and turns supported gaps into Skills or Summary edits.",
      strengths: ["Clear contact block", "Semiconductor equipment and root cause analysis already present"],
      concerns: [`${E2E_AGENT_ADA_KEYWORD} is missing from Skills`],
      completedAt: new Date(0).toISOString(),
      suggestions: [
        {
          id: "agent-ada-field-service",
          agentId: "ada_ats",
          title: `Add ATS keyword: ${E2E_AGENT_ADA_KEYWORD}`,
          explanation: "The posting screens for field-service language, and the resume has customer-site equipment support to back it.",
          summary: "The posting screens for field-service language, and the resume has customer-site equipment support to back it.",
          section: "skills",
          why: "ATS systems and recruiters scan Skills for exact service and equipment-support language before reading every bullet.",
          fix: `Add ${E2E_AGENT_ADA_KEYWORD} to Skills only if this experience is accurate.`,
          suggestedRewrite: E2E_AGENT_ADA_KEYWORD,
          severity: "high",
          targetSection: "skills",
          actionType: "add_keyword",
          truthfulnessRisk: "do_not_invent",
          target: { keyword: E2E_AGENT_ADA_KEYWORD },
        },
      ],
    },
    {
      id: "remy_rolefit",
      persona: "Remy",
      specialty: "Role-fit",
      scoreLabel: "Role-Fit Score",
      score: 81,
      title: "Remy ranks what earns space",
      summary: "One AI rewrite and one older role should be checked for customer-engineering fit.",
      detail: "Remy reads bullets against the target job and protects space for the clearest equipment, troubleshooting, and customer evidence.",
      completedAt: new Date(0).toISOString(),
      suggestions: [
        {
          id: "agent-remy-low-fit",
          agentId: "remy_rolefit",
          title: "Tighten a marginal line",
          explanation: "The marketing/process line is useful but not yet pointed at customer engineering or technical service work.",
          summary: "The marketing/process line is useful but not yet pointed at customer engineering or technical service work.",
          section: "experience",
          quote: "Researched business processes and marketing designs to identify opportunities to enhance performance.",
          why: "Hiring managers need older experience to reinforce troubleshooting, equipment, customer, or operations evidence.",
          fix: "Replace low-fit process language with technical service or customer-facing evidence, or reject if the current line is more accurate.",
          severity: "medium",
          targetSection: "experience",
          actionType: "strengthen_role_fit",
          truthfulnessRisk: "none",
        },
      ],
    },
    {
      id: "max_impact",
      persona: "Max",
      specialty: "Impact & metrics",
      scoreLabel: "Impact Score",
      score: 64,
      title: "Max looks for proof, not activity",
      summary: "One current customer-support bullet needs a real scope or service metric before it reads like an outcome.",
      detail: "Max asks for scope and measurable proof while preserving truthfulness.",
      completedAt: new Date(0).toISOString(),
      suggestions: [
        {
          id: "agent-max-weekly-coverage",
          agentId: "max_impact",
          title: "Add a truthful metric",
          explanation: "This bullet states activity but not scale or impact.",
          summary: "This bullet states activity but not scale or impact.",
          section: "experience",
          quote: E2E_AGENT_MAX_ORIGINAL,
          why: "Metrics make the analyst contribution easier to compare and trust.",
          fix: "Add a real count, percentage, time saved, or volume if you can support it.",
          suggestedRewrite: E2E_AGENT_MAX_EDITED,
          severity: "high",
          targetSection: "experience",
          actionType: "add_metric",
          truthfulnessRisk: "needs_user_input",
          target: { entry: 1, bullet: 0 },
        },
      ],
    },
  ],
  edits: {
    savedAt: new Date(0).toISOString(),
    decisions: {},
    userEdited: false,
    agentReview: {
      agentSuggestions: {},
      activeAgentPass: "ada_ats",
      agentPassProgress: {
        ada_ats: { reviewed: 0, total: 1, complete: false },
        remy_rolefit: { reviewed: 0, total: 2, complete: false },
        max_impact: { reviewed: 0, total: 1, complete: false },
      },
    },
  },
};

export function defaultE2ERevisionState(
  agentReview?: AgentReviewState,
  doc: TailoredDoc = E2E_REVISION_AI_DOC,
): E2ERevisionState {
  return {
    doc: JSON.parse(JSON.stringify(doc)) as TailoredDoc,
    decisions: {},
    agentReview,
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
