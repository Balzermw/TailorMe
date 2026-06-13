import "server-only";
import type { ResumeStats } from "@/lib/types";

// Resume file parsing: extract plain text from PDF / Word / text uploads, plus
// lightweight heuristics for the "what we extracted" preview. Pure local work —
// no API key needed, so it runs in demo mode too.

const KNOWN_SKILLS = [
  "React", "Node.js", "TypeScript", "JavaScript", "Python", "Go", "Rust",
  "Java", "Kotlin", "Swift", "Kubernetes", "Docker", "AWS", "GCP", "Azure",
  "PostgreSQL", "MySQL", "Redis", "MongoDB", "GraphQL", "REST", "Kafka",
  "Terraform", "CI/CD", "Observability", "Datadog", "Distributed systems",
  "Microservices", "Next.js", "Vue", "Tailwind", "PHP", "Ruby", "Rails",
  "Django", "Spring", "Mentoring", "Leadership", "Agile", "Scrum",
];

const BULLET_RE = /^\s*[-•*●·]\s+/;
const YEAR_RANGE_RE = /\b(19|20)\d{2}\b.*?(present|current|(19|20)\d{2})/i;
// A quantified metric: a percentage, currency, a number with a k/m/b/x suffix,
// a decimal, or any 2+ digit run (38%, $1, 2.4M, 40k, p95).
const METRIC_RE = /\d+\s?%|\$\s?\d|\d+(\.\d+)?\s?[kmbx]\b|\d+\.\d+|\d{2,}/i;

/** Extract plain text from an uploaded resume by file type. */
export async function extractText(
  filename: string,
  bytes: ArrayBuffer,
): Promise<string> {
  const lower = filename.toLowerCase();
  if (lower.endsWith(".pdf")) {
    const { extractText: pdfText, getDocumentProxy } = await import("unpdf");
    const pdf = await getDocumentProxy(new Uint8Array(bytes));
    const { text } = await pdfText(pdf, { mergePages: true });
    return text;
  }
  if (lower.endsWith(".docx") || lower.endsWith(".doc")) {
    const mammoth = (await import("mammoth")).default;
    const { value } = await mammoth.extractRawText({
      buffer: Buffer.from(bytes),
    });
    return value;
  }
  // .txt / .md / unknown → decode as UTF-8
  return new TextDecoder().decode(bytes);
}

/** Heuristic stats from resume text — real, derived from the actual content. */
export function analyze(text: string): ResumeStats {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  // Name: first short line that looks like a person's name (no digits, ≤4 words).
  const name =
    lines.find(
      (l) => !/\d/.test(l) && l.split(/\s+/).length <= 4 && /^[A-Za-z]/.test(l),
    ) ?? "Your resume";

  const bulletLines = lines.filter((l) => BULLET_RE.test(l));
  const bullets = bulletLines.length || lines.filter((l) => l.length > 40).length;
  const metricBullets = (bulletLines.length ? bulletLines : lines).filter((l) =>
    METRIC_RE.test(l),
  ).length;
  const roles = lines.filter((l) => YEAR_RANGE_RE.test(l)).length;

  const haystack = text.toLowerCase();
  const skills = KNOWN_SKILLS.filter((s) =>
    haystack.includes(s.toLowerCase()),
  );

  return {
    name,
    roles: Math.max(roles, 1),
    bullets: Math.max(bullets, 1),
    metricBullets,
    skills,
  };
}
