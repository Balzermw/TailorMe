import type { TailoredDoc } from "@/lib/types";

// Real moderncv (banking) LaTeX generation for the tailored documents, plus a
// pluggable compile step. Generating the .tex is pure and always available;
// compiling to PDF is delegated to a self-hosted LaTeX service (the brief's
// Managed-Agents container) so user resumes never leave your infrastructure.

const LATEX_SPECIALS: Record<string, string> = {
  "\\": "\\textbackslash{}",
  "&": "\\&",
  "%": "\\%",
  $: "\\$",
  "#": "\\#",
  _: "\\_",
  "{": "\\{",
  "}": "\\}",
  "~": "\\textasciitilde{}",
  "^": "\\textasciicircum{}",
};

/** Escape a plain string for safe inclusion in LaTeX source. */
export function escapeLatex(input: string): string {
  return input.replace(/[\\&%$#_{}~^]/g, (c) => LATEX_SPECIALS[c] ?? c);
}

function splitName(name: string): { first: string; last: string } {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return { first: parts[0], last: "" };
  return { first: parts.slice(0, -1).join(" "), last: parts[parts.length - 1] };
}

const PREAMBLE = (doc: TailoredDoc): string => {
  const { first, last } = splitName(doc.name);
  return [
    "\\documentclass[11pt,a4paper,sans]{moderncv}",
    "\\moderncvstyle{banking}",
    "\\moderncvcolor{blue}",
    "\\usepackage[scale=0.84]{geometry}",
    "\\usepackage[utf8]{inputenc}",
    `\\name{${escapeLatex(first)}}{${escapeLatex(last)}}`,
    `\\title{${escapeLatex(doc.headline)}}`,
    `\\email{${escapeLatex(doc.contact)}}`,
  ].join("\n");
};

/** moderncv-banking résumé as compilable LaTeX. */
export function renderResumeTex(doc: TailoredDoc): string {
  const lines: string[] = [PREAMBLE(doc), "\\begin{document}", "\\makecvtitle"];

  if (doc.summary) {
    lines.push("\\section{Summary}");
    lines.push(`\\cvitem{}{${escapeLatex(doc.summary)}}`);
  }

  lines.push("\\section{Experience}");
  for (const e of doc.experience) {
    const items = e.bullets
      .map((b) => `  \\item ${escapeLatex(b)}`)
      .join("\n");
    lines.push(
      `\\cventry{${escapeLatex(e.dates)}}{${escapeLatex(e.role)}}{${escapeLatex(
        e.company,
      )}}{}{}{%\n\\begin{itemize}\n${items}\n\\end{itemize}}`,
    );
  }

  if (doc.skills.length) {
    lines.push("\\section{Skills}");
    lines.push(`\\cvitem{}{${doc.skills.map(escapeLatex).join(" \\textbullet{} ")}}`);
  }

  lines.push("\\end{document}");
  return lines.join("\n");
}

/** moderncv-banking cover letter as compilable LaTeX. */
export function renderCoverTex(doc: TailoredDoc, company = ""): string {
  const paras = doc.coverLetter
    .split(/\n\n+/)
    .map((p) => p.trim())
    .filter(Boolean);
  const opening = paras[0] ?? "Dear hiring team,";
  const closing = paras.length > 1 ? paras[paras.length - 1] : "Sincerely,";
  const body = paras.slice(1, -1); // paragraphs between the opening and closing

  return [
    PREAMBLE(doc),
    company ? `\\recipient{${escapeLatex(company)}}{Hiring team}` : "",
    `\\opening{${escapeLatex(opening)}}`,
    "\\begin{document}",
    "\\makelettertitle",
    ...body.map((p) => escapeLatex(p) + "\\par\\medskip"),
    `\\closing{${escapeLatex(closing)}}`,
    "\\makeletterclosing",
    "\\end{document}",
  ]
    .filter(Boolean)
    .join("\n");
}

/**
 * Compile LaTeX → PDF via a self-hosted service (LATEX_COMPILE_URL). Returns
 * the PDF bytes, or null when no compiler is configured (callers then fall back
 * to the in-app print/Save-as-PDF view). Keeping this behind an env-driven
 * endpoint means resume content stays on your own infrastructure.
 */
export async function compileToPdf(tex: string): Promise<Uint8Array | null> {
  const url = process.env.LATEX_COMPILE_URL;
  if (!url) return null;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ tex, engine: "xelatex" }),
  });
  if (!res.ok) throw new Error(`LaTeX compile failed (${res.status})`);
  return new Uint8Array(await res.arrayBuffer());
}

export const latexConfigured = Boolean(process.env.LATEX_COMPILE_URL);
