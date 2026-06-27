import { describe, expect, it } from "vitest";
import {
  clampToTwoPages,
  coverParagraphs,
  escapeLatex,
  renderCoverTex,
  renderResumeTex,
  TWO_PAGE,
} from "./latex";
import { SAMPLE_DOC } from "./sample";
import type { TailoredDoc } from "@/lib/types";

describe("latex generation", () => {
  it("escapes LaTeX-special characters", () => {
    expect(escapeLatex("R&D 50% $5 a_b #1 {x}")).toBe(
      "R\\&D 50\\% \\$5 a\\_b \\#1 \\{x\\}",
    );
    expect(escapeLatex("C:\\path")).toContain("\\textbackslash{}");
  });

  it("renders a compilable moderncv resume", () => {
    const tex = renderResumeTex({ ...SAMPLE_DOC, template: "moderncv-banking" });
    expect(tex).toContain("\\documentclass[11pt,a4paper,sans]{moderncv}");
    expect(tex).toContain("\\moderncvstyle{banking}");
    expect(tex).toContain("\\name{Alex}{Mercer}");
    expect(tex).toContain("\\title{Senior Platform Engineer}");
    expect(tex).toContain("\\section{Experience}");
    expect(tex).toContain("\\cventry{2019 – present}"); // dates passed through verbatim
    expect(tex).toContain("\\begin{itemize}");
    expect(tex.startsWith("\\documentclass")).toBe(true);
    expect(tex.trimEnd().endsWith("\\end{document}")).toBe(true);
  });

  it("omits imported duration suffixes from rendered dates", () => {
    const tex = renderResumeTex({
      ...SAMPLE_DOC,
      template: "moderncv-banking",
      experience: [
        {
          ...SAMPLE_DOC.experience[0],
          dates: "Apr 2026 - Present \u00b7 3 mos",
        },
      ],
    });
    expect(tex).toContain("\\cventry{Apr 2026 - Present}");
    expect(tex).not.toContain("3 mos");
  });

  it("renders the classic (article serif) template when selected", () => {
    const tex = renderResumeTex({ ...SAMPLE_DOC, template: "classic" });
    expect(tex).toContain("\\documentclass[11pt,a4paper]{article}");
    expect(tex).toContain("\\scshape"); // small-caps ruled section titles
    expect(tex).toContain("Alex Mercer");
    expect(tex).toContain("\\section{Experience}");
    expect(tex).not.toContain("moderncv");
    expect(tex.trimEnd().endsWith("\\end{document}")).toBe(true);
  });

  it("renders the modern (article sans) template when selected", () => {
    const tex = renderResumeTex({ ...SAMPLE_DOC, template: "modern" });
    expect(tex).toContain("\\documentclass[11pt,a4paper]{article}");
    expect(tex).toContain("\\sfdefault"); // sans-serif body
    expect(tex).toContain("\\section{Skills}");
    expect(tex).not.toContain("moderncv");
  });

  it("renders Jake's two-line entries when selected", () => {
    const tex = renderResumeTex({ ...SAMPLE_DOC, template: "jake" });
    expect(tex).toContain("\\documentclass[letterpaper,11pt]{article}");
    expect(tex).toContain("\\titlerule"); // ruled small-caps sections
    expect(tex).toContain("\\hfill"); // right-aligned dates on the role line
    expect(tex).toContain("Alex Mercer");
    expect(tex).not.toContain("moderncv");
  });

  it("uses Jake's (the default) for a missing or unknown template id", () => {
    const def = renderResumeTex(SAMPLE_DOC); // no template field
    expect(def).toContain("letterpaper");
    expect(def).toContain("\\scshape");
    expect(def).not.toContain("{moderncv}");
    // An unknown id resolves to the same default render.
    expect(renderResumeTex({ ...SAMPLE_DOC, template: "bogus" })).toBe(def);
  });

  it("still renders moderncv-banking when explicitly selected", () => {
    expect(renderResumeTex({ ...SAMPLE_DOC, template: "moderncv-banking" })).toContain("{moderncv}");
  });

  it("renders a cover letter with opening and closing", () => {
    const tex = renderCoverTex(SAMPLE_DOC, "Nordpeak Systems");
    expect(tex).toContain("\\recipient{Nordpeak Systems}");
    expect(tex).toContain("\\opening{");
    expect(tex).toContain("\\makelettertitle");
    expect(tex).toContain("\\makeletterclosing");
  });
});

describe("two-page clamp", () => {
  const big: TailoredDoc = {
    name: "A B",
    headline: "H",
    contact: "c",
    summary: "x".repeat(800),
    experience: Array.from({ length: 10 }, (_, i) => ({
      role: "R" + i,
      company: "C" + i,
      dates: "d",
      bullets: Array.from({ length: 8 }, (_, j) => `bullet ${i}-${j}`),
    })),
    skills: Array.from({ length: 40 }, (_, i) => "skill" + i),
    coverLetter: "L",
  };

  it("caps entries, bullets, skills, and summary length", () => {
    const d = clampToTwoPages(big);
    expect(d.experience.length).toBe(TWO_PAGE.maxEntries);
    expect(d.experience[0].bullets.length).toBe(TWO_PAGE.bulletsByIndex[0]);
    expect(d.experience[5].bullets.length).toBe(TWO_PAGE.bulletsByIndex[5]);
    expect(d.skills.length).toBe(TWO_PAGE.maxSkills);
    expect(d.summary.length).toBeLessThanOrEqual(TWO_PAGE.maxSummary + 1);
  });

  it("leaves a small doc unchanged", () => {
    const small: TailoredDoc = {
      ...big,
      summary: "short",
      experience: big.experience.slice(0, 2).map((e) => ({
        ...e,
        bullets: e.bullets.slice(0, 2),
      })),
      skills: ["a", "b"],
    };
    const d = clampToTwoPages(small);
    expect(d.experience.length).toBe(2);
    expect(d.skills.length).toBe(2);
    expect(d.summary).toBe("short");
  });

  it("renderResumeTex emits at most maxEntries entries", () => {
    const count = (renderResumeTex(big).match(/\\cventry/g) || []).length;
    expect(count).toBeLessThanOrEqual(TWO_PAGE.maxEntries);
  });

  it("caps every per-string field to its length (bullets, skills, summary, headers)", () => {
    const d = clampToTwoPages({
      name: "n".repeat(400),
      headline: "h".repeat(400),
      contact: "c".repeat(400),
      summary: "s".repeat(900),
      experience: [
        { role: "r".repeat(400), company: "o".repeat(400), dates: "d".repeat(400), bullets: ["q".repeat(900)] },
      ],
      skills: ["s".repeat(120)],
      coverLetter: "L",
    });
    expect(d.name.length).toBeLessThanOrEqual(TWO_PAGE.maxNameChars + 1);
    expect(d.headline.length).toBeLessThanOrEqual(TWO_PAGE.maxHeadlineChars + 1);
    expect(d.contact.length).toBeLessThanOrEqual(TWO_PAGE.maxContactChars + 1);
    expect(d.summary.length).toBeLessThanOrEqual(TWO_PAGE.maxSummary + 1);
    expect(d.experience[0].role.length).toBeLessThanOrEqual(TWO_PAGE.maxRoleChars + 1);
    expect(d.experience[0].company.length).toBeLessThanOrEqual(TWO_PAGE.maxCompanyChars + 1);
    expect(d.experience[0].dates.length).toBeLessThanOrEqual(TWO_PAGE.maxDatesChars + 1);
    expect(d.experience[0].bullets[0].length).toBeLessThanOrEqual(TWO_PAGE.maxBulletChars + 1);
    expect(d.skills[0].length).toBeLessThanOrEqual(TWO_PAGE.maxSkillChars + 1);
  });

  it("worst-case clamped doc (incl. long headers) stays within a two-page line budget", () => {
    const maxDoc: TailoredDoc = {
      name: "n".repeat(TWO_PAGE.maxNameChars),
      headline: "h".repeat(TWO_PAGE.maxHeadlineChars),
      contact: "c".repeat(TWO_PAGE.maxContactChars),
      summary: "x".repeat(TWO_PAGE.maxSummary),
      experience: TWO_PAGE.bulletsByIndex.map((n) => ({
        role: "r".repeat(TWO_PAGE.maxRoleChars),
        company: "o".repeat(TWO_PAGE.maxCompanyChars),
        dates: "d".repeat(TWO_PAGE.maxDatesChars),
        bullets: Array.from({ length: n }, () => "y".repeat(TWO_PAGE.maxBulletChars)),
      })),
      skills: Array.from({ length: TWO_PAGE.maxSkills }, () => "z".repeat(TWO_PAGE.maxSkillChars)),
      coverLetter: "L",
    };
    const d = clampToTwoPages(maxDoc);
    const CPL = 90; // experience content column
    const DATE_CPL = 18; // narrow moderncv dates column
    const lc = (s: string, cpl = CPL) => Math.max(1, Math.ceil((s?.length ?? 0) / cpl));
    // header block (name + headline + contact) + 3 section headers
    let lines = lc(d.name) + lc(d.headline) + lc(d.contact) + 3 * 2;
    lines += lc(d.summary);
    for (const e of d.experience) {
      // role+company on the right run parallel to the dates on the left
      lines += Math.max(lc(e.role) + lc(e.company), lc(e.dates, DATE_CPL));
      for (const b of e.bullets) lines += lc(b);
    }
    lines += lc(d.skills.join("  •  "));
    // moderncv banking @ scale 0.84 fits ~42 body lines/page → two pages ≈ 84.
    expect(lines).toBeLessThanOrEqual(84);
  });
});

describe("cover letter clamp", () => {
  it("bounds paragraph count and per-paragraph length", () => {
    const long = Array.from({ length: 12 }, (_, i) => `Para ${i} ` + "w".repeat(2000)).join("\n\n");
    const paras = coverParagraphs(long);
    expect(paras.length).toBeLessThanOrEqual(TWO_PAGE.maxCoverParas);
    for (const p of paras) {
      expect(p.length).toBeLessThanOrEqual(TWO_PAGE.maxCoverParaChars + 1);
    }
  });

  it("worst-case cover letter fits about one page", () => {
    const long = Array.from({ length: 12 }, (_, i) => `P${i} ` + "w".repeat(2000)).join("\n\n");
    const paras = coverParagraphs(long);
    const CPL = 85; // cover content column
    let lines = 4; // greeting + signature + spacing overhead
    for (const p of paras) lines += Math.max(1, Math.ceil(p.length / CPL)) + 1; // +1 para gap
    expect(lines).toBeLessThanOrEqual(45); // ~one A4 page in the cover styling
  });
});
