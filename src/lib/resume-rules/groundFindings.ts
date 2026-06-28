// Trust layer for customer-facing suggestions. Two screens, applied at every
// surface that shows findings (the audit summary AND the editor, for both the
// base résumé and tailored drafts):
//
//   1. Template-owned / myth suppression — on our-template docs the layout,
//      formatting and ATS surface is OURS, not the candidate's. Findings about
//      spacing, alignment, columns, fonts, contact placement/labels, "ATS
//      formatting", etc. are false positives, so we drop them. This also catches
//      persistent LLM myths (e.g. "add Phone:/Email: labels").
//
//   2. Evidence grounding — a finding that quotes the résumé as proof must
//      actually match the résumé. Hallucinated quotes (and the fabricated counts
//      that ride with them) are dropped.
//
// Aggressive by design: fewer suggestions, but every one is real. This is the
// single source of truth for "is this suggestion trustworthy?" — keep it pure so
// it runs both server-side (rules pipeline) and client-side (editor/audit).

import type { ProofPoint } from "@/lib/types";

// Lowercase, drop the ellipsis the parser uses to truncate quotes, and flatten
// punctuation to spaces. MUST stay in sync with the editor's normForMatch so a
// haystack built there compares cleanly against a quote normalized here.
export function normalizeForMatch(s: string): string {
  return (s || "")
    .toLowerCase()
    .replace(/…|\.\.\./g, " ")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// Template-owned / ATS / layout / contact-placement signals + known myths. Each
// pattern is chosen to be specific enough that it won't match a real CONTENT
// finding (keywords, metrics, summaries, accomplishments).
const TEMPLATE_OWNED_PATTERNS: RegExp[] = [
  /\bspac(?:e|es|ing)\b/,
  /\bwhite[ -]?space\b/,
  // extraction artifacts: words run together from a multi-column/PDF paste
  /\bconcatenat/,
  /\b(?:without|missing|no) spaces?\b/,
  /\brun together\b/,
  /\bindent(?:ed|ing|ation)?\b/,
  /\b(?:left|right|center)[ -]?align/,
  /\balignment\b/,
  /\bfont\b/,
  /\btypeface\b/,
  /\bmargins?\b/,
  /\b(?:single|multi|two|one)[ -]?column\b/,
  /\bcolumns?\b/,
  /\bcasing\b/,
  /\bcapitali[sz]/,
  /\bmachine[ -]?read/,
  /\bats[ -]?(?:friendly|compatib|optimi|pars|read|safe|format)/,
  /\bapplicant[ -]?tracking\b/,
  /\bbullet (?:symbol|character|point style|styling|formatting)\b/,
  // "inconsistent formatting / spacing / capitalization / style …"
  /\binconsisten\w*\s+(?:format|spac|capitali|font|style|punctuat|align)/,
  // contact placement / consolidation myths — our template owns the header
  /\bcontact\b[^.]{0,70}\b(?:scatter|consolidat|inconsistent|single (?:line|header)|one (?:line|header)|placement|structured header|header line|reformat|separate)\b/,
  /\b(?:scatter|consolidat)\w*[^.]{0,40}\bcontact\b/,
  // "add Phone:/Email:/LinkedIn: labels" myth
  /\blabels?\b[^.]{0,40}\b(?:contact|phone|email|linkedin)\b/,
  /\b(?:phone|email)\s*:/,
];

export function isTemplateOwnedFinding(p: ProofPoint): boolean {
  const blob = `${p.title} ${p.summary} ${p.fix ?? ""}`.toLowerCase();
  return TEMPLATE_OWNED_PATTERNS.some((re) => re.test(blob));
}

// Is the finding's quoted evidence actually present in the résumé? A short/empty
// quote has nothing to verify (additive findings like "add a summary"); a
// substantive quote must appear (allowing for light edits via word overlap).
export function evidenceGrounded(normalizedHaystack: string, quote: string | undefined): boolean {
  const q = normalizeForMatch(quote ?? "");
  if (q.length < 12) return true;
  if (!normalizedHaystack) return true; // nothing to check against — don't drop
  if (normalizedHaystack.includes(q)) return true;
  // Drop a leading section-header word ("Skills …") that may not be in the body.
  const sp = q.indexOf(" ");
  if (sp > 0 && normalizedHaystack.includes(q.slice(sp + 1))) return true;
  const words = q.split(" ").filter((w) => w.length > 3);
  if (!words.length) return true;
  const hits = words.filter((w) => normalizedHaystack.includes(w)).length;
  return hits / words.length >= 0.6;
}

/**
 * Keep only trustworthy findings: drop template-owned/myth findings (when
 * `templated`, the default) and findings whose evidence quote can't be verified
 * against `normalizedHaystack` (already run through normalizeForMatch).
 */
export function groundFindings<T extends ProofPoint>(
  points: T[],
  normalizedHaystack: string,
  opts?: { templated?: boolean },
): T[] {
  const templated = opts?.templated ?? true;
  return points.filter((p) => {
    if (templated && isTemplateOwnedFinding(p)) return false;
    if (!evidenceGrounded(normalizedHaystack, p.quote)) return false;
    return true;
  });
}
