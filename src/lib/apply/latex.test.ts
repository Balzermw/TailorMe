import { describe, expect, it } from "vitest";
import { escapeLatex, renderCoverTex, renderResumeTex } from "./latex";
import { SAMPLE_DOC } from "./sample";

describe("latex generation", () => {
  it("escapes LaTeX-special characters", () => {
    expect(escapeLatex("R&D 50% $5 a_b #1 {x}")).toBe(
      "R\\&D 50\\% \\$5 a\\_b \\#1 \\{x\\}",
    );
    expect(escapeLatex("C:\\path")).toContain("\\textbackslash{}");
  });

  it("renders a compilable moderncv resume", () => {
    const tex = renderResumeTex(SAMPLE_DOC);
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

  it("renders a cover letter with opening and closing", () => {
    const tex = renderCoverTex(SAMPLE_DOC, "Nordpeak Systems");
    expect(tex).toContain("\\recipient{Nordpeak Systems}");
    expect(tex).toContain("\\opening{");
    expect(tex).toContain("\\makelettertitle");
    expect(tex).toContain("\\makeletterclosing");
  });
});
