// Client-safe résumé template registry. The actual LaTeX renderers live in the
// server-only latex.ts; this file holds just the metadata the picker UI needs
// plus the id type/allowlist, so it can be imported from client components.

export type TemplateId = "jake" | "moderncv-banking" | "classic" | "modern";

export const DEFAULT_TEMPLATE: TemplateId = "jake";

export interface ResumeTemplateMeta {
  id: TemplateId;
  name: string;
  blurb: string;
  // ATS-friendliness tier shown to the user. All current templates are single
  // column (no parser-tripping multi-column layouts).
  ats: "safe" | "good";
}

export const RESUME_TEMPLATES: ResumeTemplateMeta[] = [
  {
    id: "jake",
    name: "Jake's Resume",
    blurb: "Popular single column: centered name, ruled sections, bold roles.",
    ats: "safe",
  },
  {
    id: "moderncv-banking",
    name: "ModernCV",
    blurb: "Clean single column with a colored header.",
    ats: "good",
  },
  {
    id: "classic",
    name: "Classic",
    blurb: "Timeless serif, centered name, ruled sections.",
    ats: "safe",
  },
  {
    id: "modern",
    name: "Minimalist",
    blurb: "Sans-serif, bold titles, tight single column.",
    ats: "safe",
  },
];

export function isTemplateId(value: unknown): value is TemplateId {
  return typeof value === "string" && RESUME_TEMPLATES.some((t) => t.id === value);
}

export function templateName(id: string | undefined): string {
  return RESUME_TEMPLATES.find((t) => t.id === id)?.name ?? "Jake's Resume";
}
