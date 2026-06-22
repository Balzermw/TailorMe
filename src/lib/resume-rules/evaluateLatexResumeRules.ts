// Deterministic + heuristic detectors over a parsed LaTeX résumé. ZERO LLM
// calls — pure structural/regex checks. Each detector is keyed to a real Grok
// rule_id; it only emits a finding if that rule is in the loaded catalog and
// enabled, so the catalog stays the single source of truth for copy/severity.
//
// We never invent metrics in rewrites — quantification findings ask the user to
// "add a supportable metric", echoing the rule's own example.

import type { ResumeAdviceRule, ResumeRuleFinding } from "./resumeAdviceRule.types";
import { extractLatexResumeSections, type ParsedLatexResume } from "./extractLatexResumeSections";
import { makeFinding } from "./makeFinding";

// Weak openers that signal duty-listing instead of accomplishment.
const WEAK_OPENERS = /^(responsible for|worked on|helped|assisted|tasked with|duties included|participated in)\b/i;
const FIRST_PERSON = /\b(i|my|me|myself)\b/i;
const METRIC = /(\d|%|\$|\bpercent\b|million|billion|thousand|\bk\b)/i;
const BUZZWORDS =
  /\b(synergy|team player|hard worker|go-getter|detail-oriented|results-driven|self-starter|think outside the box|hit the ground running|fast learner)\b/i;

export interface EvaluateOptions {
  /** Optional JD text for keyword-overlap heuristics (no LLM). */
  jobText?: string;
}

type Detector = (
  resume: ParsedLatexResume,
  rule: ResumeAdviceRule,
  opts: EvaluateOptions,
) => ResumeRuleFinding[];

// Detectors keyed by canonicalIssueId (= Grok rule_id). Only those whose rule
// exists in the catalog run. Each returns 0+ findings.
const DETECTORS: Record<string, Detector> = {
  has_dedicated_skills_section(resume, rule) {
    return resume.has("skills") ? [] : [makeFinding(rule, { section: "skills" })];
  },

  skills_first_prominent(resume, rule) {
    // Skills exist but are buried at the bottom → less scannable / weaker ATS.
    const idx = resume.sections.findIndex((s) => s.normalized === "skills");
    if (idx < 0 || idx <= Math.floor(resume.sections.length / 2)) return [];
    return [makeFinding(rule, { section: "skills" })];
  },

  quantify_impact_metrics(resume, rule) {
    const exp = resume.bullets.filter((b) => b.section === "experience");
    if (!exp.length) return [];
    const unquantified = exp.filter((b) => !METRIC.test(b.text));
    // Only flag when the majority lack metrics (avoids nagging a strong résumé).
    if (unquantified.length < Math.ceil(exp.length * 0.5)) return [];
    return [
      makeFinding(rule, {
        section: "experience",
        evidence: unquantified[0].text.slice(0, 160),
        occurrences: unquantified.length,
        message:
          `${unquantified.length} of ${exp.length} experience bullets describe the task but not the measurable result. ` +
          "Add a supportable metric (volume, %, $, time saved, team size, frequency) where it's truthful.",
        // Never ship a fabricated number as "your rewrite" — we don't know the
        // user's real figures. The message above is the guidance.
        suggestedRewrite: "",
      }),
    ];
  },

  accomplishments_not_responsibilities(resume, rule) {
    const weak = resume.bullets.filter((b) => WEAK_OPENERS.test(b.text));
    if (!weak.length) return [];
    return [
      makeFinding(rule, {
        section: "experience",
        evidence: weak[0].text.slice(0, 160),
        occurrences: weak.length,
        message:
          `${weak.length} bullet(s) open with duty-listing phrasing ("responsible for", "worked on"). ` +
          "Lead with a strong action verb and the outcome instead.",
      }),
    ];
  },

  avoid_first_person_pronouns(resume, rule) {
    const fp = resume.bullets.filter((b) => FIRST_PERSON.test(b.text));
    if (!fp.length) return [];
    return [
      makeFinding(rule, {
        section: "experience",
        evidence: fp[0].text.slice(0, 160),
        occurrences: fp.length,
      }),
    ];
  },

  include_start_end_dates_on_all_roles(resume, rule) {
    const exp = resume.sections.find((s) => s.normalized === "experience");
    if (!exp) return [];
    // Heuristic: a year range like "2021 – 2023" / "2021-Present" per role.
    const hasDates = /(19|20)\d{2}\s*[-–—to]+\s*((19|20)\d{2}|present|current)/i.test(exp.body);
    return hasDates ? [] : [makeFinding(rule, { section: "experience" })];
  },

  clear_full_name_in_header(resume, rule) {
    // Header should carry a name (\name{...} or a bold/large line of text).
    const hasName =
      /\\name\{[^}]+\}/.test(resume.header) || /[A-Z][a-z]+\s+[A-Z][a-z]+/.test(resume.headerText);
    return hasName ? [] : [makeFinding(rule, { section: "header" })];
  },

  explicit_current_role_title(resume, rule) {
    // A target/current title near the name helps the 7-second scan + ATS.
    const hasTitle = resume.headerText.length > 0 && /\b(engineer|manager|developer|designer|analyst|director|lead|consultant|specialist|scientist|architect|coordinator|administrator)\b/i.test(
      resume.headerText,
    );
    return hasTitle ? [] : [makeFinding(rule, { section: "header" })];
  },

  qualifications_summary_over_traditional_objective(resume, rule) {
    // Flag an "Objective" heading (dated) — or no summary at all.
    const hasObjective = resume.sections.some((s) => /objective/i.test(s.name));
    if (hasObjective) return [makeFinding(rule, { section: "summary" })];
    return [];
  },

  omit_references_section(resume, rule) {
    return resume.has("references") ? [makeFinding(rule, { section: "formatting" })] : [];
  },

  kill_buzzwords_proof(resume, rule) {
    const hit = resume.bullets.find((b) => BUZZWORDS.test(b.text)) ||
      (BUZZWORDS.test(resume.headerText) ? { text: resume.headerText, section: "header", raw: "" } : undefined);
    if (!hit) return [];
    return [makeFinding(rule, { section: "experience", evidence: hit.text.slice(0, 160) })];
  },

  bullet_length_1_to_2_lines(resume, rule) {
    // ~> 2 lines ≈ 200 chars. Flag if several bullets run long.
    const long = resume.bullets.filter((b) => b.text.length > 200);
    if (long.length < 2) return [];
    return [
      makeFinding(rule, {
        section: "experience",
        evidence: long[0].text.slice(0, 160),
        occurrences: long.length,
      }),
    ];
  },

  ats_clean_single_column(resume, rule) {
    // Multi-column layouts (tabular/multicol/minipage) hurt ATS parsing.
    const multiCol = /\\begin\{(multicols|tabular|minipage)\}/.test(resume.source);
    return multiCol ? [makeFinding(rule, { section: "formatting" })] : [];
  },
};

/**
 * Run all deterministic/heuristic detectors whose rule is present + enabled.
 * Returns internal candidate findings (NOT customer-facing yet).
 */
export function evaluateLatexResumeRules(
  source: string,
  rules: ResumeAdviceRule[],
  opts: EvaluateOptions = {},
): ResumeRuleFinding[] {
  const resume = extractLatexResumeSections(source);
  const byId = new Map(rules.map((r) => [r.canonicalIssueId, r]));
  const findings: ResumeRuleFinding[] = [];

  for (const [issueId, detect] of Object.entries(DETECTORS)) {
    const rule = byId.get(issueId);
    if (!rule || !rule.enabled) continue;
    try {
      findings.push(...detect(resume, rule, opts));
    } catch {
      // A single detector throwing must never break the whole evaluation.
    }
  }
  return findings;
}

/** Which rule ids currently have a deterministic detector (for Rule Lab stats). */
export function deterministicRuleIds(): string[] {
  return Object.keys(DETECTORS);
}
