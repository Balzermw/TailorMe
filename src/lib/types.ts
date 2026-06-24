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
  matched: string[]; // supporting evidence (quote the resume)
  gaps: string[]; // what's missing / unwritten
  why?: string; // deep-dive: why this score, grounded in the resume vs posting
}

/**
 * A drillable finding shown across the audit. The headline + summary are the
 * at-a-glance "general info"; `quote` is verbatim text from the candidate's own
 * resume (the proof it is real, not generic AI output); `why`/`fix` are the
 * optional deep-dive the user opens when they want the reasoning.
 */
export interface ProofPoint {
  title: string; // short headline
  summary: string; // one-line general info
  quote?: string; // EXACT text pulled from the resume — the proof
  why: string; // deep-dive: why it matters (how ATS / recruiters read it)
  fix: string; // deep-dive: how tailoring fixes it
  severity: "high" | "medium" | "low";
  // Rule provenance (present only for rules-engine findings, not legacy LLM
  // points). Safe telemetry primitives — ids/categories only, never content.
  ruleId?: string;
  category?: string;
}

export interface FitBreakdown {
  overall: number; // 0–100
  verdict: string; // "Strong fit" etc.
  dimensions: FitDimension[];
  // Tri-state: "pass" met, "fail" real conflict, "unclear" not specified by the
  // posting/resume. locationPass is the legacy boolean (= status === "pass").
  locationStatus?: "pass" | "fail" | "unclear";
  locationPass: boolean;
  locationNote: string;
  summary: string; // "Why 84 — strong fit: …"
  keywords?: { term: string; inResume: boolean }[]; // posting keywords + resume hit/miss
  recommendReview?: boolean; // weak/unclear fit → nudge a manual expert review
}

/**
 * Lightweight, candidate-independent context about a target role, gathered by a
 * fast background call so the parsing/loading screen reflects the user's actual
 * target (never a default placeholder) and the fit analysis is grounded.
 */
export interface RoleContext {
  role: string; // normalized title, e.g. "Senior Product Manager"
  company?: string; // present only if a full posting was pasted
  seniority: string; // e.g. "Senior / 8+ years"
  responsibilities: string[]; // what this kind of role typically owns
  typicalSkills: string[]; // hard skills/tools the role usually needs
  keywords: string[]; // the terms ATS/recruiters screen for
  commonGaps: string[]; // weaknesses often seen in resumes for this role
}

export interface AgentNote {
  agent: string; // "ATS & keywords" | "Impact & metrics" | "Role-fit"
  kind: "fix" | "polish";
  text: string;
}

export interface TailoredBullet {
  before: string;
  // Plain text. Rendered as escaped React text children (never raw HTML) — any
  // keyword/metric highlighting is applied client-side, so never wire this to
  // dangerouslySetInnerHTML (the value is model output and is not sanitized).
  after: string;
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
  // Optional categorized view of `skills` (e.g. "Cloud & DevOps: AWS, Azure").
  // When present it drives rendering; `skills` stays in sync (= flattened groups)
  // so ATS/serialize/score paths that read the flat list keep working.
  skillGroups?: { label: string; skills: string[] }[];
  education?: { school: string; degree: string; dates: string }[];
  projects?: { name: string; description: string }[];
  certifications?: { name: string; issuer: string; date: string }[];
  coverLetter: string; // plain paragraphs joined by \n\n
  template?: string; // résumé style id (see lib/apply/templates.ts); default moderncv-banking
}

export interface ResumeStats {
  name: string;
  roles: number;
  bullets: number;
  metricBullets: number;
  skills: string[];
  // Richer fields from the AI parse (optional; heuristic fallback omits them).
  primaryRole?: string; // most-recent / primary title
  yearsExperience?: number; // total professional years (estimate)
  sampleBullets?: { text: string; hasMetric: boolean }[]; // a few to animate in
  weaknesses?: string[]; // evidence-based "your resume undersells you" points (legacy)
  proofPoints?: ProofPoint[]; // real, quotable weaknesses with deep-dive why/fix
}

/**
 * One step-3 review specialist, matching the design's data contract. Exactly
 * three are produced in fixed order (ats → impact → rolefit); each id maps to a
 * fixed persona/accent. The behaviors are real /apply-engine work — keyword
 * coverage, impact rewriting, relevance-weighted line cutting — split into
 * personas for the product. `detail` is the deep-dive ("how Ada read it").
 */
export interface AuditAgent {
  id: "ats" | "impact" | "rolefit";
  persona: string; // "Ada"
  archetype: string; // "The Parser"
  specialty: string; // "ATS & keywords"
  accent: "blue" | "mint" | "navy";
  reads: string; // left-panel one-liner
  kind: "coverage" | "impact" | "ranking"; // selects evidence layout
  title: string;
  subtitle: string;
  footer: string;
  detail: string; // deep-dive: how this agent reached its conclusion
  chip?: string; // ranking only ("Hard limit · 2 pages")
  // kind: "coverage"
  matched?: number;
  total?: number;
  keywords?: { name: string; matched: boolean; count: string }[];
  // kind: "impact"
  before?: string;
  after?: string;
  stats?: { value: string; label: string; accent: "blue" | "mint" }[];
  quantified?: { count: number; total: number }; // experience lines carrying a hard number, of total
  // kind: "ranking"
  lines?: {
    rank: number;
    label: string;
    score: number; // 0–100 relevance to the posting
    status: "kept-top" | "kept" | "trimmed" | "cut";
  }[];
}

/**
 * One faithfulness correction the verification pass made to the tailored doc.
 * Surfaced as a trust signal: the app shows it checked every line against the
 * source resume and what (if anything) it pulled back. `kind` names the failure
 * mode the offline A/B eval found most common across both prompt arms.
 */
export interface VerificationCorrection {
  kind:
    | "fabricated" // a number/tool/scope claim with no support anywhere in the resume
    | "misattributed" // a real metric/result attached to the wrong achievement
    | "skill-conflation" // a skills-list item asserted onto a specific role it never names
    | "inflated-scope"; // scope/level upgraded beyond what the resume states ("assisted"→"led")
  claim: string; // the unsupported claim that was removed or softened
  note: string; // one-line reason, grounded in the source resume
}

export interface VerificationReport {
  // "clean" = the pass ran and every checked line traced back to the source;
  // "corrected" = it ran and pulled back the listed claims; "unavailable" = it
  // did NOT complete (provider error, or the repair was structurally rejected),
  // so no faithfulness guarantee can be made. The UI must only show the
  // reassuring "verified" copy for "clean"/"corrected" — never "unavailable".
  status: "clean" | "corrected" | "unavailable";
  checked: number; // experience bullets + summary lines verified against the source
  corrections: VerificationCorrection[];
}

/**
 * One per-bullet before→after pair, captured IN-PIPELINE at tailor time (the
 * only place both the original line and the rewritten doc bullet are in scope —
 * the showcase `bullets[].after` strings are not verbatim substrings of the
 * doc). Anchored to {entry,bullet} coordinates into doc.experience, taken after
 * verifyDoc's same-shape guard so the coordinates are stable for the stored row.
 */
export interface TailorDiagnostics {
  qualityGate: "passed" | "failed";
  attempts: number;
  repairPasses: number;
  rawRewritePairs: number;
  changedRewritePairs: number;
  noOpRewritePairs: number;
  documentRepairPasses: number;
  postVerifyRewritePairs: number;
  verifyCorrections: number;
  walkedBackPairs: number;
  finalDocBulletCount: number;
  matchedBulletDiffs: number;
  unmatchedRewritePairs: number;
  bestMatchScores: number[];
  finalDifferentFromSource: boolean;
  failureReason?: string;
}

export interface BulletDiff {
  entry: number;
  bullet: number;
  before: string;
  after: string;
}

export type EditDecision = "accepted" | "rejected" | "edited";

export interface EditState {
  savedAt: string;
  // key = `${entry}:${bullet}` for bullets, or "summary" | `skill:${i}` |
  // `cover:${i}` | `header:${field}` for the other editable fields.
  decisions: Record<string, EditDecision>;
  userEdited: boolean; // any hand-edit → downgrades the "verified" trust badge
}

export interface ApplyResult {
  company: string;
  role: string;
  fit: FitBreakdown;
  bullets: TailoredBullet[];
  keywords: string[];
  agentNotes: AgentNote[];
  agents?: AuditAgent[]; // the three personified review cards (full run only)
  doc: TailoredDoc | null; // null for score-only (free preview); current/edited doc
  verification?: VerificationReport; // faithfulness pass over the tailored doc (full run only)
  tailorDiagnostics?: TailorDiagnostics; // privacy-safe quality gate metrics for paid tailoring
  // ----- editor (added when a user edits a tailored application) -----
  originalDoc?: TailoredDoc; // AI draft snapshot; never overwritten ("reset to AI version")
  bulletDiffs?: BulletDiff[]; // per-bullet before/after for the editor's diff rows
  edits?: EditState; // per-line accept/reject/edit decisions + save metadata
  proofPoints?: ProofPoint[]; // resume-audit findings ("what tailoring will fix"), carried into the editor
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
  resumeId: string | null; // base resume this version was tailored from
}
