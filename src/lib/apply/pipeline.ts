import "server-only";
import { structured, type Provider, type Step } from "@/lib/apply/llm";
import {
  TAILOR_MODEL,
  TAILOR_PROVIDER,
  tailorProviderConfigured,
} from "@/lib/config";
import type {
  AgentNote,
  ApplyResult,
  FitBreakdown,
  ResumeStats,
  TailoredBullet,
  TailoredDoc,
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
  "'recruiter-ready'. Stay strictly faithful to the source resume: do not invent or inflate " +
  "metrics, numbers, percentages, dates, tenure, job titles, technologies, or " +
  "responsibilities, and do not upgrade verbs beyond what the resume supports (e.g. " +
  "'built/maintained' is not 'architected/owned'). Re-frame and tailor what is actually " +
  "there; if it is not in the resume, do not claim it. Plain text only — no HTML or markdown.";

// ---------- 0. resume parse (free-audit "what we found" step) ----------
const PARSE_SYSTEM =
  "You are a precise resume parser and ATS reviewer. Extract ONLY what is actually in " +
  "the resume — never invent skills, numbers, roles, or dates. From the text: identify " +
  "the candidate's name and primary (most-recent) role title; estimate total years of " +
  "professional experience from the earliest to the latest dates; count the experience " +
  "bullet points and how many contain a quantified result (a %, $, a count, a time/scale " +
  "figure like '40k', 'p95', '3x'); list the concrete hard skills and tools named " +
  "(8–20, deduplicated, as written); pick 4–6 representative experience bullets verbatim " +
  "and mark which contain a metric; and give 2–3 specific, evidence-based weaknesses that " +
  "show the resume undersells the candidate (e.g. 'Only 3 of 18 bullets quantify impact', " +
  "'Summary is generic', 'Skills are buried in prose, not scannable'). Plain text only.";

/** AI parse: a structured ATS profile from raw resume text. Powers the free
 * upload step (real data + the "your resume needs work" case). */
export async function parseResume(
  resumeText: string,
  provider?: Provider,
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
    weaknesses: string[];
  }>(
    "parse",
    PARSE_SYSTEM,
    `Resume:\n${resumeText}\n\nReturn the structured ATS profile for this resume.`,
    {
      name: "report_profile",
      description: "Return the structured resume profile + ATS weaknesses.",
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
          "weaknesses",
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
          weaknesses: { type: "array", items: { type: "string" } },
        },
      },
    },
    1600,
    provider,
  );

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
    skills: Array.isArray(data.skills) ? data.skills.slice(0, 24) : [],
    sampleBullets: Array.isArray(data.sampleBullets)
      ? data.sampleBullets.slice(0, 6)
      : [],
    weaknesses: Array.isArray(data.weaknesses) ? data.weaknesses.slice(0, 3) : [],
  };
}

// ---------- 1. fit scoring (free audit + full run) ----------
export async function scoreFit(
  resumeText: string,
  postingText: string,
  provider?: Provider,
): Promise<{ company: string; role: string; fit: FitBreakdown }> {
  const data = await callTool<{
    company: string;
    role: string;
    overall: number;
    verdict: string;
    locationPass: boolean;
    locationNote: string;
    summary: string;
    dimensions: {
      label: string;
      score: number;
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
      "For each, list concrete matched evidence from the resume and gaps that are likely " +
      "present but unwritten (frame gaps as missing evidence, not missing experience). " +
      "Also extract the 8–12 most important keywords/skills the posting screens for, and " +
      "for each mark whether the resume already contains it (inResume true/false). " +
      "Judge Location & logistics as pass/fail with a one-line reason. Give an overall " +
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
          "locationPass",
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
          locationPass: { type: "boolean" },
          locationNote: { type: "string" },
          summary: { type: "string" },
          dimensions: {
            type: "array",
            items: {
              type: "object",
              required: ["label", "score", "matched", "gaps"],
              properties: {
                label: { type: "string" },
                score: { type: "integer" },
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
  );

  return {
    company: data.company,
    role: data.role,
    fit: {
      overall: data.overall,
      verdict: data.verdict,
      dimensions: data.dimensions,
      locationPass: data.locationPass,
      locationNote: data.locationNote,
      summary: data.summary,
      keywords: Array.isArray(data.keywords) ? data.keywords.slice(0, 14) : [],
    },
  };
}

// ---------- 2. tailor (rewrite + assemble documents) ----------

/** A tailor result is only usable if the model actually filled the arrays the
 * UI and PDF renderer depend on. Guards against forced-tool-use dropping
 * `required` fields (observed on some Anthropic models for certain resumes). */
function tailorResultComplete(r: {
  bullets?: unknown;
  keywords?: unknown;
  doc?: TailoredDoc;
}): boolean {
  return (
    !!r?.doc &&
    Array.isArray(r.doc.experience) &&
    r.doc.experience.length > 0 &&
    Array.isArray(r.doc.skills) &&
    Array.isArray(r.bullets) &&
    Array.isArray(r.keywords)
  );
}

async function tailor(
  resumeText: string,
  postingText: string,
  provider?: Provider,
  model?: string,
): Promise<{ bullets: TailoredBullet[]; keywords: string[]; doc: TailoredDoc }> {
  type TailorResult = {
    bullets: TailoredBullet[];
    keywords: string[];
    doc: TailoredDoc;
  };
  const run = () =>
    callTool<TailorResult>(
    "tailor",
    GUARDRAILS,
    `Resume:\n${resumeText}\n\nJob posting:\n${postingText}\n\n` +
      "Rewrite this resume for THIS posting: re-rank bullets by relevance, translate tasks " +
      "into impact with real numbers where the resume supports them, and align keywords only " +
      "where backed by experience. Keep the resume to a tight TWO PAGES: include the most " +
      "relevant roles most-recent-first (at most 6 entries), 3–5 bullets for recent roles and " +
      "2–3 for older ones, a 1–2 sentence summary, and about 10–15 skills — prioritize " +
      "relevance over completeness. Return: a few before/after bullet pairs (the strongest " +
      "rewrites), the aligned keywords, and a complete tailored document (name, headline, " +
      "contact line, 1–2 sentence summary, experience entries with rewritten bullets, skills, " +
      "and a 3-paragraph cover letter). Plain text only.",
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
              headline: { type: "string" },
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
  let result = await run();
  if (!tailorResultComplete(result)) result = await run();
  if (!tailorResultComplete(result)) {
    throw new Error(
      "The tailoring step returned an incomplete document. Please try again.",
    );
  }
  return result;
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
      "Review the draft as three specialist agents — 'ATS & keywords', 'Impact & metrics', " +
      "'Role-fit'. Each returns one or two concrete line-level edits (kind 'fix' or 'polish'), " +
      "never a score. Be specific and actionable.",
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
  return data.notes;
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

/** Full run: fit + tailor + review. Caller is responsible for spending a credit. */
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
  const tailored = await tailor(
    resumeText,
    postingText,
    tailorProvider,
    tailorModel,
  );
  const agentNotes = await review(tailored.doc, postingText, provider);
  return {
    company,
    role,
    fit,
    bullets: tailored.bullets,
    keywords: tailored.keywords,
    agentNotes,
    doc: tailored.doc,
  };
}
