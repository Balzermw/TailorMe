// Segment a LaTeX résumé into sections + bullets so deterministic/heuristic
// detectors can inspect structure without an LLM. Intentionally tolerant: real
// résumés use many macros/templates, so we normalize on \section{...} (and a
// few common variants) and treat everything before the first section as header.

export interface LatexBullet {
  text: string; // de-LaTeX'd bullet text
  section: string; // normalized section name the bullet belongs to
  raw: string; // original \item source
}

export interface LatexSection {
  name: string; // as written, e.g. "Work Experience"
  normalized: string; // lowercased canonical, e.g. "experience"
  body: string; // raw LaTeX between this heading and the next
  items: LatexBullet[];
}

export interface ParsedLatexResume {
  source: string;
  header: string; // raw LaTeX before the first \section
  headerText: string; // de-LaTeX'd header text
  sections: LatexSection[];
  bullets: LatexBullet[]; // all bullets across sections
  has(section: string): boolean; // normalized-name presence check
}

const SECTION_RE = /\\section\*?\{([^}]*)\}/g;
// \item, \resumeItem{...}, \cvitem{...}{...}, \item[...] — capture the content.
const ITEM_RE = /\\(?:item\b(?:\[[^\]]*\])?|resumeItem\{|cvitem\{[^}]*\}\{)/g;

/** Strip the most common LaTeX commands/wrappers to recover readable text. */
export function deLatex(s: string): string {
  return s
    .replace(/\\(begin|end)\{[^}]*\}/g, " ") // drop environments (itemize, document…)
    .replace(/\\href\{[^}]*\}\{([^}]*)\}/g, "$1") // keep link text, drop url
    // Drop the command NAME but keep its brace content, so \name{Jordan Smith},
    // \textbf{...}, \resumeItem{...} etc. retain their text instead of vanishing.
    .replace(/\\[a-zA-Z]+\*?(\[[^\]]*\])?/g, " ")
    .replace(/[{}]/g, " ")
    .replace(/\\[%&$#_]/g, "")
    .replace(/~/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const SECTION_ALIASES: Array<[RegExp, string]> = [
  [/summary|profile|objective|about/i, "summary"],
  [/experience|employment|work history|professional/i, "experience"],
  [/skills|competenc|technolog|technical/i, "skills"],
  [/projects?/i, "projects"],
  [/education|academic/i, "education"],
  [/certif|licens/i, "certifications"],
  [/references?/i, "references"],
];

export function normalizeSectionName(name: string): string {
  const n = deLatex(name);
  for (const [re, canonical] of SECTION_ALIASES) if (re.test(n)) return canonical;
  return n.toLowerCase().trim();
}

function extractItems(body: string, section: string): LatexBullet[] {
  const items: LatexBullet[] = [];
  const matches = [...body.matchAll(ITEM_RE)];
  for (let i = 0; i < matches.length; i++) {
    const start = matches[i].index! + matches[i][0].length;
    const end = i + 1 < matches.length ? matches[i + 1].index! : body.length;
    const raw = body.slice(start, end);
    const text = deLatex(raw);
    if (text.length >= 3) items.push({ text, section, raw: raw.trim() });
  }
  return items;
}

export function extractLatexResumeSections(source: string): ParsedLatexResume {
  const headings = [...source.matchAll(SECTION_RE)];
  const header = headings.length ? source.slice(0, headings[0].index!) : source;

  const sections: LatexSection[] = headings.map((h, i) => {
    const bodyStart = h.index! + h[0].length;
    const bodyEnd = i + 1 < headings.length ? headings[i + 1].index! : source.length;
    const body = source.slice(bodyStart, bodyEnd);
    const normalized = normalizeSectionName(h[1]);
    return { name: deLatex(h[1]), normalized, body, items: extractItems(body, normalized) };
  });

  const bullets = sections.flatMap((s) => s.items);
  const normalizedNames = new Set(sections.map((s) => s.normalized));

  return {
    source,
    header,
    headerText: deLatex(header),
    sections,
    bullets,
    has: (section: string) => normalizedNames.has(section),
  };
}
