import type { TailoredDoc } from "@/lib/types";

// Serialize a structured TailoredDoc back into plain resume prose. Used to keep
// resumes.raw_text in sync with a built/edited doc, and (later) to feed the
// text-based parse/score/tailor pipeline from a structured base resume.
export function docToResumeText(doc: TailoredDoc): string {
  const lines: string[] = [];
  if (doc.name) lines.push(doc.name);
  if (doc.headline) lines.push(doc.headline);
  if (doc.contact) lines.push(doc.contact);

  if (doc.summary?.trim()) {
    lines.push("", "Summary", doc.summary.trim());
  }

  if (doc.experience?.length) {
    lines.push("", "Experience");
    for (const e of doc.experience) {
      const head = [e.role, e.company].filter(Boolean).join(" — ");
      lines.push(`${head}${e.dates ? ` (${e.dates})` : ""}`.trim());
      for (const b of e.bullets ?? []) {
        if (b.trim()) lines.push(`- ${b.trim()}`);
      }
    }
  }

  if (doc.education?.length) {
    lines.push("", "Education");
    for (const ed of doc.education) {
      const head = [ed.degree, ed.school].filter(Boolean).join(", ");
      lines.push(`${head}${ed.dates ? ` (${ed.dates})` : ""}`.trim());
    }
  }

  if (doc.projects?.length) {
    lines.push("", "Projects");
    for (const p of doc.projects) {
      lines.push(p.name.trim());
      if (p.description?.trim()) lines.push(p.description.trim());
    }
  }

  if (doc.certifications?.length) {
    lines.push("", "Certifications");
    for (const c of doc.certifications) {
      const tail = [c.issuer, c.date].filter(Boolean).join(", ");
      lines.push(`${c.name}${tail ? ` (${tail})` : ""}`.trim());
    }
  }

  if (doc.skills?.length) {
    lines.push("", `Skills: ${doc.skills.join(", ")}`);
  }

  return lines.join("\n").trim();
}
