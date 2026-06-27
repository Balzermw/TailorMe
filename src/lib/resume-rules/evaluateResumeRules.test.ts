import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import type { ProofPoint } from "@/lib/types";
import { evaluateResumeRules } from "./evaluateResumeRules";
import { resumeFeedbackConfig } from "./resumeFeedbackConfig";

const weakResume = readFileSync(
  fileURLToPath(new URL("./__fixtures__/weak-resume.tex", import.meta.url)),
  "utf-8",
);

// Representative legacy LLM output that OVERLAPS the deterministic detectors
// (same problems, different wording) — this is what must NOT double-surface.
const legacyProofPoints: ProofPoint[] = [
  {
    title: "Bullets describe tasks, not measurable impact",
    summary: "Several bullets list responsibilities without a metric or outcome.",
    quote: "Responsible for developing and maintaining features",
    why: "Recruiters and ATS reward quantified impact.",
    fix: "Rewrite with a supportable metric.",
    severity: "high",
  },
  {
    title: "No dedicated skills section",
    summary: "Skills are not called out in a scannable section.",
    why: "ATS and recruiters scan for a skills block.",
    fix: "Add a Skills section grouped by category.",
    severity: "high",
  },
];

describe("evaluateResumeRules (deterministic, weak résumé)", () => {
  it("flags the obvious problems deterministically (no LLM)", () => {
    const r = evaluateResumeRules({ latexSource: weakResume });
    const issues = new Set(r.candidates.map((f) => f.canonicalIssueId));
    // The weak fixture should trip these detectors:
    expect(issues.has("has_dedicated_skills_section")).toBe(true);
    expect(issues.has("quantify_impact_metrics")).toBe(true);
    expect(issues.has("accomplishments_not_responsibilities")).toBe(true);
    expect(issues.has("avoid_first_person_pronouns")).toBe(true);
    expect(issues.has("omit_references_section")).toBe(true);
    expect(issues.has("qualifications_summary_over_traditional_objective")).toBe(true);
    expect(r.stats.rulesLoaded).toBe(79);
  });

  it("surfaces a focused, capped set — not every finding", () => {
    const r = evaluateResumeRules({ latexSource: weakResume, tier: "free" });
    expect(r.stats.surfacedSuggestionsCount).toBeLessThanOrEqual(
      resumeFeedbackConfig.maxSuggestionsFree,
    );
    expect(r.stats.surfacedSuggestionsCount).toBeLessThan(r.stats.candidateFindingsCount);
    // never more than maxPerCategory from one category
    const perCat: Record<string, number> = {};
    for (const f of r.surfaced) perCat[f.category] = (perCat[f.category] ?? 0) + 1;
    for (const n of Object.values(perCat)) {
      expect(n).toBeLessThanOrEqual(resumeFeedbackConfig.maxPerCategory);
    }
  });

  it("paid tier surfaces more than free", () => {
    const free = evaluateResumeRules({ latexSource: weakResume, tier: "free" });
    const paid = evaluateResumeRules({ latexSource: weakResume, tier: "paid" });
    expect(paid.stats.surfacedSuggestionsCount).toBeGreaterThanOrEqual(
      free.stats.surfacedSuggestionsCount,
    );
  });

  it("dedupes legacy LLM findings against the deterministic ones (no double-surface)", () => {
    const withLegacy = evaluateResumeRules({ latexSource: weakResume, legacyProofPoints });

    // candidates include both the deterministic + legacy versions of metrics/skills
    const metricCandidates = withLegacy.candidates.filter(
      (f) => f.canonicalIssueId === "quantify_impact_metrics",
    );
    expect(metricCandidates.length).toBeGreaterThanOrEqual(2); // deterministic + legacy

    // ...but after dedupe, only ONE survives per issue+section
    const metricKept = withLegacy.deduped.filter(
      (f) => f.canonicalIssueId === "quantify_impact_metrics",
    );
    expect(metricKept.length).toBe(1);
    // and the survivor is credited to BOTH sources
    expect(metricKept[0].sourceRuleIds.length).toBeGreaterThanOrEqual(2);

    const skillsKept = withLegacy.deduped.filter(
      (f) => f.canonicalIssueId === "has_dedicated_skills_section",
    );
    expect(skillsKept.length).toBe(1);
  });

  it("does not route a skill typo to the candidate-name rule", () => {
    const strong = String.raw`
\name{Michael Balzer} \\ Advisory Solutions Consultant
\section{Summary}
Technical sales engineer with 5 years of experience across enterprise software.
\section{Experience}
\textbf{ServiceNow} 2021 -- Present
\begin{itemize}
  \item Increased qualified pipeline 32\% by improving advisory discovery across 18 enterprise accounts.
\end{itemize}
\section{Skills}
Networking, REST APIs, Integration, Azure, SolarWinds, Logic Monitor, Automation Anywhe
`;
    const skillTypo: ProofPoint = {
      title: "Skills list entry 'Automation Anywhe' appears incomplete or misspelled",
      summary: "Skills list entry 'Automation Anywhe' appears incomplete or misspelled.",
      quote: "Networking, REST APIs, Integration, Azure, SolarWinds, Logic Monitor, Automation Anywhe",
      why: "Misspelled tool names look unpolished.",
      fix: "Correct to full proper name, e.g. 'Automation Anywhere'.",
      severity: "high",
    };

    const r = evaluateResumeRules({
      latexSource: strong,
      legacyProofPoints: [skillTypo],
      templated: true,
      tier: "paid",
    });
    const finding = r.candidates.find((f) => f.title === skillTypo.title);

    expect(finding).toBeTruthy();
    expect(finding?.canonicalIssueId).not.toBe("clear_full_name_in_header");
    expect(finding?.targetSection).toBe("skills");
    expect(finding?.fixActionLabel).toBe("Edit Skills");
  });

  it("quotes the actual long bullet instead of summary text", () => {
    const longSummary =
      "Summary profile paragraph that is intentionally verbose so it mimics templates that serialize summary text as item-like content, but it should never be cited as a bullet-length issue.";
    const longBullet =
      "Coordinated advisory workshops across financial services accounts, partnered with platform teams and executives to document business outcomes, translate risk and compliance needs into demos, align champions, prepare follow-up materials, and move complex opportunities forward without a clear measurable result";
    const resume = String.raw`
\name{Michael Balzer} \\ Advisory Solutions Consultant
\section{Summary}
\resumeItem{${longSummary}}
\section{Experience}
\begin{itemize}
  \item Increased qualified pipeline 32\% by improving advisory discovery across 18 enterprise accounts.
  \item ${longBullet}
\end{itemize}
\section{Skills}
ServiceNow, Discovery, Advisory Workshops
`;

    const r = evaluateResumeRules({ latexSource: resume, templated: true, tier: "paid" });
    const finding = r.candidates.find(
      (f) => f.canonicalIssueId === "bullet_length_1_to_2_lines",
    );

    expect(finding).toBeTruthy();
    expect(finding?.evidenceSnippet).toContain("Coordinated advisory workshops");
    expect(finding?.evidenceSnippet).not.toContain("Summary profile paragraph");
    expect(finding?.message).toContain("quoted example");
    expect(finding?.targetSection).toBe("experience");
  });

  it("does not raise bullet-length feedback for a long summary alone", () => {
    const longSummary =
      "Summary profile paragraph that is intentionally verbose and long enough to look like a scanned paragraph in the LaTeX parser while still belonging to the summary section rather than to experience bullets.";
    const resume = String.raw`
\name{Michael Balzer} \\ Advisory Solutions Consultant
\section{Summary}
\resumeItem{${longSummary}}
\section{Experience}
\begin{itemize}
  \item Increased qualified pipeline 32\% by improving advisory discovery across 18 enterprise accounts.
\end{itemize}
\section{Skills}
ServiceNow, Discovery, Advisory Workshops
`;

    const r = evaluateResumeRules({ latexSource: resume, templated: true, tier: "paid" });

    expect(
      r.candidates.some((f) => f.canonicalIssueId === "bullet_length_1_to_2_lines"),
    ).toBe(false);
  });

  it("does not map generic long-summary feedback to bullet length", () => {
    const resume = String.raw`
\name{Michael Balzer} \\ Advisory Solutions Consultant
\section{Summary}
Technical sales engineer focused on advisory selling and enterprise transformation.
\section{Experience}
\begin{itemize}
  \item Increased qualified pipeline 32\% by improving advisory discovery across 18 enterprise accounts.
\end{itemize}
\section{Skills}
ServiceNow, Discovery, Advisory Workshops
`;
    const legacy: ProofPoint = {
      title: "Summary is too long",
      summary: "The summary is too long and hard to scan.",
      quote: "Technical sales engineer focused on advisory selling and enterprise transformation.",
      why: "The top section needs to be fast to read.",
      fix: "Shorten the summary.",
      severity: "medium",
    };

    const r = evaluateResumeRules({
      latexSource: resume,
      legacyProofPoints: [legacy],
      templated: true,
      tier: "paid",
    });

    expect(
      r.candidates.some(
        (f) =>
          f.canonicalIssueId === "bullet_length_1_to_2_lines" &&
          f.evidenceSnippet === legacy.quote,
      ),
    ).toBe(false);
  });

  it("emits a valid Grok-shaped UI payload with HIGH PRIORITY first", () => {
    const r = evaluateResumeRules({ latexSource: weakResume, tier: "paid" });
    expect(r.ui.version).toBe("1.0");
    expect(r.ui.resume_format).toBe("latex");
    // group counts reflect only surfaced items
    const total = r.ui.groups.reduce((n, g) => n + g.count, 0);
    expect(total).toBe(r.surfaced.length);
    for (const g of r.ui.groups) expect(g.count).toBe(g.items.length);
    if (r.ui.groups.length > 1) expect(r.ui.groups[0].label).toBe("HIGH PRIORITY");
  });

  it("templated mode suppresses layout/ATS findings the template owns", () => {
    const multiCol = weakResume.replace(
      "\\begin{itemize}",
      "\\begin{tabular}{ll}\\begin{itemize}",
    );
    const normal = evaluateResumeRules({ latexSource: multiCol });
    const templated = evaluateResumeRules({ latexSource: multiCol, templated: true });
    expect(normal.candidates.some((f) => f.canonicalIssueId === "ats_clean_single_column")).toBe(true);
    expect(templated.candidates.some((f) => f.category === "formatting")).toBe(false);
    // content findings (metrics, skills) still come through
    expect(templated.candidates.some((f) => f.canonicalIssueId === "quantify_impact_metrics")).toBe(true);
  });

  it("a strong résumé produces few/no findings", () => {
    const strong = String.raw`
\name{Dana Lee} \\ Senior Software Engineer
\section{Summary}
Senior engineer focused on platform reliability and developer tooling.
\section{Skills}
Go, Kubernetes, PostgreSQL, Terraform, gRPC
\section{Experience}
\textbf{Acme} 2021 -- Present
\begin{itemize}
  \item Cut p99 API latency 38\% by introducing a read-through cache across 12 services.
  \item Reduced deploy time from 40 min to 6 min, enabling 5x more releases per week.
\end{itemize}
`;
    const r = evaluateResumeRules({ latexSource: strong });
    expect(r.stats.surfacedSuggestionsCount).toBeLessThan(3);
  });
});
