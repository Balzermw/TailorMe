// Token-abuse guardrails: input-size caps + rate-limit rules, all env-tunable.
// Bounds per-call token cost (size caps) and request frequency (rate rules) on
// the free, unauthenticated paths — the only ones not already gated by credits.

import type { Rule } from "@/lib/rate-limit";

function num(name: string, def: number): number {
  const v = Number(process.env[name]);
  return Number.isFinite(v) && v > 0 ? v : def;
}

// ---- input size caps (bound tokens per call) ----
// Your real resumes measure ~7–8k chars; 24k is generous but stops a malicious
// 500k paste. A posting is the role text, not the whole careers page.
export const MAX_POSTING_CHARS = num("MAX_POSTING_CHARS", 8_000);
export const MAX_RESUME_CHARS = num("MAX_RESUME_CHARS", 24_000);

// ---- rate limits ----
export const rateLimitDisabled = process.env.RATE_LIMIT_DISABLED === "1";

const HOUR = 3_600_000;
const DAY = 86_400_000;

// Free fit-score audits (unauthenticated). Generous enough to try a few
// postings, tight enough that a script can't run up the bill.
export const FREE_AUDIT_RULES: Rule[] = [
  { limit: num("FREE_AUDIT_PER_HOUR", 3), windowMs: HOUR },
  { limit: num("FREE_AUDIT_PER_DAY", 8), windowMs: DAY },
];

// Global circuit breaker on free audits across all IPs (caps total free spend).
export const FREE_AUDIT_GLOBAL_RULES: Rule[] = [
  { limit: num("FREE_AUDIT_GLOBAL_PER_DAY", 2_000), windowMs: DAY },
];

// Resume parsing (local work, no tokens — but still rate-limited to stop CPU abuse).
export const PARSE_RULES: Rule[] = [
  { limit: num("PARSE_PER_HOUR", 8), windowMs: HOUR },
  { limit: num("PARSE_PER_DAY", 20), windowMs: DAY },
];

// Full tailored runs per signed-in account per day. Credits already bound total
// spend; this catches a scripted or compromised credit-loaded account.
export const FULL_RUN_RULES: Rule[] = [
  { limit: num("FULL_RUNS_PER_DAY", 60), windowMs: DAY },
];

// Stripe checkout sessions per account (anti-spam).
export const CHECKOUT_RULES: Rule[] = [
  { limit: num("CHECKOUT_PER_HOUR", 20), windowMs: HOUR },
];

/** Returns an error message if the apply inputs exceed the size caps, else null. */
export function validateApplyInput(
  resumeText: string,
  postingText: string,
): string | null {
  if (postingText.length > MAX_POSTING_CHARS) {
    return `That job posting is too long (max ${MAX_POSTING_CHARS.toLocaleString()} characters). Paste the role description, not the entire careers page.`;
  }
  if (resumeText.length > MAX_RESUME_CHARS) {
    return `That resume is too long (max ${MAX_RESUME_CHARS.toLocaleString()} characters).`;
  }
  return null;
}
