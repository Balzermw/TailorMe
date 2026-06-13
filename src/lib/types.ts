// Shared domain types for the TailorMe data model and apply pipeline.

export type ApplicationStatus =
  | "scored" // fit scored, not yet tailored (no credit spent)
  | "running" // pipeline in progress
  | "ready" // tailored + reviewed, files available
  | "human_review"; // Michael pass requested/in progress

export type MichaelStatus = "none" | "requested" | "in_review" | "returned";

export interface FitDimension {
  label: string;
  score: number; // 0–100
  matched: string[]; // supporting evidence
  gaps: string[]; // what's missing / unwritten
}

export interface FitBreakdown {
  overall: number; // 0–100
  verdict: string; // "Strong fit" etc.
  dimensions: FitDimension[];
  locationPass: boolean;
  locationNote: string;
  summary: string; // "Why 84 — strong fit: …"
}

export interface AgentNote {
  agent: string; // "ATS & keywords" | "Impact & metrics" | "Role-fit"
  kind: "fix" | "polish";
  text: string;
}

export interface TailoredBullet {
  before: string;
  after: string; // may contain <mark class="tm-k|tm-m"> highlights
}

export interface TailoredDoc {
  name: string; // "Alex Mercer"
  headline: string; // "Senior Platform Engineer"
  contact: string;
  summary: string;
  experience: {
    role: string;
    company: string;
    dates: string;
    bullets: string[];
  }[];
  skills: string[];
  coverLetter: string; // plain paragraphs joined by \n\n
}

export interface ApplyResult {
  company: string;
  role: string;
  fit: FitBreakdown;
  bullets: TailoredBullet[];
  keywords: string[];
  agentNotes: AgentNote[];
  doc: TailoredDoc | null; // null for score-only (free preview)
}

export interface Profile {
  id: string;
  email: string;
  fullName: string | null;
  credits: number;
}

export interface ApplicationRow {
  id: string;
  company: string;
  role: string;
  fitScore: number | null;
  status: ApplicationStatus;
  michaelStatus: MichaelStatus;
  createdAt: string;
  result: ApplyResult | null;
}
