import "server-only";
import { structured, type Provider, type Step } from "@/lib/apply/llm";
import { stripLogoArtifact } from "@/lib/text-clean";
import {
  TAILOR_MODEL,
  TAILOR_PROVIDER,
  tailorProviderConfigured,
} from "@/lib/config";
import { CLICHES, principlesClause } from "@/lib/apply/doctrine";
import { withTemplateRules } from "@/lib/apply/template";
import { sanitizeDoc } from "@/lib/apply/sanitize-doc";
import { docToResumeText } from "@/lib/apply/serialize";
import type {
  AgentNote,
  ApplyResult,
  AuditAgent,
  BulletDiff,
  FitBreakdown,
  ResumeStats,
  RoleContext,
  TailorDiagnostics,
  TailoredBullet,
  TailoredDoc,
  VerificationCorrection,
  VerificationReport,
} from "@/lib/types";

// Generic structured call → routes to the configured (or overridden) provider.
async function callTool<T>(
  step: Step,
  system: string,
  user: string,
  tool: {
    name: string;
    description: string;
    input_schema: Record<string, unknown>;
  },
  maxTokens = 2400,
  provider?: Provider,
  model?: string,
): Promise<T> {
  return structured<T>({
    step,
    system,
    user,
    name: tool.name,
    description: tool.description,
    schema: tool.input_schema,
    maxTokens,
    provider,
    model,
  });
}

const GUARDRAILS =
  "You are TailorMe, built by Res.Me (technical resume writers). Voice: confident, " +
  "empathetic, specific — concrete numbers from the resume, never hype. " +
  "Use normal capitalization: capitalize names, proper nouns, and the first word of " +
  "every sentence and bullet. Never write all-lowercase, Title Case headings, or ALL CAPS. " +
  "Never promise jobs, interviews, salary increases, or ATS-bypass; say 'interview-ready' / " +
  "'recruiter-ready'. When writing analysis or review notes, do not quote or repeat contact " +
  "details such as emails, phone numbers, LinkedIn URLs, websites, or street addresses. " +
  "Resume headlines must be concise role titles, not mini summaries: 3-7 words, no " +
  "'with ... experience' phrasing, and no keyword-stuffed comma lists. " +
  "Stay strictly faithful to the source resume: do not invent or inflate " +
  "metrics, numbers, percentages, dates, tenure, job titles, technologies, or " +
  "responsibilities, and do not upgrade verbs beyond what the resume supports (e.g. " +
  "'built/maintained' is not 'architected/owned'). Re-frame and tailor what is actually " +
  "there; if it is not in the resume, do not claim it. Plain text only — no HTML or markdown.";

/** Whitespace- and case-insensitive containment — robust to PDF spacing quirks. */
const PUBLIC_REDACTIONS: [RegExp, string][] = [
  [/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, "the contact email"],
  [/\bhttps?:\/\/(?:www\.)?linkedin\.com\/[^\s"'<>]+/gi, "the LinkedIn profile"],
  [/\blinkedin\.com\/[^\s"'<>]+/gi, "the LinkedIn profile"],
  [
    /\b(?:\+?1[-.\s]?)?(?:\(?\d{3}\)?[-.\s]?)\d{3}[-.\s]?\d{4}\b/g,
    "the contact phone",
  ],
  [
    /\b\d{1,6}\s+[A-Z][A-Za-z0-9.'-]*(?:\s+[A-Z][A-Za-z0-9.'-]*){0,4}\s+(?:St|Street|Ave|Avenue|Rd|Road|Blvd|Drive|Dr|Lane|Ln|Court|Ct)\b/gi,
    "the street address",
  ],
  [/\bhttps?:\/\/[^\s"'<>]+/gi, "the website URL"],
];

const QUANTIFIED_IMPACT_GUIDANCE =
  "Add a truthful metric where the work supports it: scope, volume, frequency, time saved, error reduction, revenue, cost, users, tickets, SLA, team size, budget, conversion, latency, uptime, or throughput. Do not invent the number.";

export function redactContactInfoForPublicOutput(input: string): string {
  return PUBLIC_REDACTIONS.reduce(
    (text, [pattern, replacement]) => text.replace(pattern, replacement),
    input,
  );
}

function containsContactInfo(input: string): boolean {
  return redactContactInfoForPublicOutput(input) !== input;
}

function redactPublicValue<T>(value: T, depth = 0): T {
  if (depth > 8 || value == null) return value;
  if (typeof value === "string") return redactContactInfoForPublicOutput(value) as T;
  if (typeof value !== "object") return value;
  if (Array.isArray(value)) {
    return value.map((item) => redactPublicValue(item, depth + 1)) as T;
  }
  const output: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
    output[key] = redactPublicValue(item, depth + 1);
  }
  return output as T;
}

function redactFitBreakdown(fit: FitBreakdown): FitBreakdown {
  return {
    ...fit,
    verdict: redactContactInfoForPublicOutput(fit.verdict || ""),
    locationNote: redactContactInfoForPublicOutput(fit.locationNote || ""),
    summary: redactContactInfoForPublicOutput(fit.summary || ""),
    dimensions: (fit.dimensions ?? []).map((d) => ({
      ...d,
      label: redactContactInfoForPublicOutput(d.label || ""),
      why: d.why ? redactContactInfoForPublicOutput(d.why) : undefined,
      matched: (d.matched ?? []).map(redactContactInfoForPublicOutput),
      gaps: (d.gaps ?? []).map(redactContactInfoForPublicOutput),
    })),
    keywords: (fit.keywords ?? []).map((k) => ({
      ...k,
      term: redactContactInfoForPublicOutput(k.term || ""),
    })),
  };
}

function publicAuditAgents(agents: AuditAgent[]): AuditAgent[] {
  return redactPublicValue(agents).map((agent) =>
    agent.id === "impact"
      ? {
          ...agent,
          // The metric vocabulary lives in the deep-dive only; it was too verbose
          // as an always-visible footer on the card.
          detail: agent.detail.includes(QUANTIFIED_IMPACT_GUIDANCE)
            ? agent.detail
            : `${agent.detail} ${QUANTIFIED_IMPACT_GUIDANCE}`,
        }
      : agent,
  );
}

function resumeContains(resumeText: string, fragment: string): boolean {
  const norm = (s: string) => s.toLowerCase().replace(/\s+/g, "");
  const f = norm(fragment);
  return f.length > 0 && norm(resumeText).includes(f);
}

/**
 * Keep a quote only if it genuinely appears in the resume (or, for a stitched
 * quote, each ";"/"|"-joined real span does). Anything the model fabricated or
 * silently "corrected" is dropped so the UI never stamps invented text as
 * "from your resume".
 */
function verifyQuote(resumeText: string, quote: string): string | undefined {
  const q = (quote || "").trim();
  if (!q) return undefined;
  const segs = q
    .split(/\s*[;|]\s*/)
    .map((s) => s.trim())
    .filter((s) => s.length >= 4);
  const parts = segs.length ? segs : [q];
  return parts.every((s) => resumeContains(resumeText, s)) ? q : undefined;
}

// ---------- 0. resume parse (free-audit "what we found" step) ----------
const PARSE_SYSTEM =
  "You are a precise resume parser and ATS reviewer. Extract ONLY what is actually in " +
  "the resume — never invent skills, numbers, roles, or dates. From the text: identify " +
  "the candidate's name and primary (most-recent) role title; determine total years of " +
  "professional experience — if the resume explicitly states it (e.g. '11+ years', 'over a " +
  "decade'), use that figure; otherwise estimate from earliest to latest dates WITHOUT " +
  "double-counting overlapping roles or counting future-dated ranges; count the experience " +
  "bullet points and how many contain a quantified result (a %, $, a count, a time/scale " +
  "figure like '40k', 'p95', '3x'); list the concrete hard skills and tools named " +
  "(8–20, deduplicated, as written); pick 4–6 representative experience bullets verbatim " +
  "and mark which contain a metric. " +
  "Then give 5–8 PROOF POINTS: specific, real weaknesses. When the issue is about text that " +
  "EXISTS in the resume, back it with an EXACT verbatim quote of THAT text (copy it " +
  "character-for-character, do NOT paraphrase or fix its spacing or punctuation, so the " +
  "candidate sees the finding is about THEIR resume, not generic AI advice). The quote must " +
  "be the exact text the issue is about, NEVER an unrelated line. When the issue is about " +
  "something MISSING or ABSENT (no summary, no skills section, a section that is not there), " +
  "leave the quote EMPTY rather than substituting an unrelated line. Keep each quote to the " +
  "smallest relevant span (a phrase, line, or date range), max ~160 chars. For each proof " +
  "point return: a " +
  "short title; a one-line summary; the verbatim quote; why it matters (how an ATS parser " +
  "or a recruiter skimming for ~6 seconds actually reads it); how tailoring fixes it; and a " +
  "severity (high / medium / low). Hunt for REAL issues such as: letter-spaced or " +
  "spaced-out names/headers (e.g. 'V I N O D') that break ATS text parsing; overlapping " +
  "or missing employment dates (an open-ended 'Month Year – Present' range is a normal " +
  "ongoing role — NEVER flag it as future-dated, inconsistent, or an error); vague " +
  "responsibility bullets that state " +
  "activity with no outcome; a dense wall-of-text summary; impact that is never quantified; " +
  "If you flag a dense or hard-to-scan professional summary, the fix is to shorten " +
  "and sharpen it into a tight 1-2 sentence paragraph. Do NOT recommend converting " +
  "the summary into bullets. " +
  "clichés and buzzwords; keywords buried in prose instead of scannable. " +
  "Apply professional resume standards: flag empty self-descriptors and buzzwords with no " +
  "proof (e.g. " +
  CLICHES.slice(0, 8).join(", ") +
  "); a summary that claims strengths the experience never proves; duties written as " +
  "activity instead of quantified accomplishments (problem→action→result); and US-resume " +
  "anti-patterns such as 'references available upon request', a photo, or personal " +
  "demographics. Be concrete and " +
  "honest — only flag what is genuinely in the text. Plain text only.";

/** AI parse: a structured ATS profile from raw resume text. Powers the free
 * upload step (real data + the "your resume needs work" case). */
export async function parseResume(
  resumeText: string,
  provider?: Provider,
  // When the resume is rendered in OUR template (build-from-scratch / base
  // resume), suppress style/formatting/ATS-layout findings — the template owns
  // those. The uploaded-file path leaves this false (those findings are real).
  templated = false,
): Promise<ResumeStats> {
  const data = await callTool<{
    name: string;
    primaryRole: string;
    yearsExperience: number;
    roleCount: number;
    bulletCount: number;
    metricBulletCount: number;
    skills: string[];
    sampleBullets: { text: string; hasMetric: boolean }[];
    proofPoints: {
      title: string;
      summary: string;
      quote: string;
      why: string;
      fix: string;
      severity: "high" | "medium" | "low";
    }[];
  }>(
    "parse",
    templated ? withTemplateRules(PARSE_SYSTEM) : PARSE_SYSTEM,
    `Today's date is ${new Date().toISOString().slice(0, 10)}. Any month/year on or before ` +
      `today is in the PAST; a "Month Year – Present" (or "– Current") range is a normal ` +
      `ongoing role, never a future date or an error.\n\nResume:\n${resumeText}\n\nReturn the ` +
      `structured ATS profile + proof points for this resume.`,
    {
      name: "report_profile",
      description: "Return the structured resume profile + real, quotable proof points.",
      input_schema: {
        type: "object",
        required: [
          "name",
          "primaryRole",
          "yearsExperience",
          "roleCount",
          "bulletCount",
          "metricBulletCount",
          "skills",
          "sampleBullets",
          "proofPoints",
        ],
        properties: {
          name: { type: "string" },
          primaryRole: { type: "string" },
          yearsExperience: { type: "integer" },
          roleCount: { type: "integer" },
          bulletCount: { type: "integer" },
          metricBulletCount: { type: "integer" },
          skills: { type: "array", items: { type: "string" } },
          sampleBullets: {
            type: "array",
            items: {
              type: "object",
              required: ["text", "hasMetric"],
              properties: {
                text: { type: "string" },
                hasMetric: { type: "boolean" },
              },
            },
          },
          proofPoints: {
            type: "array",
            items: {
              type: "object",
              required: ["title", "summary", "quote", "why", "fix", "severity"],
              properties: {
                title: { type: "string" },
                summary: { type: "string" },
                quote: { type: "string" },
                why: { type: "string" },
                fix: { type: "string" },
                severity: { type: "string", enum: ["high", "medium", "low"] },
              },
            },
          },
        },
      },
    },
    2600,
    provider,
  );

  const proofPoints = (Array.isArray(data.proofPoints) ? data.proofPoints : [])
    .filter((p) => p && p.title && p.why)
    .slice(0, 10)
    .map((p) => ({
      title: redactContactInfoForPublicOutput(p.title.trim()),
      summary: redactContactInfoForPublicOutput((p.summary || "").trim()),
      // Only show a quote we can actually find in the resume — otherwise the
      // card hides the "from your resume" block rather than show unverified text.
      quote: verifyQuote(resumeText, redactContactInfoForPublicOutput(p.quote || "")),
      why: redactContactInfoForPublicOutput(p.why.trim()),
      fix: redactContactInfoForPublicOutput((p.fix || "").trim()),
      severity: (["high", "medium", "low"].includes(p.severity)
        ? p.severity
        : "medium") as "high" | "medium" | "low",
    }));

  return {
    name: data.name?.trim() || "Your resume",
    primaryRole: data.primaryRole?.trim() || undefined,
    yearsExperience:
      typeof data.yearsExperience === "number" && data.yearsExperience > 0
        ? data.yearsExperience
        : undefined,
    roles: Math.max(0, data.roleCount ?? 0),
    bullets: Math.max(0, data.bulletCount ?? 0),
    metricBullets: Math.max(0, data.metricBulletCount ?? 0),
    // Drop any "skill" not actually present in the resume — guards against the
    // model inventing tools/skills (e.g. listing AWS or Zendesk that never appear).
    skills: (Array.isArray(data.skills) ? data.skills : [])
      .filter((s) => typeof s === "string" && s.trim() && resumeContains(resumeText, s))
      .filter((s) => !containsContactInfo(s))
      .map((s) => redactContactInfoForPublicOutput(s))
      .slice(0, 24),
    // "Experience we found" must be real lines from the upload — keep only
    // bullets whose text actually appears in the resume (verbatim, spacing-loose).
    sampleBullets: (Array.isArray(data.sampleBullets) ? data.sampleBullets : [])
      .filter((b) => b && b.text && resumeContains(resumeText, b.text))
      .filter((b) => !containsContactInfo(b.text))
      .map((b) => ({ ...b, text: redactContactInfoForPublicOutput(b.text) }))
      .slice(0, 6),
    proofPoints,
    // Legacy summary line kept for any non-proof-point consumer.
    weaknesses: proofPoints.map((p) => p.title),
  };
}

// ---------- 0a2. structure raw text into a base resume (paste-import) ----------
const STRUCTURE_SYSTEM =
  "You convert a person's raw resume text, LinkedIn export, or rough career notes " +
  "into a STRUCTURED resume. Extract ONLY what is actually in the text — never " +
  "invent employers, job titles, dates, metrics, schools, certifications, or " +
  "skills. Produce: the candidate's name; a concise headline (their most recent or stated " +
  "target title, 3-7 words, never a sentence); a single contact line joining phone, email, city/state, and any " +
  "LinkedIn URL with ' | '; a short professional summary ONLY if the text has one " +
  "(otherwise empty); experience entries (role, company, dates, and the bullet " +
  "points roughly as written); education; projects; certifications; and a " +
  "deduplicated skills list. Keep wording close to the original. Include the most recent " +
  "and most relevant roles in full (up to ~12 experience entries); for older or less " +
  "relevant roles, keep a brief one-line entry or omit them, so the result stays focused " +
  "and within size limits. Plain text only.";

/** Structure pasted resume/LinkedIn/notes text into a TailoredDoc (no posting,
 * no scoring). Powers the paste-import path. Returns null if too thin to use. */
export async function structureResume(
  text: string,
  provider?: Provider,
): Promise<TailoredDoc | null> {
  const data = await callTool<unknown>(
    "parse",
    STRUCTURE_SYSTEM,
    `Raw resume / profile text:\n\n${text}\n\nReturn the structured resume.`,
    {
      name: "structured_resume",
      description: "The text organized into structured resume fields.",
      input_schema: {
        type: "object",
        required: ["name", "headline", "contact", "summary", "experience", "skills"],
        properties: {
          name: { type: "string" },
          headline: {
            type: "string",
            maxLength: 70,
            description: "Concise resume headline: target/current role title only, 3-7 words, not a sentence.",
          },
          contact: { type: "string" },
          summary: { type: "string" },
          experience: {
            type: "array",
            items: {
              type: "object",
              required: ["role", "company", "dates", "bullets"],
              properties: {
                role: { type: "string" },
                company: { type: "string" },
                dates: { type: "string" },
                bullets: { type: "array", items: { type: "string" } },
              },
            },
          },
          education: {
            type: "array",
            items: {
              type: "object",
              required: ["school", "degree", "dates"],
              properties: {
                school: { type: "string" },
                degree: { type: "string" },
                dates: { type: "string" },
              },
            },
          },
          projects: {
            type: "array",
            items: {
              type: "object",
              required: ["name", "description"],
              properties: {
                name: { type: "string" },
                description: { type: "string" },
              },
            },
          },
          certifications: {
            type: "array",
            items: {
              type: "object",
              required: ["name", "issuer", "date"],
              properties: {
                name: { type: "string" },
                issuer: { type: "string" },
                date: { type: "string" },
              },
            },
          },
          skills: { type: "array", items: { type: "string" } },
        },
      },
    },
    8000,
    provider,
  );
  const doc = sanitizeDoc(data);
  if (!doc) return null;
  // Pre-group skills so an imported resume opens already categorized.
  if (!doc.skillGroups?.length && doc.skills.length >= 4) {
    try {
      const groups = await categorizeSkills(doc.skills, provider);
      if (groups.length) doc.skillGroups = groups;
    } catch {
      /* best-effort — flat skills still render */
    }
  }
  return doc;
}

// ---------- 0a3. categorize a flat skills list into labeled groups ----------
const CATEGORIZE_SYSTEM =
  GUARDRAILS +
  " You organize an EXISTING list of resume skills into a few labeled categories. " +
  "Rules: use EVERY skill exactly once; do NOT invent, rename, split, merge, or drop " +
  "any skill — copy each verbatim. Create 3–5 SHORT, role-relevant labels: 2–4 words, " +
  "use '&' rather than 'and' (e.g. 'Integration & APIs', 'Data & Analytics', " +
  "'Tools & Platforms', 'Support & Troubleshooting'). Prefer categories that each hold " +
  "two or more related skills.";

/** Organize a flat skills list into labeled groups for the categorized resume
 * layout. Faithful by construction: only real input skills survive, none are
 * invented, and any the model drops are re-appended so nothing is lost. */
export async function categorizeSkills(
  skills: string[],
  provider?: Provider,
): Promise<{ label: string; skills: string[] }[]> {
  const clean = Array.from(
    new Map(
      (skills ?? [])
        .map((s) => (typeof s === "string" ? s.trim() : ""))
        .filter(Boolean)
        .map((s) => [s.toLowerCase(), s]),
    ).values(),
  );
  if (clean.length < 4) return []; // too few to be worth grouping

  const data = await callTool<{ groups?: { label?: string; skills?: string[] }[] }>(
    "review",
    CATEGORIZE_SYSTEM,
    `Skills to organize (use each exactly once, verbatim):\n${clean
      .map((s) => `- ${s}`)
      .join("\n")}\n\nReturn the categorized groups.`,
    {
      name: "categorize_skills",
      description: "Organize the given skills into a few labeled categories.",
      input_schema: {
        type: "object",
        required: ["groups"],
        properties: {
          groups: {
            type: "array",
            items: {
              type: "object",
              required: ["label", "skills"],
              properties: {
                label: { type: "string" },
                skills: { type: "array", items: { type: "string" } },
              },
            },
          },
        },
      },
    },
    1500,
    provider,
  );

  // Map returned skills back to the canonical input casing; drop anything not in
  // the input (no hallucinated skills) and any duplicate placement.
  const byLower = new Map(clean.map((s) => [s.toLowerCase(), s]));
  const placed = new Set<string>();
  const groups = (Array.isArray(data.groups) ? data.groups : [])
    .slice(0, 6)
    .map((g) => {
      const label = (typeof g.label === "string" ? g.label : "").trim().slice(0, 50);
      const items = (Array.isArray(g.skills) ? g.skills : [])
        .map((s) => byLower.get((typeof s === "string" ? s : "").trim().toLowerCase()))
        .filter((s): s is string => !!s && !placed.has(s));
      items.forEach((s) => placed.add(s));
      return { label, skills: items };
    })
    .filter((g) => g.label && g.skills.length > 0);
  if (!groups.length) return [];

  // Re-append any skill the model dropped so nothing is silently lost.
  const missed = clean.filter((s) => !placed.has(s));
  if (missed.length) {
    const target = groups.reduce((a, b) => (a.skills.length <= b.skills.length ? a : b));
    target.skills.push(...missed);
  }
  return groups;
}

// ---------- 0b. role context (fast, candidate-independent background research) ----------
const ROLE_CONTEXT_SYSTEM =
  "You are a job-market analyst. Given a TARGET ROLE — either a short job title or a " +
  "full job posting — describe what this KIND of role generally requires, using " +
  "industry-standard knowledge (NOT specific to any candidate; no resume is provided). " +
  "Identify the normalized role title; the company only if a posting explicitly names " +
  "one; the typical seniority; 4–6 common responsibilities; 6–10 typical hard skills/" +
  "tools; the 6–10 keywords ATS and recruiters screen for; and 3–4 gaps commonly seen in " +
  "resumes that apply for this role. Be concise and concrete. Plain text only.";

/** Fast, low-context role research so the loading screen reflects the real
 *  target and the fit analysis is grounded. Uses the cheap FAST model. */
export async function researchRole(
  target: string,
  provider?: Provider,
): Promise<RoleContext> {
  const data = await callTool<{
    role: string;
    company: string;
    seniority: string;
    responsibilities: string[];
    typicalSkills: string[];
    keywords: string[];
    commonGaps: string[];
  }>(
    "parse",
    ROLE_CONTEXT_SYSTEM,
    `Target role or posting:\n${target}\n\nReturn the general context for this kind of role.`,
    {
      name: "report_role_context",
      description: "Return general, candidate-independent context for a target role.",
      input_schema: {
        type: "object",
        required: [
          "role",
          "seniority",
          "responsibilities",
          "typicalSkills",
          "keywords",
          "commonGaps",
        ],
        properties: {
          role: { type: "string" },
          company: { type: "string" },
          seniority: { type: "string" },
          responsibilities: { type: "array", items: { type: "string" } },
          typicalSkills: { type: "array", items: { type: "string" } },
          keywords: { type: "array", items: { type: "string" } },
          commonGaps: { type: "array", items: { type: "string" } },
        },
      },
    },
    1100,
    provider,
  );
  return {
    role: data.role?.trim() || "Target role",
    company: data.company?.trim() || undefined,
    seniority: data.seniority?.trim() || "",
    responsibilities: Array.isArray(data.responsibilities)
      ? data.responsibilities.slice(0, 6)
      : [],
    typicalSkills: Array.isArray(data.typicalSkills)
      ? data.typicalSkills.slice(0, 12)
      : [],
    keywords: Array.isArray(data.keywords) ? data.keywords.slice(0, 12) : [],
    commonGaps: Array.isArray(data.commonGaps) ? data.commonGaps.slice(0, 4) : [],
  };
}

// ---------- 1. fit scoring (free audit + full run) ----------

/** Map an overall fit score to the repo's verdict tiers (04-job-evaluation.md). */
export function verdictTier(
  overall: number,
): "Strong" | "Good" | "Moderate" | "Weak" | "Poor" {
  if (overall >= 75) return "Strong";
  if (overall >= 60) return "Good";
  if (overall >= 45) return "Moderate";
  if (overall >= 30) return "Weak";
  return "Poor";
}

/**
 * Whether to nudge a manual expert review. Anything short of a clear Strong fit,
 * or several missing must-have keywords, means the resume needs repositioning —
 * exactly where the human Res.Me service adds value. Honest, not a hard sell.
 */
export function shouldSuggestManualReview(fit: {
  overall: number;
  keywords?: { inResume: boolean }[];
}): boolean {
  if (fit.overall < 75) return true;
  const missing = (fit.keywords ?? []).filter((k) => !k.inResume).length;
  return missing >= 3;
}

export async function scoreFit(
  resumeText: string,
  postingText: string,
  provider?: Provider,
  model?: string,
): Promise<{ company: string; role: string; fit: FitBreakdown }> {
  const data = await callTool<{
    company: string;
    role: string;
    overall: number;
    verdict: string;
    locationStatus: "pass" | "fail" | "unclear";
    locationNote: string;
    summary: string;
    dimensions: {
      label: string;
      score: number;
      why: string;
      matched: string[];
      gaps: string[];
    }[];
    keywords: { term: string; inResume: boolean }[];
  }>(
    "score",
    GUARDRAILS,
    `Resume:\n${resumeText}\n\nJob posting:\n${postingText}\n\n` +
      "Extract the company and role, then score fit across exactly these four 0–100 " +
      "dimensions: Technical skills, Experience match, Culture fit, Career alignment. " +
      "Judge fit the way a hiring manager buying for THIS role would: weigh demonstrated, " +
      "quantified outcomes over duties and self-descriptions, and treat unproven adjectives " +
      "or buzzwords as no evidence. " +
      "BE HONEST AND CALIBRATED — this assessment must be accurate, not flattering. Only " +
      "score a dimension high when the resume gives direct, concrete evidence; when the " +
      "evidence is thin or absent, score it low and say so plainly. Reserve an overall " +
      "'Strong fit' (75+) for resumes that clearly support it; if the match is only " +
      "partial, call it Moderate or Weak and note the role may be a stretch. NEVER credit " +
      "skills, tools, certifications, titles, or achievements that are not in the resume. " +
      "For each dimension: give a one-sentence 'why' for the score, grounded in specific " +
      "resume-vs-posting evidence; list concrete matched evidence quoting the resume; and " +
      "gaps stated honestly — if the resume shows no evidence of a requirement, say it is " +
      "missing and what evidence would be needed (e.g. 'would need stronger evidence of X'), " +
      "without assuming unwritten experience exists. Be constructive, never harsh. " +
      "Also extract the 8–12 most important keywords/skills the posting screens for, and " +
      "mark inResume TRUE only when the resume genuinely demonstrates it with concrete " +
      "evidence — not merely adjacent, implied, or a related buzzword; when in doubt, mark " +
      "it false. Most real resumes are missing several of a posting's keywords; do not mark " +
      "them all present. " +
      "Judge Location & logistics as one of 'pass' (the candidate meets the location / work-" +
      "authorization requirement), 'fail' (a real conflict — e.g. the role requires a region or " +
      "authorization the resume contradicts), or 'unclear' (the posting states no location " +
      "requirement, or the resume doesn't state a location), with a one-line reason. Give an overall " +
      "0–100, a verdict tier (Strong fit / Good fit / Moderate fit / Weak fit / Poor fit), " +
      "and a one-sentence summary starting 'Why <overall> — <verdict>:'.",
    {
      name: "report_fit",
      description: "Return the structured fit assessment + posting keyword match.",
      input_schema: {
        type: "object",
        required: [
          "company",
          "role",
          "overall",
          "verdict",
          "locationStatus",
          "locationNote",
          "summary",
          "dimensions",
          "keywords",
        ],
        properties: {
          company: { type: "string" },
          role: { type: "string" },
          overall: { type: "integer" },
          verdict: { type: "string" },
          locationStatus: { type: "string", enum: ["pass", "fail", "unclear"] },
          locationNote: { type: "string" },
          summary: { type: "string" },
          dimensions: {
            type: "array",
            items: {
              type: "object",
              required: ["label", "score", "matched", "gaps", "why"],
              properties: {
                label: { type: "string" },
                score: { type: "integer" },
                why: { type: "string" },
                matched: { type: "array", items: { type: "string" } },
                gaps: { type: "array", items: { type: "string" } },
              },
            },
          },
          keywords: {
            type: "array",
            items: {
              type: "object",
              required: ["term", "inResume"],
              properties: {
                term: { type: "string" },
                inResume: { type: "boolean" },
              },
            },
          },
        },
      },
    },
    2400,
    provider,
    model,
  );

  const keywords = Array.isArray(data.keywords) ? data.keywords.slice(0, 14) : [];
  const fit = redactFitBreakdown({
      overall: data.overall,
      verdict: data.verdict,
      dimensions: Array.isArray(data.dimensions) ? data.dimensions : [],
      locationStatus: data.locationStatus,
      // Keep the legacy boolean populated for any older consumer.
      locationPass: data.locationStatus === "pass",
      locationNote: data.locationNote,
      summary: data.summary,
      keywords,
      recommendReview: shouldSuggestManualReview({ overall: data.overall, keywords }),
  });

  return {
    company: stripLogoArtifact(redactContactInfoForPublicOutput(data.company || "")),
    role: stripLogoArtifact(redactContactInfoForPublicOutput(data.role || "")),
    fit,
  };
}

// ---------- 2. tailor (rewrite + assemble documents) ----------

/** A tailor result is only usable if the model actually filled the arrays the
 * UI and PDF renderer depend on. Guards against forced-tool-use dropping
 * `required` fields (observed on some Anthropic models for certain resumes). */
function tailorResultComplete(r: {
  bullets?: unknown;
  keywords?: unknown;
  doc?: unknown;
} | null | undefined): boolean {
  if (!r) return false;
  const doc = r.doc as Partial<TailoredDoc> | undefined;
  return (
    !!doc &&
    Array.isArray(doc.experience) &&
    doc.experience.length > 0 &&
    Array.isArray(doc.skills) &&
    Array.isArray(r.bullets) &&
    Array.isArray(r.keywords)
  );
}

const MIN_EDITOR_REWRITE_DIFFS = 3;
const MAX_TAILOR_QUALITY_ATTEMPTS = 2;

interface TailorStepResult {
  bullets: TailoredBullet[];
  keywords: string[];
  doc: TailoredDoc;
  diagnostics: Pick<
    TailorDiagnostics,
    "rawRewritePairs" | "changedRewritePairs" | "noOpRewritePairs" | "documentRepairPasses"
  >;
}

type RawTailorResult = {
  bullets?: unknown;
  keywords?: unknown;
  doc?: unknown;
};

function normalizeRewriteText(value: string): string {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9%$]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function cleanRewritePairs(pairs: TailoredBullet[] | undefined): TailoredBullet[] {
  return (Array.isArray(pairs) ? pairs : [])
    .map((pair) => ({
      before: String(pair?.before || "").trim(),
      after: String(pair?.after || "").trim(),
    }))
    .filter(
      (pair) =>
        pair.before &&
        pair.after &&
        normalizeRewriteText(pair.before) !== normalizeRewriteText(pair.after) &&
        !containsContactInfo(pair.before) &&
        !containsContactInfo(pair.after),
    );
}

function normalizeTailorOutput(input: unknown): Omit<TailorStepResult, "diagnostics"> | null {
  if (!input || typeof input !== "object") return null;
  const raw = input as RawTailorResult;
  const doc = sanitizeDoc(raw.doc);
  if (!doc?.experience?.length) return null;
  return {
    doc,
    keywords: (Array.isArray(raw.keywords) ? raw.keywords : [])
      .map((keyword) => String(keyword || "").trim())
      .filter(Boolean)
      .slice(0, 14),
    bullets: cleanRewritePairs(raw.bullets as TailoredBullet[] | undefined),
  };
}

function docBulletCount(doc: TailoredDoc): number {
  return (doc.experience || []).reduce((n, entry) => n + (entry.bullets || []).length, 0);
}

function docMateriallyDiffersFromSource(resumeText: string, doc: TailoredDoc): boolean {
  return normalizeRewriteText(resumeText) !== normalizeRewriteText(docToResumeText(doc));
}

// Faithful bullet-rewrite exemplars mined from 151 real professional resumes.
// Every "after" uses only facts present in the input — no invented numbers or scope.
const BULLET_EXAMPLES =
  "EXAMPLES OF FAITHFUL BULLET REWRITES (each rewrite below rephrases the same fact " +
  "— no invented numbers, employers, technologies, or scope claims):\n\n" +
  "[wordy-to-concise]\n" +
  "BEFORE: Led planning for UK Defence capability development improvements for cyber and " +
  "information activities during a period of full-time Reserve service. As cyber task lead " +
  "and solution architect, primary roles included developing requirements and planning " +
  "solutions for MOD cyber & information activities capability, including working on threat " +
  "led situational awareness assessment.\n" +
  "AFTER: Led planning for Defence cyber and information capability improvements, defining " +
  "requirements and solutions to enhance threat-led situational awareness.\n\n" +
  "[passive-to-action]\n" +
  "BEFORE: Students with little prior background were guided through a complex project " +
  "involving using large cluster farms to process terabyte sized data sets and produce " +
  "statistical analyses in a 2-week intensive course.\n" +
  "AFTER: Trained students with minimal prior experience to process terabyte-sized " +
  "sequencing datasets using computing clusters.\n\n" +
  "[vague-to-impact]\n" +
  "BEFORE: Creates custom Python scripts to enhance workflow processes including customizing " +
  "a future land use applicability script that led to a cost savings of $10,000 in " +
  "consulting fees.\n" +
  "AFTER: Designed and deployed Python scripts to automate internal workflows; built a land " +
  "use applicability tool that eliminated $10,000 in external consulting fees.\n\n" +
  "[duties-to-achievements]\n" +
  "BEFORE: 6000 employee / Global + Strategy Passenger Car Business / " +
  "(Europe/North-/South America/Asia/Africa/Australia) / 550M P&L\n" +
  "AFTER: Directed corporate strategy for the global passenger car division across six " +
  "continents, managing a $550M P&L and overseeing over 6,000 employees.\n\n" +
  "[buried-metric-to-led]\n" +
  "BEFORE: Solely represented the company at AFM (American Film Market). Designed and led " +
  "the sales/marketing strategy that produced a global distribution deal with Epic Pictures.\n" +
  "AFTER: Secured a global distribution deal with Epic Pictures by spearheading a targeted " +
  "sales and marketing strategy at the American Film Market (AFM).\n\n";

function documentRepairHint(): string {
  return (
    "The prior response omitted required document fields. Return a COMPLETE tailored result: " +
    "bullets array, keywords array, and doc with name, headline, contact, summary, non-empty " +
    "experience array, each experience entry containing role/company/dates/bullets, skills " +
    "array, and coverLetter. Do not return a partial object."
  );
}

async function repairIncompleteTailorResult(
  resumeText: string,
  postingText: string,
  partial: unknown,
  provider?: Provider,
  model?: string,
): Promise<RawTailorResult | null> {
  try {
    return await callTool<RawTailorResult>(
      "tailor",
      GUARDRAILS,
      `Original resume:\n${resumeText}\n\nJob posting:\n${postingText}\n\n` +
        `Incomplete tailor output:\n${JSON.stringify(partial ?? {})}\n\n` +
        "The tailor output above is incomplete or malformed. Complete it into a full, renderable " +
        "tailored result. Preserve any valid tailored wording from the partial output, but fill " +
        "missing structured fields from the original resume and job posting. Return bullets, " +
        "keywords, and doc. The doc must include a non-empty experience array with bullets and a " +
        "skills array. Keep every claim faithful to the original resume; do not invent facts, " +
        "metrics, tools, dates, employers, schools, or degrees. Plain text only.",
      {
        name: "repair_tailored_document",
        description: "Complete a partial tailor result into a full renderable tailored document.",
        input_schema: {
          type: "object",
          required: ["bullets", "keywords", "doc"],
          properties: {
            bullets: {
              type: "array",
              items: {
                type: "object",
                required: ["before", "after"],
                properties: {
                  before: { type: "string" },
                  after: { type: "string" },
                },
              },
            },
            keywords: { type: "array", items: { type: "string" } },
            doc: {
              type: "object",
              required: [
                "name",
                "headline",
                "contact",
                "summary",
                "experience",
                "skills",
                "coverLetter",
              ],
              properties: {
                name: { type: "string" },
                headline: {
                  type: "string",
                  maxLength: 70,
                  description: "Concise resume headline: target role title only, 3-7 words, not a sentence.",
                },
                contact: { type: "string" },
                summary: { type: "string" },
                experience: {
                  type: "array",
                  items: {
                    type: "object",
                    required: ["role", "company", "dates", "bullets"],
                    properties: {
                      role: { type: "string" },
                      company: { type: "string" },
                      dates: { type: "string" },
                      bullets: { type: "array", items: { type: "string" } },
                    },
                  },
                },
                skills: { type: "array", items: { type: "string" } },
                education: {
                  type: "array",
                  items: {
                    type: "object",
                    required: ["school", "degree", "dates"],
                    properties: {
                      school: { type: "string" },
                      degree: { type: "string" },
                      dates: { type: "string" },
                    },
                  },
                },
                coverLetter: { type: "string" },
              },
            },
          },
        },
      },
      4500,
      provider,
      model,
    );
  } catch {
    return null;
  }
}

async function tailor(
  resumeText: string,
  postingText: string,
  provider?: Provider,
  model?: string,
  qualityHint?: string,
): Promise<TailorStepResult> {
  const run = (documentHint?: string) =>
    callTool<RawTailorResult>(
    "tailor",
    GUARDRAILS,
    `Resume:\n${resumeText}\n\nJob posting:\n${postingText}\n\n` +
      BULLET_EXAMPLES +
      "Editor contract: return 4-8 changed before/after EXPERIENCE bullet pairs. " +
      "Each pair's after text must closely match one bullet in doc.experience so the " +
      "revision editor can anchor it; each before text must be the source resume bullet " +
      "or fact it rewrites. " +
      "Rewrite this resume for THIS posting: re-rank bullets by relevance, translate tasks " +
      "into impact with real numbers where the resume supports them, and align keywords only " +
      "where backed by experience. Do NOT add scope/scale qualifiers the resume does not " +
      "state (e.g. 'distributed', 'enterprise-scale', 'architected', 'led', 'owned') — keep " +
      "every claim at the level the resume actually supports. Keep every metric attached to " +
      "the SAME achievement it came from — never move a number, percentage, or result onto a " +
      "different bullet. Do NOT assert a skill, tool, or certification from the skills list as " +
      "applied to a specific role or project unless that entry's own text says so. Frame bullets " +
      "as accomplishments (action → scope → result) and ensure every claim would be defensible " +
      "in an interview. Keep the " +
      "resume to a tight TWO " +
      "PAGES: include the most " +
      "relevant roles most-recent-first (at most 6 entries), 3–5 bullets for recent roles and " +
      "2–3 for older ones, a 1–2 sentence summary, and about 10–15 skills — prioritize " +
      "relevance over completeness. Return: a few before/after bullet pairs (the strongest " +
      "rewrites), the aligned keywords, and a complete tailored document (name, concise headline " +
      "as a role title only, 3-7 words, no 'with ... experience' phrasing, " +
      "contact line, 1–2 sentence summary, experience entries with rewritten bullets, skills, " +
      "education entries (degree, school, and dates — include ONLY if the resume actually lists " +
      "education; never invent a school or degree), and a 3-paragraph cover letter). Plain text only." +
      (qualityHint ? `\n\nRevision evidence quality gate:\n${qualityHint}` : "") +
      (documentHint ? `\n\nDocument completeness repair:\n${documentHint}` : ""),
    {
      name: "tailor_resume",
      description: "Return the tailored bullets, keywords, and full document.",
      input_schema: {
        type: "object",
        required: ["bullets", "keywords", "doc"],
        properties: {
          bullets: {
            type: "array",
            items: {
              type: "object",
              required: ["before", "after"],
              properties: {
                before: { type: "string" },
                after: { type: "string" },
              },
            },
          },
          keywords: { type: "array", items: { type: "string" } },
          doc: {
            type: "object",
            required: [
              "name",
              "headline",
              "contact",
              "summary",
              "experience",
              "skills",
              "coverLetter",
            ],
            properties: {
              name: { type: "string" },
              headline: {
                type: "string",
                maxLength: 70,
                description: "Concise resume headline: target role title only, 3-7 words, not a sentence.",
              },
              contact: { type: "string" },
              summary: { type: "string" },
              experience: {
                type: "array",
                items: {
                  type: "object",
                  required: ["role", "company", "dates", "bullets"],
                  properties: {
                    role: { type: "string" },
                    company: { type: "string" },
                    dates: { type: "string" },
                    bullets: { type: "array", items: { type: "string" } },
                  },
                },
              },
              skills: { type: "array", items: { type: "string" } },
              education: {
                type: "array",
                items: {
                  type: "object",
                  required: ["school", "degree", "dates"],
                  properties: {
                    school: { type: "string" },
                    degree: { type: "string" },
                    dates: { type: "string" },
                  },
                },
              },
              coverLetter: { type: "string" },
            },
          },
        },
      },
    },
    4000,
    provider,
    model,
    );

  // Anthropic forced tool-use does not hard-enforce `required`, so a model can
  // occasionally drop the experience/skills arrays. Retry once, then fail loud
  // rather than handing a half-built document to the renderer/dashboard.
  let documentRepairPasses = 0;
  let result: RawTailorResult | null = await run();
  let normalized = normalizeTailorOutput(result);
  if (!normalized || !tailorResultComplete(result)) {
    const retry = await run(documentRepairHint());
    const retryNormalized = normalizeTailorOutput(retry);
    if (retryNormalized) {
      result = retry;
      normalized = retryNormalized;
    }
  }
  if (!normalized) {
    documentRepairPasses = 1;
    result = await repairIncompleteTailorResult(
      resumeText,
      postingText,
      result,
      provider,
      model,
    );
    normalized = normalizeTailorOutput(result);
  }
  if (!normalized) {
    throw new Error(
      "The tailoring step returned an incomplete document. Please try again.",
    );
  }
  // Drop no-op "rewrites" (before === after) — an unchanged pair adds no value
  // and makes the "what changed" / impact evidence look broken.
  const rawBullets = Array.isArray(result?.bullets) ? result.bullets : [];
  const cleanBullets = normalized.bullets;
  return {
    ...normalized,
    bullets: cleanBullets,
    diagnostics: {
      rawRewritePairs: rawBullets.length,
      changedRewritePairs: cleanBullets.length,
      noOpRewritePairs: Math.max(0, rawBullets.length - cleanBullets.length),
      documentRepairPasses,
    },
  };
}

/** Run only the tailor step on a specific provider+model (used by /api/eval). */
export async function tailorOnce(
  resumeText: string,
  postingText: string,
  provider: Provider,
  model: string,
): Promise<{ bullets: TailoredBullet[]; keywords: string[]; doc: TailoredDoc }> {
  return tailor(resumeText, postingText, provider, model);
}

async function repairRewriteEvidence(
  resumeText: string,
  postingText: string,
  doc: TailoredDoc,
  provider?: Provider,
  model?: string,
): Promise<TailoredBullet[]> {
  try {
    const data = await callTool<{ bullets: TailoredBullet[] }>(
      "tailor",
      GUARDRAILS,
      `Original resume:\n${resumeText}\n\nJob posting:\n${postingText}\n\n` +
        `Current tailored document experience bullets:\n${JSON.stringify(doc.experience)}\n\n` +
        "Return 4-8 before/after rewrite evidence pairs for the current tailored document. " +
        "Use only experience bullets. The after value MUST be copied exactly from one of the " +
        "current tailored document bullets above. The before value MUST be the original resume " +
        "bullet or closest source line that supports the same fact. Do not invent facts, metrics, " +
        "tools, scope, or seniority. If fewer than 3 truthful pairs exist, return only the pairs " +
        "you can prove. Plain text only.",
      {
        name: "repair_rewrite_evidence",
        description: "Return before/after rewrite evidence pairs anchored to the current doc.",
        input_schema: {
          type: "object",
          required: ["bullets"],
          properties: {
            bullets: {
              type: "array",
              items: {
                type: "object",
                required: ["before", "after"],
                properties: {
                  before: { type: "string" },
                  after: { type: "string" },
                },
              },
            },
          },
        },
      },
      2200,
      provider,
      model,
    );
    return cleanRewritePairs(data.bullets);
  } catch {
    return [];
  }
}

// ---------- 2b. faithfulness verification (repair pass over the tailored doc) ----------

/**
 * Token ceiling for the verify pass. The pass must echo the FULL experience
 * array back (every role/company/dates + bullet) plus a corrections list, so a
 * fixed cap that's fine for a short resume truncates a long one, and a truncated
 * JSON body throws in the parser, which verifyDoc then reports as "unavailable"
 * even though the draft was perfectly faithful. max_tokens is a ceiling, not a
 * charge (the model stops at the closing brace), so we size it to the draft:
 * about chars/2 (comfortably above the real ~chars/3.5 token rate, plus room for
 * corrections), floored at the long-standing 3000 default so short resumes are
 * byte-for-byte unchanged, and capped at 8000 (below common model output limits,
 * yet because actual output runs ~chars/3.5 it still echoes the largest allowed
 * resume, MAX_RESUME_CHARS, without truncating).
 */
export function verifyMaxTokens(doc: TailoredDoc): number {
  const experience = Array.isArray(doc.experience) ? doc.experience : [];
  const json = JSON.stringify({ summary: doc.summary ?? "", experience });
  return Math.min(8_000, Math.max(3_000, Math.ceil(json.length / 2) + 1_000));
}

/**
 * Post-tailor faithfulness pass. The offline A/B eval showed that even with the
 * exemplar-grounded prompt, tailored output still leaks unsupported claims —
 * dominated NOT by rephrasing but by misattribution (a real metric moved to the
 * wrong bullet), skills-list conflation (a listed skill asserted onto a specific
 * role), and inflated scope ('assisted'→'led'). A whole-resume substring check
 * cannot catch those (the metric/skill exists somewhere in the resume), so this
 * re-reads every shipped bullet + the summary against the source and rewrites
 * any unsupported claim back to what the resume actually supports, returning the
 * repaired doc plus a record of what it pulled (a user-facing trust signal).
 *
 * Best-effort: on any error or a structural mismatch it returns the doc
 * unchanged, so the paid deliverable is never blocked by the check.
 */
async function verifyDoc(
  resumeText: string,
  doc: TailoredDoc,
  provider?: Provider,
): Promise<{ doc: TailoredDoc; report: VerificationReport }> {
  const experience = Array.isArray(doc.experience) ? doc.experience : [];
  const checked =
    experience.reduce((n, e) => n + (e.bullets?.length || 0), 0) +
    (doc.summary ? 1 : 0);
  // Returned whenever the pass does NOT complete (no experience to check, a
  // provider error, or a structurally-rejected repair). status "unavailable"
  // tells the UI to make NO faithfulness claim for this run.
  const empty: VerificationReport = { status: "unavailable", checked, corrections: [] };
  if (!experience.length) return { doc, report: empty };

  try {
    const data = await callTool<{
      experience: { role: string; company: string; dates: string; bullets: string[] }[];
      summary: string;
      corrections: { kind: string; claim: string; note: string }[];
    }>(
      "review",
      GUARDRAILS,
      `ORIGINAL RESUME (the only ground truth):\n${resumeText}\n\n` +
        `TAILORED DRAFT (JSON):\n${JSON.stringify({ summary: doc.summary, experience })}\n\n` +
        "Verify the tailored draft against the ORIGINAL RESUME and repair any unfaithful " +
        "claim. A claim is unfaithful if ANY of these hold: (1) FABRICATED — a number, %, $, " +
        "date, employer, technology, tool, certification, or scope word that appears nowhere " +
        "in the original; (2) MISATTRIBUTED — a real metric or result from the resume attached " +
        "to a different achievement than the one it belongs to; (3) SKILL-CONFLATION — a " +
        "skill/tool/cert from the resume's skills list asserted as applied to a specific role " +
        "or project the resume never connects it to; (4) INFLATED-SCOPE — scope or level " +
        "raised beyond what the resume states (e.g. 'assisted with' rewritten as 'led', or 'a " +
        "team' as 'a global team'). For each affected line, rewrite it to the strongest " +
        "version that stays fully supported by the original — remove or soften ONLY the " +
        "unsupported part and keep faithful wording and any genuine metric. Return the FULL " +
        "experience array in the SAME order with the SAME role/company/dates and the " +
        "(possibly edited) bullets, the (possibly edited) summary, and a corrections list — " +
        "one entry per claim you removed or softened, each with kind (fabricated | " +
        "misattributed | skill-conflation | inflated-scope), the claim text, and a one-line " +
        "note citing the resume. If the draft is already fully faithful, return it unchanged " +
        "with corrections=[].",
      {
        name: "verify_faithfulness",
        description: "Return the faithfulness-repaired doc + a record of corrections.",
        input_schema: {
          type: "object",
          required: ["experience", "summary", "corrections"],
          properties: {
            experience: {
              type: "array",
              items: {
                type: "object",
                required: ["role", "company", "dates", "bullets"],
                properties: {
                  role: { type: "string" },
                  company: { type: "string" },
                  dates: { type: "string" },
                  bullets: { type: "array", items: { type: "string" } },
                },
              },
            },
            summary: { type: "string" },
            corrections: {
              type: "array",
              items: {
                type: "object",
                required: ["kind", "claim", "note"],
                properties: {
                  kind: {
                    type: "string",
                    enum: [
                      "fabricated",
                      "misattributed",
                      "skill-conflation",
                      "inflated-scope",
                    ],
                  },
                  claim: { type: "string" },
                  note: { type: "string" },
                },
              },
            },
          },
        },
      },
      verifyMaxTokens(doc),
      provider,
    );

    // Only adopt the repaired experience when its shape matches the draft: same
    // role count, same per-role bullet count AFTER trimming/dropping empties, and
    // the same role/company in each slot. A reshaped or reordered array means the
    // model dropped, added, or moved content — keep the draft untouched rather
    // than ship that (and report it as "unavailable", never "clean"; see below).
    const repairedExp = Array.isArray(data.experience) ? data.experience : [];
    // Normalize bullets the way we'd actually adopt them BEFORE checking the
    // count, so a bullet "removed" by emitting "" can't slip past the guard and
    // silently shrink the deliverable.
    const adopted: (string[] | null)[] = repairedExp.map((e) =>
      Array.isArray(e?.bullets)
        ? e.bullets.map((b) => String(b || "").trim()).filter(Boolean)
        : null,
    );
    const key = (s: string) => String(s || "").toLowerCase().replace(/[^a-z0-9]/g, "");
    const sameShape =
      adopted.length === experience.length &&
      repairedExp.every((e, i) => {
        const b = adopted[i];
        return (
          b !== null &&
          b.length === (experience[i].bullets?.length || 0) &&
          key(e.role) === key(experience[i].role) &&
          key(e.company) === key(experience[i].company)
        );
      });
    const nextDoc: TailoredDoc = sameShape
      ? {
          ...doc,
          summary:
            typeof data.summary === "string" && data.summary.trim()
              ? data.summary.trim()
              : doc.summary,
          experience: experience.map((e, i) => ({
            role: e.role,
            company: e.company,
            dates: e.dates,
            bullets: adopted[i] as string[],
          })),
        }
      : doc;

    const VALID_KINDS = new Set([
      "fabricated",
      "misattributed",
      "skill-conflation",
      "inflated-scope",
    ]);
    // Only report corrections we actually applied. If the repair was rejected for
    // a shape mismatch, the doc still contains the original claims — claiming we
    // pulled them would be false, so report none.
    const corrections: VerificationCorrection[] = !sameShape
      ? []
      : (Array.isArray(data.corrections) ? data.corrections : [])
          .filter((c) => c && VALID_KINDS.has(c.kind) && (c.claim || "").trim())
          .slice(0, 8)
          .map((c) => ({
            kind: c.kind as VerificationCorrection["kind"],
            claim: c.claim.trim(),
            note: (c.note || "").trim(),
          }));

    // The shape-mismatch path discarded the repair, so we cannot assert the doc
    // is clean — mark it "unavailable" so the UI makes no guarantee. Otherwise it
    // is "corrected" if we pulled anything back, else "clean".
    const status: VerificationReport["status"] = !sameShape
      ? "unavailable"
      : corrections.length
        ? "corrected"
        : "clean";
    return { doc: nextDoc, report: { status, checked, corrections } };
  } catch {
    return { doc, report: empty };
  }
}

// ---------- 3. agent review ----------
async function review(
  doc: TailoredDoc,
  postingText: string,
  provider?: Provider,
): Promise<AgentNote[]> {
  const data = await callTool<{ notes: AgentNote[] }>(
    "review",
    GUARDRAILS,
    `Tailored resume:\n${JSON.stringify(doc)}\n\nJob posting:\n${postingText}\n\n` +
      principlesClause() +
      "\n\nReview the draft as three specialist agents — 'ATS & keywords', 'Impact & metrics', " +
      "'Role-fit'. Each returns one or two concrete line-level edits (kind 'fix' or 'polish'), " +
      "grounded in the standards above — never a score. Be specific and actionable.",
    {
      name: "agent_review",
      description: "Return concrete line-level edits from the three review agents.",
      input_schema: {
        type: "object",
        required: ["notes"],
        properties: {
          notes: {
            type: "array",
            items: {
              type: "object",
              required: ["agent", "kind", "text"],
              properties: {
                agent: { type: "string" },
                kind: { type: "string", enum: ["fix", "polish"] },
                text: { type: "string" },
              },
            },
          },
        },
      },
    },
    2400,
    provider,
  );
  return redactPublicValue(data.notes);
}

// ---------- 4. audit agents (Ada / Max / Remy) ----------
// The three personified review cards. Their behaviors are real /apply-engine
// work: keyword coverage (Ada), impact rewriting (Max), and relevance-weighted
// line cutting to a 2-page CV (Remy). Each is grounded in the candidate's own
// resume so the feedback reads as real, not generic.

const AGENT_META: Record<
  "ats" | "impact" | "rolefit",
  {
    persona: string;
    archetype: string;
    specialty: string;
    accent: "blue" | "mint" | "navy";
    reads: string;
    kind: "coverage" | "impact" | "ranking";
  }
> = {
  ats: {
    persona: "Ada",
    archetype: "The Parser",
    specialty: "ATS & keywords",
    accent: "blue",
    reads: "Reads your resume like an ATS system",
    kind: "coverage",
  },
  impact: {
    persona: "Max",
    archetype: "The Quantifier",
    specialty: "Impact & metrics",
    accent: "mint",
    reads: "Reads your resume looking for quantified results",
    kind: "impact",
  },
  rolefit: {
    persona: "Remy",
    archetype: "The Hiring Manager",
    specialty: "Role-fit",
    accent: "navy",
    reads: "Reads your resume like a hiring manager",
    kind: "ranking",
  },
};

/** Case-insensitive occurrence count of a term (phrase-safe substring). */
function countOccurrences(haystack: string, needle: string): number {
  const n = needle.trim().toLowerCase();
  if (!n) return 0;
  const h = haystack.toLowerCase();
  let count = 0;
  let idx = h.indexOf(n);
  while (idx !== -1) {
    count++;
    idx = h.indexOf(n, idx + n.length);
  }
  return count;
}

const STAT_VALUE_RE =
  /(\$\s?\d[\d.,]*\s?(?:billion|million|bn|[kmb])?|\d[\d.,]*\s?%|\b\d[\d.,]*\s?x\b|\b\d{1,3}(?:,\d{3})+\b|\b\d+\s?\+|\b\d{2,}\b)/gi;
const STAT_STOP = new Set([
  "and", "the", "of", "in", "across", "by", "to", "a", "an", "for", "with",
  "on", "at", "using", "from", "into", "through", "that", "major", "new",
  "while", "per", "over", "today", "now", "approximately", "including",
  "such", "various", "multiple", "several", "key", "as",
  // Action verbs / gerunds: a stat's label should be the NOUN subject, not a
  // verb. Skipping these as leading words (and breaking on them when trailing)
  // turns "3% Refactored" / "doubled development productivity" into clean labels
  // or drops the artifact entirely.
  "refactored", "doubled", "successfully", "launched", "increased", "reduced",
  "improved", "managed", "led", "built", "developed", "designed", "created",
  "achieved", "delivered", "generated", "saved", "grew", "drove", "enabling",
  "tracking", "representing", "supporting", "driving", "spanning", "scaling",
  "cutting", "boosting", "growing", "reducing", "improving",
]);

/** Pull real quantified wins out of the resume: a value + a short label. */
function extractStats(
  text: string,
  max = 4,
): { value: string; label: string }[] {
  const out: { value: string; label: string }[] = [];
  const seen = new Set<string>();
  STAT_VALUE_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = STAT_VALUE_RE.exec(text)) && out.length < max) {
    // Strip whitespace and any trailing punctuation, keeping a %/x unit.
    const value = m[1]
      .replace(/\s+/g, "")
      .replace(/[.,]+([%x])?$/i, (_, u) => u || "");
    // Reject things that look like a number but aren't a quantified WIN: a bare
    // integer with no unit/comma is only an "impact" stat if it's short (a count
    // like 25, 33). Longer bare runs are years, phone numbers, zips, IDs — skip.
    const bareInt = /^\d+$/.test(value);
    if (bareInt) {
      if (/^\d{4}$/.test(value) && +value > 1900 && +value < 2100) continue; // year
      if (value.length > 3) continue; // phone / id / zip / fax — not a win
    }
    const key = value.toLowerCase();
    if (seen.has(key)) continue;
    const after = text.slice(m.index + m[0].length, m.index + m[0].length + 60);
    const words = after.replace(/^[\s\-–—:,.]+/, "").split(/\s+/).filter(Boolean);
    const label: string[] = [];
    for (const w of words) {
      const clean = w.replace(/[^A-Za-z/&-]/g, "");
      if (!clean) break;
      if (STAT_STOP.has(clean.toLowerCase())) {
        if (label.length === 0) continue; // skip a leading stopword
        break;
      }
      label.push(clean);
      if (label.length >= 3) break;
    }
    if (label.length === 0) continue;
    seen.add(key);
    out.push({
      value,
      label: label.join(" "),
    });
  }
  return out;
}

/** Choose the most illustrative before/after pair (vague → quantified). */
function pickImpactPair(bullets: TailoredBullet[]): TailoredBullet | null {
  if (!bullets.length) return null;
  const hasNum = (s: string) => /\d/.test(s);
  return (
    bullets.find((b) => b.before && b.after && hasNum(b.after) && !hasNum(b.before)) ||
    bullets.find((b) => b.before && b.after) ||
    bullets[0]
  );
}

/** Remy's relevance ranking + Max's faithful quantified wins (one AI call).
 *  Extracting the impact stats with the model (vs a regex over raw text) avoids
 *  surfacing phone-number fragments / mislabeled numbers as "wins". */
async function rankLines(
  resumeText: string,
  postingText: string,
  provider?: Provider,
): Promise<{
  lines: {
    label: string;
    score: number;
    status: "kept-top" | "kept" | "trimmed" | "cut";
    reason: string;
  }[];
  impactStats: { value: string; label: string }[];
}> {
  const data = await callTool<{
    lines: { label: string; score: number; status: string; reason?: string }[];
    impactStats: { value: string; label: string }[];
  }>(
    "review",
    GUARDRAILS,
    `Resume:\n${resumeText}\n\nJob posting:\n${postingText}\n\n` +
      "Two tasks. (1) Score the candidate's EXPERIENCE BULLETS 0–100 for " +
      "relevance to THIS posting — its keywords and core responsibilities. Only real work/" +
      "experience accomplishment bullets are eligible: never include education, degrees, the " +
      "summary, skills lists, certifications, awards, or contact lines, and never mark any of " +
      "those as 'cut'. Return the 6–8 " +
      "most informative bullets, ranked highest first: a short label (≤9 words) paraphrasing the " +
      "REAL line (faithful — no new claims), the 0–100 score, a status — 'kept-top' for " +
      "the single strongest, 'kept' for clearly relevant, 'trimmed' for marginal, 'cut' for " +
      "low-relevance lines to drop to hold two pages — and a 'reason' (≤12 words) stating WHY it " +
      "earned that score: name the specific posting keyword/responsibility it hits, or what it " +
      "lacks (e.g. 'Directly matches the posting's Kubernetes + scale focus' or 'No overlap with " +
      "this role's backend requirements'). Cut by RELEVANCE, not age. " +
      "(2) Extract up to 4 of the candidate's most impressive QUANTIFIED achievements as " +
      "{value,label} pairs: value = the metric exactly as written (e.g. '$45.7M', '38%', " +
      "'250/sec', '25-person'); label = a 2–4 word noun phrase naming what it measured (e.g. " +
      "'product development program', 'lower p95 latency'). Use ONLY numbers that appear in the " +
      "resume — never invent. Skip phone numbers, dates, addresses, and zip codes.",
    {
      name: "rank_lines",
      description: "Return ranked resume lines + the candidate's top quantified wins.",
      input_schema: {
        type: "object",
        required: ["lines", "impactStats"],
        properties: {
          lines: {
            type: "array",
            items: {
              type: "object",
              required: ["label", "score", "status", "reason"],
              properties: {
                label: { type: "string" },
                score: { type: "integer" },
                status: {
                  type: "string",
                  enum: ["kept-top", "kept", "trimmed", "cut"],
                },
                reason: { type: "string" },
              },
            },
          },
          impactStats: {
            type: "array",
            items: {
              type: "object",
              required: ["value", "label"],
              properties: {
                value: { type: "string" },
                label: { type: "string" },
              },
            },
          },
        },
      },
    },
    1800,
    provider,
  );
  const lines = (Array.isArray(data.lines) ? data.lines : [])
    .slice(0, 8)
    .map((l) => ({
      label: String(l.label || "").trim(),
      score: Number(l.score),
      status: (["kept-top", "kept", "trimmed", "cut"].includes(l.status)
        ? l.status
        : "kept") as "kept-top" | "kept" | "trimmed" | "cut",
      reason: String(l.reason || "").trim(),
    }))
    // Drop rows with a non-numeric score (would render as a contradictory 0/Kept).
    .filter((l) => l.label && Number.isFinite(l.score))
    // Defense in depth: never rank/cut non-experience lines (education, degrees,
    // skills, certs) even if the model slips one in — "cut your degree" is alarming
    // and wrong, since these aren't experience bullets.
    .filter(
      (l) =>
        !/\b(education|bachelor|masters?|doctorate|bsc|msc|mba|ph\.?d|b\.s\.|m\.s\.|degree|diploma|coursework|g\.?p\.?a|cum laude)\b/i.test(
          l.label,
        ),
    )
    .filter((l) => !containsContactInfo(l.label))
    .map((l) => ({ ...l, score: Math.max(0, Math.min(100, Math.round(l.score))) }));
  const impactStats = (Array.isArray(data.impactStats) ? data.impactStats : [])
    .map((s) => ({ value: String(s.value || "").trim(), label: String(s.label || "").trim() }))
    .filter(
      (s) =>
        s.value &&
        s.label &&
        /\d/.test(s.value) &&
        !containsContactInfo(s.value) &&
        !containsContactInfo(s.label),
    )
    .slice(0, 4);
  return { lines, impactStats };
}

// True when a line carries a hard number that isn't just a year or a date.
function hasHardMetric(line: string): boolean {
  return /\d/.test(
    line.replace(/\b(19|20)\d{2}\b/g, "").replace(/\b\d{1,2}[/-]\d{1,2}\b/g, ""),
  );
}
// Pull accomplishment bullets out of the raw résumé and split them by whether they
// already carry a number. Max reads this to name the exact lines still missing one
// (the free audit has no tailored bullets to inspect, so we read the text).
function impactBullets(resumeText: string): { withNum: string[]; needsNum: string[] } {
  const marked = resumeText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => /^[•\-*●▪·]\s+/.test(l))
    .map((l) => l.replace(/^[•\-*●▪·]\s+/, "").trim())
    .filter((l) => l.length >= 25 && /[a-z]/i.test(l));
  return {
    withNum: marked.filter(hasHardMetric),
    needsNum: marked.filter((l) => !hasHardMetric(l)),
  };
}
// A concrete, deterministic nudge for the KIND of number a bullet could take, from
// its leading verb — no LLM call, just orientation for the user.
function metricHint(text: string): string {
  const t = text.toLowerCase();
  if (/\b(led|managed|mentored|onboarded|coached|supervised|directed|hired|trained)\b/.test(t))
    return "team size or # of people";
  if (/\b(improved|increased|reduced|cut|accelerated|streamlined|boosted|grew|raised|decreased|saved|optimized)\b/.test(t))
    return "% change or time saved";
  if (/\b(drove|generated|delivered|closed|achieved|won|secured|sold)\b/.test(t))
    return "$ or % impact";
  if (/\b(built|created|developed|launched|shipped|designed|automated|implemented|standardized)\b/.test(t))
    return "count or scale";
  if (/\b(supported|maintained|handled|served|advised|prepared)\b/.test(t))
    return "# of accounts or volume";
  return "a number";
}

/** Assemble the three review agents from real pipeline outputs + one rank call. */
export async function buildAgents(
  resumeText: string,
  postingText: string,
  fit: FitBreakdown,
  bullets: TailoredBullet[],
  provider?: Provider,
): Promise<AuditAgent[]> {
  // Ada — keyword coverage (derived from the fit keywords + real occurrences).
  const keywords = (fit.keywords ?? []).slice(0, 8).map((k) => {
    const c = countOccurrences(resumeText, k.term);
    // Exact literal hits show a real count; a term the model matched as a
    // synonym/paraphrase (inResume but 0 literal hits) shows ✓, not a fake ×1.
    return {
      name: k.term,
      matched: k.inResume,
      // Literal hits show a real count; synonym/paraphrase matches and misses
      // carry no count (the chip's check icon / the "to add" box says enough).
      count: c > 0 ? `×${c}` : "",
    };
  });
  const matched = keywords.filter((k) => k.matched).length;
  const total = keywords.length;
  const missing = total - matched;
  const ats: AuditAgent = {
    id: "ats",
    ...AGENT_META.ats,
    title: "Keyword coverage",
    subtitle: "how many keywords your resume covers from the posting",
    footer:
      missing > 0
        ? "" // the graphical "to add" callout carries the advice now
        : "Every keyword the posting screens for already appears in your resume.",
    detail:
      `Ada matches the ${total} keywords this posting screens for against your resume and counts the hits. ` +
      `${matched} are covered` +
      (missing > 0 ? `, ${missing} are missing. ` : ". ") +
      "Missing terms are the biggest ATS risk; tailoring adds them only where your experience genuinely backs them.",
    matched,
    total,
    keywords,
  };

  // Remy's ranking + Max's quantified wins come from one call. Prefer the
  // model's faithful, labeled stats over the heuristic extractor (which can
  // surface phone/date fragments); fall back to the heuristic only if empty.
  let lines: AuditAgent["lines"] = [];
  let modelStats: { value: string; label: string }[] = [];
  try {
    const ranked = await rankLines(resumeText, postingText, provider);
    lines = ranked.lines.map((l, i) => ({
      rank: i + 1,
      label: l.label,
      score: l.score,
      status: l.status,
      reason: l.reason,
    }));
    modelStats = ranked.impactStats;
  } catch {
    lines = [];
    modelStats = [];
  }

  // Max — impact rewriting (faithful model-extracted wins + a before/after pair).
  const pair = pickImpactPair(bullets);
  const stats = (modelStats.length ? modelStats : extractStats(resumeText, 4)).map((s) => ({
    value: s.value,
    label: s.label,
  }));
  // How many accomplishment bullets carry a hard number, and exactly which ones
  // still need one. Prefer real bullet lines so the meter + list describe
  // accomplishments, not summary/skills lines; fall back to the looser
  // all-substantive-lines read only when a résumé has no bullet markers.
  const { withNum, needsNum } = impactBullets(resumeText);
  const haveBullets = withNum.length + needsNum.length >= 3;
  const quant = haveBullets
    ? { count: withNum.length, total: withNum.length + needsNum.length }
    : (() => {
        const lines = resumeText
          .split(/\r?\n/)
          .map((l) => l.replace(/^[\s•\-*●▪·]+/, "").trim())
          .filter((l) => l.length >= 40 && /[a-z]/i.test(l));
        return { count: lines.filter(hasHardMetric).length, total: lines.length };
      })();
  const needsList = haveBullets
    ? needsNum.slice(0, 6).map((text) => ({
        text: text.length > 96 ? text.slice(0, 95).trimEnd() + "…" : text,
        hint: metricHint(text),
      }))
    : [];
  const needsMore = haveBullets ? Math.max(0, needsNum.length - needsList.length) : 0;
  const impact: AuditAgent = {
    id: "impact",
    ...AGENT_META.impact,
    title: "Quantified impact",
    subtitle: "how many of your bullets can be quantified (backed by a number)",
    footer: "",
    detail:
      "Max scans every experience line for a measurable outcome (how many, how much, versus " +
      "what) and rewrites activity into results using only figures already in your resume. It " +
      "never invents a number.",
    before: pair?.before,
    after: pair?.after,
    stats,
    quantified: quant.total > 0 ? quant : undefined,
    needsMetric: needsList.length ? needsList : undefined,
    needsMetricMore: needsMore,
  };
  const rolefit: AuditAgent = {
    id: "rolefit",
    ...AGENT_META.rolefit,
    title: "Your bullets, ranked",
    subtitle: "how relevant each of your bullets is to this role, strongest kept",
    footer: "",
    detail:
      "Remy scores every line 0–100 for relevance to this posting, keeps the strongest, and " +
      "trims the lowest to hold a tight two pages. Lines are cut by relevance and never by age: " +
      "an older bullet that hits the posting's keywords outranks a recent one that doesn't.",
    lines,
  };

  return publicAuditAgents([ats, impact, rolefit]);
}

/** Free-audit preview: fit only, no documents (no credit spent). */
export async function runScore(
  resumeText: string,
  postingText: string,
  provider?: Provider,
): Promise<ApplyResult> {
  const { company, role, fit } = await scoreFit(resumeText, postingText, provider);
  return { company, role, fit, bullets: [], keywords: [], agentNotes: [], doc: null };
}

/**
 * Free real audit: fit + the three review agents (Ada/Max/Remy), grounded in the
 * candidate's OWN resume + posting — but NO tailoring, NO documents, NO credit.
 * This is what the signed-out preview renders so the agent audit shows the user's
 * real keyword coverage, ranked lines, and quantified wins instead of a canned
 * sample. The downloadable tailored resume + cover letter stay gated behind an
 * account + credit (`runFull`). One extra rank call vs. `runScore`; `buildAgents`
 * degrades gracefully if that call fails.
 */
export async function runAudit(
  resumeText: string,
  postingText: string,
  provider?: Provider,
): Promise<ApplyResult> {
  const { company, role, fit } = await scoreFit(resumeText, postingText, provider);
  // No tailored bullets yet (tailoring is the paid step), so Max surfaces the
  // candidate's real extracted wins; the before/after pair appears post-tailor.
  const agents = await buildAgents(resumeText, postingText, fit, [], provider);
  return { company, role, fit, bullets: [], keywords: [], agentNotes: [], agents, doc: null };
}

/** Full run: fit + tailor + review. Caller is responsible for spending a credit. */
// Token-set (Jaccard) similarity — robust to the tailor's light rephrasing
// between the showcase "after" and the shipped doc bullet.
function tokenSim(a: string, b: string): number {
  const toks = (s: string) =>
    new Set(
      s
        .toLowerCase()
        .replace(/[^a-z0-9 ]+/g, " ")
        .split(/\s+/)
        .filter((t) => t.length > 1),
    );
  const A = toks(a);
  const B = toks(b);
  if (A.size === 0 || B.size === 0) return 0;
  let inter = 0;
  for (const t of A) if (B.has(t)) inter++;
  return inter / (A.size + B.size - inter);
}

/**
 * Anchor the tailor's before/after pairs to {entry,bullet} coordinates in the
 * (post-verify) doc by best token-similarity, using the DOC's actual bullet as
 * `after` so Accept keeps exactly what ships. Each doc bullet is matched at most
 * once; pairs below the threshold are dropped (that bullet stays plain-editable).
 * Called after verifyDoc froze the doc shape, so coordinates are stable.
 */
interface BulletDiffMatchResult {
  diffs: BulletDiff[];
  unmatchedRewritePairs: number;
  bestMatchScores: number[];
}

function matchBulletDiffs(
  doc: TailoredDoc,
  pairs: TailoredBullet[],
): BulletDiffMatchResult {
  const used = new Set<string>();
  const diffs: BulletDiff[] = [];
  const bestMatchScores: number[] = [];
  for (const pair of pairs) {
    if (!pair?.after || !pair?.before) continue;
    let best: { entry: number; bullet: number; text: string } | null = null;
    let bestScore = 0;
    doc.experience.forEach((e, ei) =>
      (e.bullets || []).forEach((b, bi) => {
        const key = `${ei}:${bi}`;
        if (used.has(key)) return;
        const s = tokenSim(pair.after, b);
        if (s > bestScore) {
          bestScore = s;
          best = { entry: ei, bullet: bi, text: b };
        }
      }),
    );
    bestMatchScores.push(Number(bestScore.toFixed(3)));
    if (best && bestScore >= 0.4) {
      const b = best as { entry: number; bullet: number; text: string };
      used.add(`${b.entry}:${b.bullet}`);
      diffs.push({ entry: b.entry, bullet: b.bullet, before: pair.before, after: b.text });
    }
  }
  diffs.sort((a, b) => a.entry - b.entry || a.bullet - b.bullet);
  return {
    diffs,
    unmatchedRewritePairs: Math.max(0, bestMatchScores.length - diffs.length),
    bestMatchScores,
  };
}

interface TailorAttemptResult {
  tailored: TailorStepResult;
  verified: { doc: TailoredDoc; report: VerificationReport };
  bulletDiffs: BulletDiff[];
  diagnostics: TailorDiagnostics;
}

function tailorGateFailureReason(diagnostics: TailorDiagnostics): string | undefined {
  if (!diagnostics.finalDifferentFromSource) {
    return "final document did not materially differ from the source resume";
  }
  if (diagnostics.postVerifyRewritePairs < MIN_EDITOR_REWRITE_DIFFS) {
    return `only ${diagnostics.postVerifyRewritePairs} rewrite pairs survived verification`;
  }
  if (diagnostics.matchedBulletDiffs < MIN_EDITOR_REWRITE_DIFFS) {
    return `only ${diagnostics.matchedBulletDiffs} rewrite pairs anchored to final document bullets`;
  }
  return undefined;
}

function tailorRetryHint(previous?: TailorDiagnostics): string {
  const reason = previous?.failureReason || "the prior result did not produce enough editor-safe rewrite evidence";
  return (
    `The previous attempt failed because ${reason}. ` +
    `This attempt must include at least ${MIN_EDITOR_REWRITE_DIFFS} changed before/after ` +
    "experience bullet pairs. Each after value must match a bullet you place in doc.experience. " +
    "Avoid no-op pairs, summary lines, skill lines, education lines, and cover-letter text."
  );
}

async function finalizeTailorAttempt(
  resumeText: string,
  postingText: string,
  tailored: TailorStepResult,
  attempt: number,
  provider?: Provider,
  repairProvider?: Provider,
  repairModel?: string,
): Promise<TailorAttemptResult> {
  const preVerifyBullets = tailored.doc.experience.flatMap((entry) => entry.bullets);
  const verified = await verifyDoc(resumeText, tailored.doc, provider);
  tailored.doc = verified.doc;

  let rewritePairs = tailored.bullets;
  let walkedBackPairs = 0;
  if (verified.report.corrections.length) {
    const postVerify = new Set(
      verified.doc.experience.flatMap((entry) => entry.bullets).map((bullet) => bullet.trim()),
    );
    const walkedBack = preVerifyBullets
      .map((bullet) => bullet.trim())
      .filter((bullet) => bullet && !postVerify.has(bullet));
    if (walkedBack.length) {
      const walkedBackText = walkedBack.join("\n");
      const nextPairs = rewritePairs.filter((pair) => !resumeContains(walkedBackText, pair.after));
      walkedBackPairs = rewritePairs.length - nextPairs.length;
      rewritePairs = nextPairs;
    }
  }

  let repairPasses = 0;
  let match = matchBulletDiffs(verified.doc, rewritePairs);
  if (match.diffs.length < MIN_EDITOR_REWRITE_DIFFS) {
    repairPasses = 1;
    const repairedPairs = await repairRewriteEvidence(
      resumeText,
      postingText,
      verified.doc,
      repairProvider,
      repairModel,
    );
    const repairedMatch = matchBulletDiffs(verified.doc, repairedPairs);
    if (repairedMatch.diffs.length > match.diffs.length) {
      rewritePairs = repairedPairs;
      match = repairedMatch;
    }
  }

  tailored.bullets = rewritePairs;
  const diagnostics: TailorDiagnostics = {
    qualityGate: "failed",
    attempts: attempt,
    repairPasses,
    rawRewritePairs: tailored.diagnostics.rawRewritePairs,
    changedRewritePairs: tailored.diagnostics.changedRewritePairs,
    noOpRewritePairs: tailored.diagnostics.noOpRewritePairs,
    documentRepairPasses: tailored.diagnostics.documentRepairPasses,
    postVerifyRewritePairs: rewritePairs.length,
    verifyCorrections: verified.report.corrections.length,
    walkedBackPairs,
    finalDocBulletCount: docBulletCount(verified.doc),
    matchedBulletDiffs: match.diffs.length,
    unmatchedRewritePairs: match.unmatchedRewritePairs,
    bestMatchScores: match.bestMatchScores,
    finalDifferentFromSource: docMateriallyDiffersFromSource(resumeText, verified.doc),
  };
  const failureReason = tailorGateFailureReason(diagnostics);
  diagnostics.qualityGate = failureReason ? "failed" : "passed";
  if (failureReason) diagnostics.failureReason = failureReason;

  return {
    tailored,
    verified,
    bulletDiffs: match.diffs,
    diagnostics,
  };
}

export async function runFull(
  resumeText: string,
  postingText: string,
  provider?: Provider,
): Promise<ApplyResult> {
  // Tiered models: the fit + review steps stay on the cheap base provider, while
  // the tailor step (the paid customer deliverable) runs on the premium
  // TAILOR_PROVIDER/MODEL for faithfulness. If a provider is explicitly pinned
  // (e.g. /api/compare runs one provider end to end), honor it for every step.
  const tailorProvider =
    provider ?? (tailorProviderConfigured ? TAILOR_PROVIDER : undefined);
  const tailorModel = provider
    ? undefined
    : tailorProviderConfigured
      ? TAILOR_MODEL
      : undefined;

  const { company, role, fit } = await scoreFit(resumeText, postingText, provider);
  let prepared: TailorAttemptResult | null = null;
  for (let attempt = 1; attempt <= MAX_TAILOR_QUALITY_ATTEMPTS; attempt++) {
    const tailoredAttempt = await tailor(
      resumeText,
      postingText,
      tailorProvider,
      tailorModel,
      attempt > 1 ? tailorRetryHint(prepared?.diagnostics) : undefined,
    );
    prepared = await finalizeTailorAttempt(
      resumeText,
      postingText,
      tailoredAttempt,
      attempt,
      provider,
      tailorProvider,
      tailorModel,
    );
    if (prepared.diagnostics.qualityGate === "passed") break;
    // A short resume (few experience bullets) legitimately can't reach the
    // ideal rewrite-count target — retrying would only pressure the model to
    // manufacture rewrites. Once the draft is genuinely tailored and has at
    // least one tracked change, stop and ship it rather than burning a retry.
    if (
      prepared.diagnostics.finalDifferentFromSource &&
      prepared.diagnostics.matchedBulletDiffs >= 1 &&
      prepared.diagnostics.finalDocBulletCount <= MIN_EDITOR_REWRITE_DIFFS + 1
    ) {
      break;
    }
  }
  // The rewrite-count target is a quality SIGNAL, not a hard wall: ship the draft
  // as long as it genuinely differs from the source AND carries at least one
  // reviewable before/after change. Only refuse when tailoring did effectively
  // nothing (draft ≈ source, or no tracked rewrites at all) — so a short resume
  // tailors successfully instead of dead-ending the paid run.
  if (
    !prepared ||
    (prepared.diagnostics.qualityGate !== "passed" &&
      (!prepared.diagnostics.finalDifferentFromSource ||
        prepared.diagnostics.matchedBulletDiffs < 1))
  ) {
    throw new Error(
      `The tailoring step did not produce enough verifiable bullet rewrites (${prepared?.diagnostics.failureReason ?? "quality gate failed"}). Please try again.`,
    );
  }

  const { tailored, verified, bulletDiffs, diagnostics } = prepared;
  // Faithfulness pass: re-read every shipped line against the source resume and
  // repair misattributed / unsupported / inflated claims BEFORE review and
  // delivery. Runs on the base provider (like score/review) to keep the premium
  // model spend on the tailoring itself. Best-effort — never blocks the result.
  // Capture the pre-verify bullets so we can tell which lines the pass actually
  // rewrote. The showcase "after" strings are independent tailor output (not
  // verbatim doc substrings), so filtering them against whole-doc membership
  // would wrongly blank the entire "what changed" panel on any corrected run.
  // If the pass corrected something, drop only the before/after samples whose
  // "after" matches a draft line the pass actually walked back — so we never
  // advertise a rewrite we reversed, while valid samples survive. (No-op in the
  // common, clean case.)
  // The dashboard's agent-notes review and the three personified audit cards are
  // independent — run them together to keep the full-run latency down.
  const [agentNotes, agents] = await Promise.all([
    review(tailored.doc, postingText, provider),
    buildAgents(resumeText, postingText, fit, tailored.bullets, provider),
  ]);
  // Anchor before/after pairs to doc coordinates for the editor's diff rows, and
  // snapshot the AI draft so the editor can offer "reset to AI version".
  const originalDoc = JSON.parse(JSON.stringify(tailored.doc)) as TailoredDoc;

  return {
    company,
    role,
    fit,
    bullets: tailored.bullets,
    keywords: tailored.keywords,
    agentNotes,
    agents,
    doc: tailored.doc,
    originalDoc,
    bulletDiffs,
    verification: verified.report,
    tailorDiagnostics: diagnostics,
  };
}
