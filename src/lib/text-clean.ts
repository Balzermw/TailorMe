// Small, pure text cleaners shared by client + server (no server-only imports).

/**
 * Strip the "{Company} logo" / "Company logo for, {Company}" boilerplate that
 * LinkedIn job pastes put on their first line, so it never leaks into a parsed
 * role or company label (e.g. "Company logo for, Deloitte." -> "Deloitte").
 * Leaves text without "logo" untouched.
 */
export function stripLogoArtifact(s: string): string {
  if (!s) return "";
  const cleaned = s
    .replace(/\bcompany logo for\b[,:]?/gi, "")
    .replace(/\blogo\b/gi, "")
    .replace(/\s{2,}/g, " ")
    .replace(/^[\s,.:;|–—-]+|[\s,.:;|–—-]+$/g, "")
    .trim();
  return cleaned;
}
