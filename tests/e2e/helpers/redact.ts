export interface RedactionContext {
  names?: string[];
  fileNames?: string[];
  realResume?: boolean;
}

const REDACTED = "[REDACTED]";
const REDACTED_CONTENT = "[REDACTED_CONTENT]";

const sensitiveKeyPattern =
  /(resume|posting|jobDescription|description|raw|text|doc|payload|body|coverLetter|experience|education|skills|profile|candidate)/i;

const secretKeyPattern =
  /(authorization|cookie|token|secret|apikey|api_key|service_role|supabase|openai|anthropic|stripe|password)/i;

export function redactText(input: unknown, context: RedactionContext = {}): string {
  if (input == null) return "";
  let text = String(input);

  for (const name of [...(context.names ?? []), ...(context.fileNames ?? [])]) {
    const clean = name.trim();
    if (clean.length >= 3) {
      text = text.replace(new RegExp(escapeRegExp(clean), "gi"), REDACTED);
    }
  }

  text = text
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, REDACTED)
    .replace(/\b(?:\+?1[-.\s]?)?(?:\(?\d{3}\)?[-.\s]?)\d{3}[-.\s]?\d{4}\b/g, REDACTED)
    .replace(/\bhttps?:\/\/(?:www\.)?linkedin\.com\/[^\s"'<>]+/gi, REDACTED)
    .replace(/\blinkedin\.com\/[^\s"'<>]+/gi, REDACTED)
    .replace(/\bhttps?:\/\/[^\s"'<>]+/gi, (url) =>
      /localhost|127\.0\.0\.1|example\.com/i.test(url) ? url : REDACTED,
    )
    .replace(/\b(?:Bearer|Basic)\s+[A-Za-z0-9._~+/=-]+/gi, `${REDACTED} auth`)
    .replace(/\b(?:sk|pk|rk|whsec|sbp)_[A-Za-z0-9_=-]{16,}\b/g, REDACTED)
    .replace(/\b[A-Za-z]:\\Users\\[^\\\r\n]+\\[^\r\n"']*/g, "[REDACTED_PATH]")
    .replace(/\b\d{1,6}\s+[A-Z][A-Za-z0-9.'-]*(?:\s+[A-Z][A-Za-z0-9.'-]*){0,4}\s+(?:St|Street|Ave|Avenue|Rd|Road|Blvd|Drive|Dr|Lane|Ln|Court|Ct)\b/gi, REDACTED);

  if (context.realResume && looksResumeLike(text)) {
    return REDACTED_CONTENT;
  }

  return text;
}

export function redactObject<T>(value: T, context: RedactionContext = {}, depth = 0): T | string {
  if (depth > 8) return "[REDACTED_DEPTH]";
  if (value == null) return value;
  if (typeof value === "string") return redactText(value, context);
  if (typeof value !== "object") return value;
  if (Array.isArray(value)) {
    return value.map((item) => redactObject(item, context, depth + 1)) as T;
  }

  const output: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
    if (secretKeyPattern.test(key)) {
      output[key] = REDACTED;
      continue;
    }
    if (sensitiveKeyPattern.test(key)) {
      output[key] =
        typeof item === "string" && item.length < 80
          ? redactText(item, context)
          : REDACTED_CONTENT;
      continue;
    }
    output[key] = redactObject(item, context, depth + 1);
  }
  return output as T;
}

export function redactJsonString(raw: string, context: RedactionContext = {}): string {
  try {
    return JSON.stringify(redactObject(JSON.parse(raw), context), null, 2);
  } catch {
    return redactText(raw, context);
  }
}

export function findSensitiveLeak(value: unknown, extraNeedles: string[] = []): string[] {
  const raw = typeof value === "string" ? value : JSON.stringify(value);
  const findings: string[] = [];
  const checks: [string, RegExp][] = [
    ["email", /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i],
    ["phone", /\b(?:\+?1[-.\s]?)?(?:\(?\d{3}\)?[-.\s]?)\d{3}[-.\s]?\d{4}\b/],
    ["linkedin", /linkedin\.com\/[^\s"'<>]+/i],
    ["street_address", /\b\d{1,6}\s+[A-Z][A-Za-z0-9.'-]*(?:\s+[A-Z][A-Za-z0-9.'-]*){0,4}\s+(?:St|Street|Ave|Avenue|Rd|Road|Blvd|Drive|Dr|Lane|Ln|Court|Ct)\b/i],
    ["secret", /\b(?:sk|pk|rk|whsec|sbp)_[A-Za-z0-9_=-]{16,}\b/],
  ];
  for (const [label, pattern] of checks) {
    if (pattern.test(raw)) findings.push(label);
  }
  for (const needle of extraNeedles) {
    const clean = needle.trim();
    if (clean.length > 8 && raw.toLowerCase().includes(clean.toLowerCase())) {
      findings.push(`needle:${clean.slice(0, 12)}`);
    }
  }
  if (looksResumeLike(raw) && raw.length > 500) findings.push("resume_like_text");
  return Array.from(new Set(findings));
}

function looksResumeLike(text: string): boolean {
  if (text.length < 400) return false;
  const signals = [
    /experience/i,
    /education/i,
    /skills/i,
    /summary/i,
    /certifications?/i,
    /projects?/i,
    /\b\d{4}\b/,
  ].filter((pattern) => pattern.test(text)).length;
  return signals >= 3;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
