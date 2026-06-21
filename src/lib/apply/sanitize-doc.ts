import type { TailoredDoc } from "@/lib/types";
import { isTemplateId } from "./templates";

function str(v: unknown, max: number): string {
  return typeof v === "string" ? v.slice(0, max) : "";
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
        dates: str(x.dates, 80).trim(),
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
        dates: str(x.dates, 80).trim(),
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
        date: str(x.date, 80).trim(),
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
    headline: str(d.headline, 160).trim(),
    contact: str(d.contact, 240).trim(),
    summary: str(d.summary, 1400).trim(),
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
