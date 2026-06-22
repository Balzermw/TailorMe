// Deterministic, persistence-safe ids for findings/UI items. The Grok reference
// used Python's runtime hash() — unstable across processes — so we use FNV-1a
// over explicit, stable inputs instead (rule + canonical issue + evidence +
// section/line). Same inputs → same id, always.

export function fnv1a(input: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  // Unsigned hex, zero-padded for a stable width.
  return (h >>> 0).toString(16).padStart(8, "0");
}

/** Stable finding id from the inputs that define "the same issue here". */
export function makeFindingId(parts: {
  ruleId: string;
  canonicalIssueId: string;
  evidence?: string;
  section?: string;
  lineRef?: string;
}): string {
  const key = [
    parts.ruleId,
    parts.canonicalIssueId,
    parts.section ?? "",
    parts.lineRef ?? "",
    parts.evidence ?? "",
  ].join("");
  return `${parts.ruleId}_${fnv1a(key)}`;
}

/** Stable fingerprint for dedupe: issue + section, evidence-insensitive by default. */
export function makeDedupeFingerprint(parts: {
  canonicalIssueId: string;
  section?: string;
}): string {
  return fnv1a([parts.canonicalIssueId, parts.section ?? ""].join(""));
}
