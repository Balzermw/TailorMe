import { expect } from "@playwright/test";
import type { ResumeFixture } from "./fixtures";
import { findSensitiveLeak } from "./redact";

const placeholderPattern = /\b(Lorem ipsum|\[Company]|\[Date]|TBD|undefined|null|NaN|TODO)\b/i;
const errorPlaceholderPattern = /\bError\b/;
const debugPattern = /```json|raw json|system prompt|assistant:|developer:|stack trace/i;
const actionablePattern =
  /\b(add|include|remove|rewrite|replace|quantif(?:y|ied)|metric|keyword|missing|tailor|lead with|move|clarify|specific|impact|evidence|bullet|ATS|recruiter|hiring manager)\b/gi;
const rewriteExamplePattern =
  /\b(before)\b.{0,900}\b(after)\b|\b(after)\b.{0,900}\b(before)\b|\breplace\b.{0,500}\bwith\b|\btry this\b.{0,500}\binstead\b/i;
const concreteFixPattern =
  /\b(lines? that still need a number|to add|what to add|example rewrite|before\b.{0,900}\bafter|replace\b.{0,500}\bwith|add (?:the )?(?:missing )?(?:scope|result|metric|number|volume|time|quality|revenue|cost|scale))\b/i;
const quantifiedImpactPattern = /\b(quantif(?:y|ied)|metric|%|\d+x|\d+\+|\$\d+|reduced|increased|improved|saved|grew|cut)\b/i;
const sectionSpecificPattern = /\b(summary|skills|experience|bullet|line|section|headline|role title|achievement)\b/i;
const roleAlignmentPattern = /\b(platform|engineer|node\.?js|kubernetes|aws|observability|reliability|distributed systems|job posting|target role)\b/i;
const targetKeywordPattern =
  /\b(platform|node\.?js|kubernetes|aws|observability|datadog|prometheus|ci\/cd|cicd|distributed systems|backend|reliability|mentoring|deployment standards?)\b/gi;
const gapPattern =
  /\b(gap|missing|misses|absent|weak|thin|lacks?|not found|0x|needs?|add|strengthen|could show|does not show|isn.t showing)\b/gi;
const groundingPattern =
  /\b(your resume|current resume|this resume|found|shows?|matched|ranked|line|bullet|keyword|score[ds]?|evidence|from the resume)\b/gi;
const metricGuidancePattern =
  /\b(scope|volume|speed|quality|revenue|cost|time|team|users?|tickets?|latency|sla|csat|retention|conversion|throughput|uptime|efficiency|before\/after|before and after)\b/gi;
const sectionMentionPattern =
  /\b(summary|skills|experience|bullet|line|section|headline|role title|achievement|keywords?|education)\b/gi;
const genericPhrasePattern =
  /\b(make (?:it|this) more specific|tailor your resume|add more keywords|improve your resume|strong candidate|great fit|stand out|show impact)\b/gi;
const QUALITY_SCORE_CAP = 95;

export function expectSyntheticResumeOutput(
  output: string,
  fixture: Pick<ResumeFixture, "expected">,
): void {
  expect(output.trim().length).toBeGreaterThan(80);
  expect(output).toContain(fixture.expected.candidateName);
  expect(hasPlaceholderText(output)).toBe(false);

  for (const role of fixture.expected.roleTitles.slice(0, 1)) {
    expect(output).toContain(role);
  }
  for (const employer of fixture.expected.employers.slice(0, 1)) {
    expect(output).toContain(employer);
  }
  for (const skill of fixture.expected.skills.slice(0, 2)) {
    expect(output.toLowerCase()).toContain(skill.toLowerCase());
  }
  if (fixture.expected.education) {
    expect(output).toContain(fixture.expected.education);
  }
}

export function expectNoGeneratedResumePlaceholders(output: string): void {
  expect(hasPlaceholderText(output)).toBe(false);
  expect(output).not.toMatch(/```json|raw json|system prompt/i);
}

export interface RealSuggestionQuality {
  score: number;
  issues: string[];
  agentCount: number;
  actionableMentions: number;
  charCount: number;
  sensitiveLeaks: string[];
  targetKeywordMentions: number;
  gapMentions: number;
  groundingMentions: number;
  metricGuidanceMentions: number;
  sectionMentions: number;
  rewritePairCount: number;
  concreteFixCount: number;
  genericPhraseCount: number;
  uniqueTokenRatio: number;
  maxSimilarityToPrior?: number;
}

export function evaluateRealSuggestionQuality(output: string): RealSuggestionQuality {
  const normalized = output.replace(/\s+/g, " ").trim();
  const issues: string[] = [];
  const agentCount = ["Ada", "Max", "Remy"].filter((name) =>
    new RegExp(`\\b${name}\\b`, "i").test(normalized),
  ).length;
  const actionableMentions = normalized.match(actionablePattern)?.length ?? 0;
  const sensitiveLeaks = findSensitiveLeak(normalized).filter((finding) => finding !== "resume_like_text");
  const hasRewriteExample = rewriteExamplePattern.test(normalized);
  const hasQuantifiedImpact = quantifiedImpactPattern.test(normalized);
  const hasSectionSpecificity = sectionSpecificPattern.test(normalized);
  const hasRoleAlignment = roleAlignmentPattern.test(normalized);
  const targetKeywordMentions = countMatches(normalized, targetKeywordPattern);
  const gapMentions = countMatches(normalized, gapPattern);
  const groundingMentions = countMatches(normalized, groundingPattern);
  const metricGuidanceMentions = countMatches(normalized, metricGuidancePattern);
  const sectionMentions = countMatches(normalized, sectionMentionPattern);
  const rewritePairCount = countRewritePairs(normalized);
  const concreteFixCount = countMatches(normalized, concreteFixPattern);
  const genericPhraseCount = countMatches(normalized, genericPhrasePattern);
  const uniqueTokenRatio = computeUniqueTokenRatio(normalized);

  if (normalized.length < 1_800) issues.push("too_short");
  if (agentCount < 3) issues.push("missing_agent_sections");
  if (actionableMentions < 18) issues.push("too_generic");
  if (!hasRewriteExample && concreteFixCount < 1) issues.push("missing_concrete_fix_example");
  if (!hasQuantifiedImpact) issues.push("missing_quantified_impact_guidance");
  if (!hasSectionSpecificity) issues.push("missing_section_specificity");
  if (!hasRoleAlignment) issues.push("missing_target_role_alignment");
  if (targetKeywordMentions < 4) issues.push("missing_target_keyword_specificity");
  if (gapMentions < 4) issues.push("missing_gap_specificity");
  if (groundingMentions < 8) issues.push("insufficient_resume_grounding");
  if (metricGuidanceMentions < 4) issues.push("thin_metric_guidance");
  if (sectionMentions < 5) issues.push("thin_section_coverage");
  if (rewritePairCount < 1 && concreteFixCount < 1) issues.push("missing_before_after_or_replace_example");
  if (genericPhraseCount >= 5 && targetKeywordMentions < 7) issues.push("boilerplate_heavy");
  if (uniqueTokenRatio < 0.24) issues.push("repetitive_or_low_information");
  const hasPlaceholder = hasPlaceholderText(normalized);
  if (hasPlaceholder) issues.push("placeholder_or_null_text");
  if (debugPattern.test(normalized)) issues.push("debug_or_prompt_leak");
  if (sensitiveLeaks.length) issues.push("possible_pii_in_review_text");
  if (!/keyword|ATS|recruiter|hiring manager|impact|bullet/i.test(normalized)) {
    issues.push("missing_resume_review_concepts");
  }

  const rawScore =
    14 +
    Math.min(agentCount, 3) * 6 +
    Math.min(actionableMentions, 24) * 0.8 +
    (normalized.length >= 1_800 ? 5 : 0) +
    (hasRewriteExample ? 8 : 0) +
    (hasQuantifiedImpact ? 8 : 0) +
    (hasSectionSpecificity ? 5 : 0) +
    (hasRoleAlignment ? 6 : 0) +
    Math.min(targetKeywordMentions, 8) * 1.6 +
    Math.min(gapMentions, 8) * 1.3 +
    Math.min(groundingMentions, 12) * 0.8 +
    Math.min(metricGuidanceMentions, 8) * 1.4 +
    Math.min(sectionMentions, 10) * 0.8 -
    Math.max(0, genericPhraseCount - 2) * 2 -
    Math.max(0, 0.32 - uniqueTokenRatio) * 40 -
    issues.length * 10 -
    sensitiveLeaks.length * 15 -
    (hasPlaceholder ? 20 : 0) -
    (debugPattern.test(normalized) ? 20 : 0);

  let score = Math.max(0, Math.min(QUALITY_SCORE_CAP, Math.round(rawScore)));
  if (sensitiveLeaks.length || hasPlaceholder || debugPattern.test(normalized)) {
    score = Math.min(score, 49);
  } else if (issues.length) {
    score = Math.min(score, 79);
  } else if (rewritePairCount < 1 && concreteFixCount > 0) {
    score = Math.min(score, 88);
  }

  return {
    score,
    issues,
    agentCount,
    actionableMentions,
    charCount: normalized.length,
    sensitiveLeaks,
    targetKeywordMentions,
    gapMentions,
    groundingMentions,
    metricGuidanceMentions,
    sectionMentions,
    rewritePairCount,
    concreteFixCount,
    genericPhraseCount,
    uniqueTokenRatio,
  };
}

function hasPlaceholderText(output: string): boolean {
  return placeholderPattern.test(output) || errorPlaceholderPattern.test(output);
}

function countMatches(value: string, pattern: RegExp): number {
  const flags = pattern.flags.includes("g") ? pattern.flags : `${pattern.flags}g`;
  const regex = new RegExp(pattern.source, flags);
  return value.match(regex)?.length ?? 0;
}

function countRewritePairs(value: string): number {
  const beforeCount = countMatches(value, /\bbefore\b/gi);
  const afterCount = countMatches(value, /\bafter\b/gi);
  const replaceWithCount = countMatches(value, /\breplace\b.{0,500}\bwith\b/gi);
  const tryInsteadCount = countMatches(value, /\btry this\b.{0,500}\binstead\b/gi);
  return Math.min(beforeCount, afterCount) + replaceWithCount + tryInsteadCount;
}

function computeUniqueTokenRatio(value: string): number {
  const tokens = value
    .toLowerCase()
    .replace(/[^a-z0-9.%$+-]+/g, " ")
    .split(/\s+/)
    .filter((token) => token.length >= 4);
  if (tokens.length === 0) return 0;
  return new Set(tokens).size / tokens.length;
}
