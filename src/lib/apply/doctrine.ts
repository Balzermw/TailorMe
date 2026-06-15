// Source-grounded resume-writing doctrine.
//
// Synthesized from ~20 professional resume / job-search / tech-resume sources
// (Yate, Whitcomb, Orosz, McDowell, Burnison, Parker, Boyle, Morgan, Stroud,
// et al.) into a compact operating standard. Imported into the pipeline prompts
// so the app's analysis and suggestions reflect this methodology rather than
// generic AI advice. Keep these tight — they are injected verbatim into prompts.

/** Core doctrine. Grounds the analysis/suggestion + tailoring steps. */
export const RESUME_PRINCIPLES: string[] = [
  "A resume is a targeted, evidence-based business document that earns the next conversation — not a biography.",
  "Employer-as-buyer: weigh and frame everything by what the employer is buying for THIS role and the problems the hire must solve.",
  "Evidence beats adjectives — replace 'team player / results-oriented / strong communicator' with the outcome, scope, or proof; treat bare adjectives and buzzwords as zero evidence.",
  "Prefer accomplishments over duties: PAR/CAR (problem or challenge → action → result), quantified wherever the resume truthfully supports it.",
  "The first scan is ~6 seconds — the top third must answer target role, level, and strongest relevant proof.",
  "A summary must be supported by the body — never assert a strength the experience does not prove.",
  "Keywords: use the market's real terms, placed naturally in headline/summary/skills/recent bullets, and shown again inside experience — never keyword-stuff or claim to 'beat the ATS'.",
  "Default to reverse-chronological or hybrid; a purely functional layout reads as evasive in most hiring.",
  "Honesty is a hard boundary: reframe and select, never fabricate or inflate — every bullet must be defensible in an interview.",
  "US convention: no photo, no personal demographics, no 'references available upon request'.",
];

/** Empty self-descriptors to flag (Burnison/Boyle). Used by the proof-point hunt. */
export const CLICHES: string[] = [
  "team player",
  "self-starter",
  "results-oriented",
  "results-driven",
  "hardworking",
  "hard worker",
  "detail-oriented",
  "go-getter",
  "fast learner",
  "people person",
  "strong communicator",
  "excellent communication skills",
  "proven track record",
  "think outside the box",
  "synergy",
  "dynamic",
  "motivated",
  "passionate",
  "responsible for",
  "duties included",
];

/** Concrete, real issues a professional reviewer hunts for (doctrine QC). */
export const RESUME_RED_FLAGS: string[] = [
  "empty self-descriptors / buzzwords with no proof behind them",
  "duties stated as activity with no outcome (no PAR/CAR, no result)",
  "impact never quantified — no %, $, count, scale, or time figure",
  "a summary that claims strengths the experience never proves",
  "keywords buried in prose, or the role's real terms missing entirely",
  "letter-spaced or ALL-CAPS names/headers that break ATS parsing (e.g. 'V I N O D')",
  "overlapping, missing, or inconsistent employment dates",
  "a dense wall-of-text summary or paragraph-length bullets",
  "'references available upon request', a photo, or personal demographics on a US resume",
  "a functional layout that hides chronology and reads as evasive",
];

/** One-line doctrine digest for injecting into a prompt as a grounding clause. */
export function principlesClause(): string {
  return (
    "Apply professional resume-writing standards: " +
    RESUME_PRINCIPLES.map((p) => p.replace(/\.$/, "")).join("; ") +
    "."
  );
}
