// Detecting unfilled template placeholder names ("CANDIDATE NAME", "Your Name",
// "First Last", "[Name]"). Pure and dependency-free so BOTH the server parser
// and the client audit/editor UI can share it — parse.ts is `server-only`, so
// this can't live there without breaking the client bundle.

// Curated set of exact fill-in phrases. We only flag unambiguous placeholder
// text, never a plausibly real name, so the hint can never scold a real person.
const PLACEHOLDER_NAMES = new Set([
  "candidate name", "your name", "your full name", "full name", "name here",
  "name surname", "first last", "last first", "first name last name",
  "firstname lastname", "lastname firstname", "first middle last",
  "applicant name", "student name", "employee name", "first and last name",
  "lorem ipsum", "name",
]);

/**
 * True when the extracted name is an unfilled template placeholder rather than a
 * real name. Conservative by design: it matches the curated set plus the clear
 * "<role/your/full> name" and "<first/last> ... name" fill-in patterns, so a
 * real name (which never carries the literal word "name") is never flagged.
 */
export function isPlaceholderName(raw: string): boolean {
  const name = (raw || "")
    .toLowerCase()
    .replace(/[[\](){}<>]/g, " ") // bracket chars templates wrap placeholders in
    .replace(/[^a-z\s]/g, " ") // drop punctuation, digits, accents
    .replace(/\s+/g, " ")
    .trim();
  if (!name) return false;
  if (PLACEHOLDER_NAMES.has(name)) return true;
  // Any phrase pairing a generic fill-in word with the literal token "name".
  return /\b(?:candidate|applicant|employee|student|your|full|first|last|given|family)\b.*\bname\b/.test(
    name,
  );
}
