// Shared résumé-section helpers. Used by the editor (sidebar nav + fix routing)
// and the audit wizard (citing which section a proof point belongs to), so the
// audit doesn't have to pull in the heavy editor module just for this logic.

import type { ProofPoint } from "@/lib/types";

export type Section =
  | "header"
  | "summary"
  | "experience"
  | "projects"
  | "education"
  | "certifications"
  | "skills"
  | "fixes";

export const SECTION_LABEL: Record<Section, string> = {
  header: "Header",
  summary: "Summary",
  experience: "Experience",
  projects: "Projects",
  education: "Education",
  certifications: "Certifications",
  skills: "Skills",
  fixes: "Feedback",
};

// Route a finding to the section the user edits to act on it, so each piece of
// feedback links straight to where the change is made.
export function fixSection(p: ProofPoint): Section {
  const t = `${p.title} ${p.summary} ${p.quote ?? ""} ${p.fix}`.toLowerCase();
  if (/summary|objective|profile/.test(t)) return "summary";
  if (/certif|credential|license/.test(t)) return "certifications";
  if (/\bprojects?\b|portfolio/.test(t)) return "projects";
  if (/\bskills?\b|toolset|technolog/.test(t)) return "skills";
  if (/education|degree|\bgpa\b|coursework|university|college/.test(t)) return "education";
  if (/contact|email|phone|linkedin|headline|\bname\b|\btitle\b/.test(t)) return "header";
  return "experience"; // dates, bullets, metrics, scope, achievements, etc.
}
