// Deterministic resume feedback: render the structured doc to LaTeX, run the
// rules engine over it, and fold in any legacy (LLM) proof points — deduped,
// ranked, and capped. Pure of network/LLM calls, so it can run at import time
// (zero token cost) AND inside the feedback route (alongside the LLM parse).
// Shared so import and the editor produce the SAME suggestions for one doc.

import { renderResumeTex } from "@/lib/apply/latex";
import { evaluateResumeRules } from "@/lib/resume-rules/evaluateResumeRules";
import type { ResumeRuleFinding } from "@/lib/resume-rules/resumeAdviceRule.types";
import { parseContact } from "@/lib/apply/contact";
import { isPlaceholderName } from "@/lib/apply/placeholder-name";
import type { ProofPoint, TailoredDoc } from "@/lib/types";

// Bump when the rules/routing change so stale cached feedback is recomputed.
export const FEEDBACK_CACHE_VERSION = "rules-v4-header-required-fields";

// Safe, content-free funnel counts for telemetry (rules → candidates →
// deduped → surfaced). NEVER includes résumé text or evidence snippets.
export interface FeedbackStats {
  rulesLoaded: number;
  candidates: number;
  deduped: number;
  surfaced: number;
  suppressed: number;
}

// Map a surfaced rules-engine finding back to the editor's ProofPoint shape.
function findingToProofPoint(f: ResumeRuleFinding): ProofPoint {
  return {
    title: f.title,
    summary: f.message,
    quote: f.evidenceSnippet || undefined,
    why: f.whyItMatters,
    fix: f.suggestedFix,
    severity: f.uiSeverityLabel.toLowerCase() as ProofPoint["severity"],
    // Carry rule provenance so the editor can emit per-suggestion telemetry
    // (which rules users act on). Safe ids/categories only — never content.
    ruleId: f.ruleId,
    category: f.category,
    targetSection: f.targetSection,
  };
}

// LLM findings sometimes assert a fabricated count ("Quantify 28 bullets", "Trim
// 4 low-relevance bullets") that rarely matches the actual doc. Strip such counts
// from legacy (no-ruleId) titles so we never surface a hallucinated number. The
// lookbehind leaves real thresholds intact ("exceed 2 lines", "up to 3 items").
function stripUnverifiableCounts(p: ProofPoint): ProofPoint {
  if (p.ruleId) return p; // rules-engine counts are computed, not guessed
  const title = p.title
    .replace(
      /(?<!\b(?:than|over|under|exceeds?|least|most|up to|within|to)\s)\b\d+\s+(?=(?:[a-z-]+\s+){0,2}(?:bullets?|lines?|items?|points?)\b)/gi,
      "",
    )
    .replace(/\s{2,}/g, " ")
    .trim();
  return title === p.title ? p : { ...p, title };
}

function normalizedQuote(value: string | undefined): string {
  return (value ?? "")
    .toLowerCase()
    .replace(/^[\s•*\-–—]+/, "")
    .replace(/\s+/g, " ")
    .trim();
}

function quoteMatchesEditableBullet(doc: TailoredDoc, quote: string | undefined): boolean {
  const q = normalizedQuote(quote);
  if (q.length < 8) return false;
  const bullets = [
    ...doc.experience.flatMap((entry) => entry.bullets),
    ...(doc.projects ?? []).flatMap((project) => [project.description]),
  ];
  return bullets.some((bullet) => {
    const text = normalizedQuote(bullet);
    return text.includes(q) || q.includes(text);
  });
}

function filterContradictedProofPoints(doc: TailoredDoc, proofPoints: ProofPoint[]): ProofPoint[] {
  const hasSkills =
    (doc.skills ?? []).some((skill) => skill.trim()) ||
    (doc.skillGroups ?? []).some((group) => group.skills.some((skill) => skill.trim()));
  const experience = doc.experience ?? [];
  const allExperienceHasDates =
    experience.length > 0 && experience.every((entry) => entry.dates.trim().length > 0);

  return proofPoints.filter((point) => {
    if (point.ruleId === "skills_first_prominent" && hasSkills) return false;
    if (
      point.ruleId === "bullet_length_1_to_2_lines" &&
      !quoteMatchesEditableBullet(doc, point.quote)
    ) {
      return false;
    }
    if (point.ruleId === "include_start_end_dates_on_all_roles" && allExperienceHasDates) {
      return false;
    }
    // "Add 'Phone:'/'Email:' labels before each contact item" is a persistent LLM
    // myth — modern resumes and ATS parse an unlabeled contact line fine, and the
    // labels only clutter the header. Drop it (legacy LLM finding, no ruleId; our
    // real contact-gap checks below use ruleIds, so they're untouched).
    if (!point.ruleId) {
      const blob = `${point.title} ${point.summary} ${point.fix}`.toLowerCase();
      if (/\blabels?\b/.test(blob) && (/\bcontact\b/.test(blob) || /(?:phone|email)\s*:/.test(blob))) {
        return false;
      }
    }
    return true;
  });
}

const MISSING_FIELD_RE =
  /^(?:n\/a|none|unknown|tbd|to be determined|not (?:provided|specified|listed|available|disclosed|given|set|found))$/i;
const HEADLINE_PLACEHOLDER_RE =
  /^(?:headline|resume headline|title|job title|current title|role title|target role|professional title|your title|your headline|position title)$/i;

function isMissingField(value: string | undefined): boolean {
  const clean = (value ?? "").replace(/\s+/g, " ").trim();
  return !clean || MISSING_FIELD_RE.test(clean);
}

// A resume with missing header essentials is hard for a recruiter or ATS to act
// on. These are doc-derived checks, not style myths: name, title/headline,
// location, phone, and email are all values the candidate must provide. We read
// the doc's OWN contact line (parseContact is the single source of truth; the
// LaTeX round-trip is lossy) and surface each gap as a Header finding. Skipped
// when the legacy LLM already raised the same gap, so we never double-surface it.
function headerGapProofPoints(doc: TailoredDoc, existing: ProofPoint[]): ProofPoint[] {
  const contact = parseContact(doc.contact || "");
  const alreadyRaised = (re: RegExp, ignoreRuleIds: string[] = []) =>
    existing.some(
      (p) =>
        !ignoreRuleIds.includes(p.ruleId ?? "") &&
        re.test(`${p.title} ${p.summary} ${p.fix}`),
    );
  const gaps: ProofPoint[] = [];
  if (
    (isMissingField(doc.name) || isPlaceholderName(doc.name)) &&
    !alreadyRaised(/\bname\b/i, ["clear_full_name_in_header"])
  ) {
    gaps.push({
      title: "Add your full name",
      summary:
        "Your header is missing a real full name. Recruiters and ATS records need a clear candidate name at the top of the resume.",
      why: "A resume without a clear name can be misfiled, hard to search, or ignored during recruiter handoff.",
      fix: "Add your first and last name to the header.",
      severity: "high",
      ruleId: "header_missing_name",
      category: "header",
      targetSection: "header",
    });
  }
  if (
    (isMissingField(doc.headline) || HEADLINE_PLACEHOLDER_RE.test(doc.headline.trim())) &&
    !alreadyRaised(
      /\b(?:headline|job title|role title|current title|target role|professional title)\b/i,
      ["explicit_current_role_title"],
    )
  ) {
    gaps.push({
      title: "Add a resume title",
      summary:
        "Your header is missing a role title or headline. A clear title tells recruiters what kind of role you are positioned for.",
      why: "The headline is the fastest signal of level and function when a recruiter scans the resume.",
      fix: "Add a concise title under your name, such as your current role or target role.",
      severity: "medium",
      ruleId: "header_missing_title",
      category: "header",
      targetSection: "header",
    });
  }
  if (!contact.location && !alreadyRaised(/\b(?:location|city|city\/state|geograph|region)\b/i)) {
    gaps.push({
      title: "Add your location",
      summary:
        "Your header has no city or location. Recruiters use location to judge commute, remote eligibility, and region-specific roles.",
      why: "A location helps employers quickly understand whether the role's geography works for you.",
      fix: "Add your city and state, region, or country to the header line.",
      severity: "medium",
      ruleId: "header_missing_location",
      category: "header",
      targetSection: "header",
    });
  }
  if (!contact.email && !alreadyRaised(/\bemail\b/i)) {
    gaps.push({
      title: "Add an email address",
      summary:
        "Your header has no email. It is the primary way recruiters reply and the field most ATS forms require, so a resume without one can stall.",
      why: "Email is the default reply channel for recruiters and is required by most online applications.",
      fix: "Add a professional email to the header line (Phone | Email | LinkedIn | City, ST).",
      severity: "high",
      ruleId: "header_missing_email",
      category: "header",
      targetSection: "header",
    });
  }
  if (!contact.phone && !alreadyRaised(/\bphone\b/i)) {
    gaps.push({
      title: "Add a phone number",
      summary:
        "Your header has no phone number. Many recruiters call or text first, and some ATS forms expect one.",
      why: "A direct line is often the fastest way a recruiter follows up on a strong resume.",
      fix: "Add a phone number to the header line (Phone | Email | LinkedIn | City, ST).",
      severity: "medium",
      ruleId: "header_missing_phone",
      category: "header",
      targetSection: "header",
    });
  }
  return gaps;
}

function dropHeaderFindingsCoveredBySpecificGaps(
  points: ProofPoint[],
  headerGaps: ProofPoint[],
): ProofPoint[] {
  const gapIds = new Set(headerGaps.map((p) => p.ruleId));
  return points.filter((p) => {
    if (gapIds.has("header_missing_name") && p.ruleId === "clear_full_name_in_header") {
      return false;
    }
    if (gapIds.has("header_missing_title") && p.ruleId === "explicit_current_role_title") {
      return false;
    }
    return true;
  });
}

// A role with zero or one real bullet reads as filler and wastes prime résumé
// space. We suggest CREATING bullets (not revising) for thin entries. Counted
// straight from the structured doc (entry.bullets) so the number is computed,
// never fabricated. Surfaced ahead of style nits, like the contact-gap checks.
function sparseExperienceProofPoints(doc: TailoredDoc): ProofPoint[] {
  const isRealBullet = (b: string) => b.trim().length >= 8;
  const sparse = (doc.experience ?? []).filter(
    (entry) => entry.bullets.filter(isRealBullet).length < 2,
  );
  if (!sparse.length) return [];
  const first = sparse[0];
  const label = [first.role, first.company].filter((s) => s && s.trim()).join(" at ") || "a role";
  const others = sparse.length - 1;
  const summary =
    `The ${label} entry has fewer than two accomplishment bullets` +
    (others > 0
      ? ` (and ${others} other role${others > 1 ? "s are" : " is"} thin too).`
      : ".") +
    // NB: avoid words like "space"/"spacing"/"format" here — they trip the
    // template-owned suppression in groundFindings and the finding would vanish.
    " A role with one or no bullets reads as filler and undersells your impact.";
  return [
    {
      title: "Add bullets to a thin role",
      summary,
      why: "Recruiters spend the most time on recent roles. A role with no accomplishments signals little impact and weakens the whole section.",
      fix: "Add 2 to 4 accomplishment bullets for this role. Start each with a strong verb and a concrete result or scope (what you did and what changed).",
      quote: undefined,
      severity: "high",
      ruleId: "experience_sparse_bullets",
      category: "experience",
      targetSection: "experience",
    },
  ];
}

// Education entries that exist but are missing their dates: an undated degree
// leaves a gap in the career timeline and some ATS forms expect a year. We never
// flag a MISSING education section (omitting it is a legitimate choice) — only an
// incomplete entry, computed from the doc. No targetSection set: fixSection routes
// "education" text to the Education section. Skipped if already raised.
function educationGapProofPoints(doc: TailoredDoc, existing: ProofPoint[]): ProofPoint[] {
  const edu = doc.education ?? [];
  if (!edu.length) return [];
  const alreadyRaised = existing.some((p) =>
    /education|degree|graduat/i.test(`${p.title} ${p.summary} ${p.fix}`),
  );
  if (alreadyRaised) return [];
  const undated = edu.filter((e) => (e.degree.trim() || e.school.trim()) && !e.dates.trim());
  if (!undated.length) return [];
  const first = undated[0];
  const label = [first.degree, first.school].filter((s) => s && s.trim()).join(", ") || "your education";
  return [
    {
      title: "Add dates to your education",
      summary: `${label} has no dates. Graduation timing helps a recruiter place your career, and an undated degree reads as incomplete.`,
      why: "A degree without a year makes your timeline harder to follow, and some ATS forms expect a graduation date.",
      fix: "Add the start and end (or graduation) year to each education entry.",
      quote: undefined,
      severity: "low",
      ruleId: "education_missing_dates",
      category: "education",
    },
  ];
}

// Certification entries missing their issuer or date: a credential is more
// credible (and verifiable) with its source and year. Computed from the doc; we
// never invent certifications. "certification" text routes to the Certifications
// section via fixSection. Skipped if already raised.
function certificationGapProofPoints(doc: TailoredDoc, existing: ProofPoint[]): ProofPoint[] {
  const certs = doc.certifications ?? [];
  if (!certs.length) return [];
  const alreadyRaised = existing.some((p) =>
    /certif|credential|license/i.test(`${p.title} ${p.summary} ${p.fix}`),
  );
  if (alreadyRaised) return [];
  const incomplete = certs.filter((c) => c.name.trim() && (!c.issuer.trim() || !c.date.trim()));
  if (!incomplete.length) return [];
  const first = incomplete[0];
  return [
    {
      title: "Complete your certification details",
      summary: `"${first.name.trim()}" is missing its issuer or date. A certification reads as more credible with its source and the year earned.`,
      why: "An issuing organization and a date let a recruiter confirm a certification at a glance.",
      fix: "Add the issuer and the year earned to each certification.",
      quote: undefined,
      severity: "low",
      ruleId: "certifications_incomplete",
      category: "certifications",
    },
  ];
}

// Fold the LLM proof points + deterministic rule findings into one deduped,
// ranked, capped set. Falls back to the raw proof points if the doc can't be
// rendered to LaTeX (the engine's detectors read LaTeX structure).
export function refineFeedback(
  doc: TailoredDoc,
  proofPoints: ProofPoint[],
): { proofPoints: ProofPoint[]; stats: FeedbackStats | null } {
  try {
    const latexSource = renderResumeTex(doc);
    const result = evaluateResumeRules({
      latexSource,
      legacyProofPoints: proofPoints,
      tier: "paid", // the editor is an engaged workspace → allow up to 10
      templated: true, // base resume renders in our template (it owns layout/ATS)
    });
    const rawProofPoints = result.surfaced.map(findingToProofPoint).map(stripUnverifiableCounts);
    const filteredProofPoints = filterContradictedProofPoints(doc, rawProofPoints);
    const contradictionSuppressed = rawProofPoints.length - filteredProofPoints.length;
    // Real content gaps lead the list: missing header fields, then thin roles
    // that need bullets written. Both are computed from the doc, ahead of style
    // nits.
    const headerGaps = headerGapProofPoints(doc, filteredProofPoints);
    const displayProofPoints = dropHeaderFindingsCoveredBySpecificGaps(filteredProofPoints, headerGaps);
    const headerDuplicateSuppressed = filteredProofPoints.length - displayProofPoints.length;
    const sparseGaps = sparseExperienceProofPoints(doc);
    const eduGaps = educationGapProofPoints(doc, displayProofPoints);
    const certGaps = certificationGapProofPoints(doc, displayProofPoints);
    return {
      proofPoints: [...headerGaps, ...sparseGaps, ...eduGaps, ...certGaps, ...displayProofPoints],
      stats: {
        rulesLoaded: result.stats.rulesLoaded,
        candidates: result.stats.candidateFindingsCount,
        deduped: result.stats.dedupedFindingsCount,
        surfaced:
          displayProofPoints.length +
          headerGaps.length +
          sparseGaps.length +
          eduGaps.length +
          certGaps.length,
        suppressed: result.stats.suppressedCount + contradictionSuppressed + headerDuplicateSuppressed,
      },
    };
  } catch {
    // LaTeX render failed; still surface the deterministic doc-based checks.
    return {
      proofPoints: [
        ...headerGapProofPoints(doc, proofPoints),
        ...sparseExperienceProofPoints(doc),
        ...educationGapProofPoints(doc, proofPoints),
        ...certificationGapProofPoints(doc, proofPoints),
        ...proofPoints,
      ],
      stats: null,
    };
  }
}
