import "server-only";
import { structured, type Provider, type Step } from "@/lib/apply/llm";
import type {
  AgentNote,
  ApplyResult,
  FitBreakdown,
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
  }>(
    "score",
    GUARDRAILS,
    `Resume:\n${resumeText}\n\nJob posting:\n${postingText}\n\n` +
      "Extract the company and role, then score fit across exactly these four 0–100 " +
      "dimensions: Technical skills, Experience match, Culture fit, Career alignment. " +
      "For each, list concrete matched evidence from the resume and gaps that are likely " +
      "present but unwritten (frame gaps as missing evidence, not missing experience). " +
      "Also judge Location & logistics as pass/fail with a one-line reason. Give an overall " +
      "0–100, a verdict tier (Strong fit / Good fit / Moderate fit / Weak fit / Poor fit), " +
      "and a one-sentence summary starting 'Why <overall> — <verdict>:'.",
    {
      name: "report_fit",
      description: "Return the structured five-dimension fit assessment.",
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
    },
  };
}

// ---------- 2. tailor (rewrite + assemble documents) ----------
async function tailor(
  resumeText: string,
  postingText: string,
  provider?: Provider,
  model?: string,
): Promise<{ bullets: TailoredBullet[]; keywords: string[]; doc: TailoredDoc }> {
  return callTool(
    "tailor",
    GUARDRAILS,
    `Resume:\n${resumeText}\n\nJob posting:\n${postingText}\n\n` +
      "Rewrite this resume for THIS posting: re-rank bullets by relevance, translate tasks " +
      "into impact with real numbers where the resume supports them, and align keywords only " +
      "where backed by experience. Return: a few before/after bullet pairs (the strongest " +
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
  const { company, role, fit } = await scoreFit(resumeText, postingText, provider);
  const tailored = await tailor(resumeText, postingText, provider);
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
