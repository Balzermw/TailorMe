import type { TailoredDoc } from "@/lib/types";
import { isTemplateId } from "./templates";
import { cleanResumeDate } from "./dates";
import { normalizeContactLine } from "./contact";

function str(v: unknown, max: number): string {
  return typeof v === "string" ? v.slice(0, max) : "";
}

// Résumé templates often ship placeholder guidance — e.g. "Add a concise 1-2
// sentence professional summary highlighting skills and career goals." — that
// gets extracted into real content when a template-based PDF is imported. Drop
// sentences that are clearly such instructions so they don't render as part of
// the résumé. Deliberately strict (imperative verb + article + a résumé noun,
// or a bracketed placeholder) so it never touches a genuine summary sentence.
const TEMPLATE_GUIDANCE_RE =
  /^\s*(?:tip:|note:|example:|hint:)?\s*(?:add|list|include|insert|enter|write|describe|summar(?:ize|ise)|highlight|showcase|mention|replace|provide|outline|fill\s+in)\s+(?:a|an|your|the|some|any|all|each|one|two|\d|here)\b[^.!?\n]*\b(?:summary|skills?|experience|section|bullets?|professional|career|goals?|objective|highlights?|achievements?|qualifications?|profile|headline)\b/i;

function isTemplateGuidance(sentence: string): boolean {
  const s = sentence.trim();
  if (!s) return false;
  if (/^[[<(].{0,80}[)\]>][.\s]*$/.test(s)) return true; // [Your summary] / <placeholder>
  return TEMPLATE_GUIDANCE_RE.test(s);
}

/** Remove leftover résumé-template instruction sentences from free text (used
 *  for the summary). Keeps the original if it can't confidently separate real
 *  content from guidance, so it never blanks a genuine summary. */
export function stripTemplateGuidance(text: string): string {
  const trimmed = (text ?? "").trim();
  if (!trimmed) return trimmed;
  const segments = trimmed
    .split(/\n+|(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
  if (segments.length < 2) {
    return isTemplateGuidance(trimmed) ? "" : trimmed;
  }
  const kept = segments.filter((s) => !isTemplateGuidance(s));
  const cleaned = kept.join(" ").replace(/[ \t]+/g, " ").trim();
  return cleaned || trimmed; // all-guidance → keep original rather than blank it
}

const HEADLINE_MAX_CHARS = 70;
const HEADLINE_MAX_WORDS = 8;

function words(value: string): string[] {
  return value.split(/\s+/).filter(Boolean);
}

function titleCaseShort(value: string): string {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => (word.length <= 3 && word === word.toUpperCase()
      ? word
      : word.charAt(0).toUpperCase() + word.slice(1)))
    .join(" ");
}

function compactHeadline(value: string): string {
  let headline = value
    .replace(/\s+/g, " ")
    // Drop buzzword piles / clarifier tails after a HARD separator. Comma is
    // intentionally excluded: structural role titles ("Lead, Product Management")
    // depend on it. We only strip a comma when a clarifier phrase clearly follows
    // (", with 10 years\u2026", ", specializing in\u2026"), never a multi-part title.
    .replace(/\s*[;:|\u2022\u00b7]\s*.*$/, "")
    .replace(/\s*,\s*(?:with\b|specializing\b|experienced\b|formerly\b|previously\b|\d).*$/i, "")
    .trim();
  const withMatch = headline.match(/^(.+?)\s+with\s+(.+)$/i);
  if (withMatch) {
    const base = withMatch[1].trim();
    const context = withMatch[2]
      .replace(/\b(experience|expertise|background|skills?|leadership)\b.*$/i, "")
      .split(/,|\band\b|\bfor\b|\bin\b/i)[0]
      .trim();
    if (/^(engineer|manager|analyst|consultant|developer|specialist)$/i.test(base) && context) {
      headline = `${titleCaseShort(words(context).slice(0, 2).join(" "))} ${base}`;
    } else {
      headline = base;
    }
  }
  headline = headline
    .replace(/\s+(specializing|experienced)\s+in\s+.*$/i, "")
    .replace(/\s+(experience|expertise|background|track record)\b.*$/i, "")
    .trim();
  const parts = words(headline);
  if (parts.length > HEADLINE_MAX_WORDS) headline = parts.slice(0, HEADLINE_MAX_WORDS).join(" ");
  if (headline.length > HEADLINE_MAX_CHARS) {
    const sliced = headline.slice(0, HEADLINE_MAX_CHARS);
    headline = sliced.slice(0, Math.max(sliced.lastIndexOf(" "), 0)).trim() || sliced.trim();
  }
  return headline;
}

export function normalizeHeadline(input: unknown, fallback?: string): string {
  const raw = str(input, 180).trim();
  const compactFallback = fallback ? compactHeadline(str(fallback, 120)) : "";
  const rawWords = words(raw);
  const sentenceLike =
    raw.length > HEADLINE_MAX_CHARS ||
    rawWords.length > HEADLINE_MAX_WORDS ||
    /\bwith\b.+\b(experience|expertise|background|leadership|skills?)\b/i.test(raw);

  if (
    sentenceLike &&
    compactFallback &&
    compactFallback.length <= HEADLINE_MAX_CHARS &&
    words(compactFallback).length <= HEADLINE_MAX_WORDS
  ) {
    return compactFallback;
  }

  const compacted = compactHeadline(raw);
  // Recover a truncated title: if the headline is just a short prefix of the
  // fuller target role (e.g. "Lead" of "Lead, Product Management" — an older
  // import truncated it at the comma), prefer the role so the real title shows.
  if (
    compactFallback &&
    compactFallback.length <= HEADLINE_MAX_CHARS &&
    words(compactFallback).length <= HEADLINE_MAX_WORDS &&
    compacted.length < compactFallback.length &&
    compactFallback.toLowerCase().startsWith(compacted.toLowerCase())
  ) {
    return compactFallback;
  }

  return compacted;
}

// Validate + bound an incoming (client-edited or builder-assembled) doc so a
// malformed or oversized doc can never be persisted or break the LaTeX render.
// Mirrors the limits the pipeline already respects; returns null if unusable.
export function sanitizeDoc(input: unknown): TailoredDoc | null {
  if (!input || typeof input !== "object") return null;
  const d = input as Record<string, unknown>;

  const experience = (Array.isArray(d.experience) ? d.experience : [])
    .slice(0, 24)
    .map((e) => {
      const x = (e ?? {}) as Record<string, unknown>;
      return {
        role: str(x.role, 160).trim(),
        company: str(x.company, 160).trim(),
        dates: cleanResumeDate(str(x.dates, 80)),
        bullets: (Array.isArray(x.bullets) ? x.bullets : [])
          .map((b) => str(b, 600).trim())
          .filter((b) => b.length > 0)
          .slice(0, 14),
      };
    })
    .filter((e) => e.role || e.company || e.bullets.length > 0);

  const education = (Array.isArray(d.education) ? d.education : [])
    .slice(0, 12)
    .map((e) => {
      const x = (e ?? {}) as Record<string, unknown>;
      return {
        school: str(x.school, 160).trim(),
        degree: str(x.degree, 160).trim(),
        dates: cleanResumeDate(str(x.dates, 80)),
      };
    })
    .filter((e) => e.school || e.degree);

  const projects = (Array.isArray(d.projects) ? d.projects : [])
    .slice(0, 12)
    .map((e) => {
      const x = (e ?? {}) as Record<string, unknown>;
      return {
        name: str(x.name, 160).trim(),
        description: str(x.description, 600).trim(),
      };
    })
    .filter((e) => e.name || e.description);

  const certifications = (Array.isArray(d.certifications) ? d.certifications : [])
    .slice(0, 16)
    .map((e) => {
      const x = (e ?? {}) as Record<string, unknown>;
      return {
        name: str(x.name, 160).trim(),
        issuer: str(x.issuer, 160).trim(),
        date: cleanResumeDate(str(x.date, 80)),
      };
    })
    .filter((e) => e.name);

  const flatSkills = (Array.isArray(d.skills) ? d.skills : [])
    .map((s) => str(s, 80).trim())
    .filter(Boolean)
    .slice(0, 48);

  // Optional categorized skills. Bound count/labels; drop empty groups. When
  // present, the flat `skills` is re-derived from the groups so every flat
  // reader (serialize/score/ATS) stays consistent with what's rendered.
  const skillGroups = (Array.isArray(d.skillGroups) ? d.skillGroups : [])
    .slice(0, 6)
    .map((g) => {
      const x = (g ?? {}) as Record<string, unknown>;
      return {
        label: str(x.label, 50).trim(),
        skills: (Array.isArray(x.skills) ? x.skills : [])
          .map((s) => str(s, 80).trim())
          .filter(Boolean)
          .slice(0, 14),
      };
    })
    .filter((g) => g.label && g.skills.length > 0);

  const doc: TailoredDoc = {
    name: str(d.name, 120).trim(),
    headline: normalizeHeadline(d.headline),
    contact: normalizeContactLine(str(d.contact, 240)),
    summary: stripTemplateGuidance(str(d.summary, 1400)),
    experience,
    education,
    projects,
    certifications,
    skills: skillGroups.length
      ? Array.from(new Set(skillGroups.flatMap((g) => g.skills))).slice(0, 48)
      : flatSkills,
    ...(skillGroups.length ? { skillGroups } : {}),
    ...(isTemplateId(d.template) ? { template: d.template } : {}),
    coverLetter: str(d.coverLetter, 6000),
  };
  if (!doc.name && experience.length === 0) return null;
  return doc;
}
