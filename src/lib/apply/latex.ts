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
    // No inputenc: the compile service uses XeLaTeX, which reads UTF-8 natively.
    `\\name{${escapeLatex(first)}}{${escapeLatex(last)}}`,
    `\\title{${escapeLatex(doc.headline)}}`,
    `\\email{${escapeLatex(doc.contact)}}`,
  ].join("\n");
};

// ---- two-page fit ----
// moderncv banking at scale 0.84 holds roughly one page per ~3-4 dense entries.
// These caps bound BOTH the count AND the per-item length of every section so the
// rendered résumé stays within ~two pages even at the model's verbose worst case
// (max entries × max bullets × max bullet length ≈ 1.7 pages — see the
// "two-page line budget" regression test). Applied at render time (PDF + print
// view) so the stored ApplyResult keeps the full content for the dashboard.
export const TWO_PAGE = {
  maxEntries: 6,
  bulletsByIndex: [4, 4, 3, 3, 2, 2], // 18 bullets total; newest roles get more room
  minBullets: 2,
  maxSkills: 18,
  maxEducation: 4,
  maxSchoolChars: 70,
  maxDegreeChars: 90,
  maxProjects: 6,
  maxProjectNameChars: 90,
  maxProjectDescChars: 240,
  maxCerts: 10,
  maxCertNameChars: 110,
  maxCertIssuerChars: 70,
  maxSummary: 360,
  maxBulletChars: 160, // ~2 lines each in the content column
  maxSkillChars: 40,
  maxCoverParas: 5,
  maxCoverParaChars: 480, // worst case (5 × 480) fits one page
  // Header fields also wrap to extra lines if the model echoes long values, so
  // bound them too (the dates column in moderncv banking is especially narrow).
  // maxNameChars is generous — no real name reaches it, so legit names are never
  // truncated; it only caps a pathological model echo.
  maxNameChars: 80,
  maxHeadlineChars: 90,
  maxContactChars: 120,
  maxRoleChars: 90,
  maxCompanyChars: 70,
  maxDatesChars: 32,
};

/**
 * Trim a string to `max` characters at a word boundary (hard-cut if no space).
 * Iterates by code point so a surrogate pair (emoji, etc.) is never split. Caps
 * are by character count, not visual width — fine for the Latin-script résumés
 * this product targets.
 */
function clampLen(s: string, max: number): string {
  if (!s) return s;
  const cps = Array.from(s);
  if (cps.length <= max) return s;
  const cut = cps.slice(0, max).join("");
  const atWord = cut.replace(/\s+\S*$/, "");
  return (atWord.length >= max * 0.6 ? atWord : cut) + "…";
}

/**
 * Skills arrive from the model as a free list; some entries are really several
 * comma- or semicolon-separated skills crammed into one string (e.g.
 * "Salesforce, Zendesk, Intercom, Confluence"). Split those into atomic skills,
 * trim, and dedupe so the " • "-joined line reads cleanly and the bullet is the
 * only separator. Grouped terms joined by "/" (e.g. "SSO / SAML / OAuth") are
 * left intact — that slash is part of the term, not a list.
 */
export function normalizeSkills(skills: string[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const raw of skills ?? []) {
    if (typeof raw !== "string") continue;
    for (const piece of raw.split(/\s*[,;]\s*/)) {
      const s = piece.trim();
      if (!s) continue;
      const key = s.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(s);
    }
  }
  return out;
}

/**
 * Trim a tailored doc so the moderncv render reliably fits two pages — bounds
 * BOTH the number of entries/bullets/skills AND the length of each individual
 * bullet, skill, and the summary (a count cap alone can't bound page height).
 */
export function clampToTwoPages(doc: TailoredDoc): TailoredDoc {
  const experience = (doc.experience ?? [])
    .slice(0, TWO_PAGE.maxEntries)
    .map((e, i) => ({
      ...e,
      role: clampLen(e.role ?? "", TWO_PAGE.maxRoleChars),
      company: clampLen(e.company ?? "", TWO_PAGE.maxCompanyChars),
      dates: clampLen(e.dates ?? "", TWO_PAGE.maxDatesChars),
      bullets: (e.bullets ?? [])
        .slice(0, TWO_PAGE.bulletsByIndex[i] ?? TWO_PAGE.minBullets)
        .map((b) => clampLen(b, TWO_PAGE.maxBulletChars)),
    }));

  return {
    ...doc,
    name: clampLen(doc.name ?? "", TWO_PAGE.maxNameChars),
    headline: clampLen(doc.headline ?? "", TWO_PAGE.maxHeadlineChars),
    contact: clampLen(doc.contact ?? "", TWO_PAGE.maxContactChars),
    summary: clampLen(doc.summary ?? "", TWO_PAGE.maxSummary),
    experience,
    skills: normalizeSkills(doc.skills ?? [])
      .slice(0, TWO_PAGE.maxSkills)
      .map((s) => clampLen(s, TWO_PAGE.maxSkillChars)),
    education: (doc.education ?? [])
      .slice(0, TWO_PAGE.maxEducation)
      .map((ed) => ({
        degree: clampLen(ed.degree ?? "", TWO_PAGE.maxDegreeChars),
        school: clampLen(ed.school ?? "", TWO_PAGE.maxSchoolChars),
        dates: clampLen(ed.dates ?? "", TWO_PAGE.maxDatesChars),
      })),
    projects: (doc.projects ?? [])
      .slice(0, TWO_PAGE.maxProjects)
      .map((p) => ({
        name: clampLen(p.name ?? "", TWO_PAGE.maxProjectNameChars),
        description: clampLen(p.description ?? "", TWO_PAGE.maxProjectDescChars),
      })),
    certifications: (doc.certifications ?? [])
      .slice(0, TWO_PAGE.maxCerts)
      .map((c) => ({
        name: clampLen(c.name ?? "", TWO_PAGE.maxCertNameChars),
        issuer: clampLen(c.issuer ?? "", TWO_PAGE.maxCertIssuerChars),
        date: clampLen(c.date ?? "", TWO_PAGE.maxDatesChars),
      })),
  };
}

/** moderncv-banking résumé as compilable LaTeX (clamped to two pages). */
export function renderResumeTex(input: TailoredDoc): string {
  const doc = clampToTwoPages(input);
  const lines: string[] = [PREAMBLE(doc), "\\begin{document}", "\\makecvtitle"];

  if (doc.summary) {
    lines.push("\\section{Summary}");
    lines.push(`\\cvitem{}{${escapeLatex(doc.summary)}}`);
  }

  if (doc.experience.length) lines.push("\\section{Experience}");
  for (const e of doc.experience) {
    const head = `\\cventry{${escapeLatex(e.dates)}}{${escapeLatex(
      e.role,
    )}}{${escapeLatex(e.company)}}{}{}`;
    if (!e.bullets.length) {
      // An itemize with no \item fails LaTeX — emit an empty description instead.
      lines.push(`${head}{}`);
      continue;
    }
    const items = e.bullets.map((b) => `  \\item ${escapeLatex(b)}`).join("\n");
    lines.push(`${head}{%\n\\begin{itemize}\n${items}\n\\end{itemize}}`);
  }

  if (doc.education && doc.education.length) {
    lines.push("\\section{Education}");
    for (const ed of doc.education) {
      lines.push(
        `\\cventry{${escapeLatex(ed.dates)}}{${escapeLatex(ed.degree)}}{${escapeLatex(
          ed.school,
        )}}{}{}{}`,
      );
    }
  }

  if (doc.projects && doc.projects.length) {
    lines.push("\\section{Projects}");
    for (const p of doc.projects) {
      lines.push(`\\cvitem{${escapeLatex(p.name)}}{${escapeLatex(p.description)}}`);
    }
  }

  if (doc.certifications && doc.certifications.length) {
    lines.push("\\section{Certifications}");
    for (const c of doc.certifications) {
      const tail = [c.issuer, c.date].filter(Boolean).map(escapeLatex).join(", ");
      lines.push(`\\cvitem{${escapeLatex(c.name)}}{${tail}}`);
    }
  }

  if (doc.skillGroups?.length) {
    // Categorized: a labeled cvitem per group — the dominant professional layout.
    lines.push("\\section{Skills}");
    for (const g of doc.skillGroups) {
      lines.push(
        `\\cvitem{${escapeLatex(g.label)}}{${normalizeSkills(g.skills)
          .map(escapeLatex)
          .join(", ")}}`,
      );
    }
  } else if (doc.skills.length) {
    lines.push("\\section{Skills}");
    // Comma-separated reads cleaner than a bullet run-on (the dominant
    // professional pattern); normalizeSkills has already split jammed entries.
    lines.push(`\\cvitem{}{${normalizeSkills(doc.skills).map(escapeLatex).join(", ")}}`);
  }

  lines.push("\\end{document}");
  return lines.join("\n");
}

/** Split a cover letter into bounded paragraphs (≤1 page) for either renderer. */
export function coverParagraphs(text: string): string[] {
  return (text ?? "")
    .split(/\n\n+/)
    .map((p) => p.trim())
    .filter(Boolean)
    .slice(0, TWO_PAGE.maxCoverParas)
    .map((p) => clampLen(p, TWO_PAGE.maxCoverParaChars));
}

/** moderncv-banking cover letter as compilable LaTeX. */
export function renderCoverTex(doc: TailoredDoc, company = ""): string {
  const clamped = clampToTwoPages(doc); // bound name/headline/contact in the preamble too
  const paras = coverParagraphs(doc.coverLetter);
  const opening = paras[0] ?? "Dear hiring team,";
  const closing = paras.length > 1 ? paras[paras.length - 1] : "Sincerely,";
  const body = paras.slice(1, -1); // paragraphs between the opening and closing

  return [
    PREAMBLE(clamped),
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
  const token = process.env.LATEX_COMPILE_TOKEN;
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const res = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify({ tex, engine: "xelatex" }),
  });
  if (!res.ok) throw new Error(`LaTeX compile failed (${res.status})`);
  return new Uint8Array(await res.arrayBuffer());
}

export const latexConfigured = Boolean(process.env.LATEX_COMPILE_URL);
