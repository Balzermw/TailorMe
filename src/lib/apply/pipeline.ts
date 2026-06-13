import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { ANTHROPIC_API_KEY, ANTHROPIC_MODEL } from "@/lib/config";
import type {
  AgentNote,
  ApplyResult,
  FitBreakdown,
  TailoredBullet,
  TailoredDoc,
} from "@/lib/types";

const client = ANTHROPIC_API_KEY
  ? new Anthropic({ apiKey: ANTHROPIC_API_KEY })
  : null;

// Generic forced-tool call → returns the validated structured input object.
async function callTool<T>(
  system: string,
  user: string,
  tool: { name: string; description: string; input_schema: Anthropic.Tool.InputSchema },
  maxTokens = 2400,
): Promise<T> {
  if (!client) throw new Error("Anthropic not configured");
  const msg = await client.messages.create({
    model: ANTHROPIC_MODEL,
    max_tokens: maxTokens,
    system,
    tools: [tool],
    tool_choice: { type: "tool", name: tool.name },
    messages: [{ role: "user", content: user }],
  });
  const block = msg.content.find((b) => b.type === "tool_use");
  if (!block || block.type !== "tool_use") {
    throw new Error("No structured output returned");
  }
  return block.input as T;
}

const GUARDRAILS =
  "You are TailorMe, built by Res.Me (technical resume writers). Voice: confident, " +
  "empathetic, specific — concrete numbers, never hype. Sentence case. NEVER promise " +
  "jobs, interviews, salary increases, or ATS-bypass. Say 'interview-ready' / " +
  "'recruiter-ready'. Only claim keywords the candidate's experience actually supports. " +
  "Plain text only in every field — no HTML or markdown.";

// ---------- 1. fit scoring (free audit + full run) ----------
export async function scoreFit(
  resumeText: string,
  postingText: string,
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
): Promise<{ bullets: TailoredBullet[]; keywords: string[]; doc: TailoredDoc }> {
  return callTool(
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
  );
}

// ---------- 3. agent review ----------
async function review(
  doc: TailoredDoc,
  postingText: string,
): Promise<AgentNote[]> {
  const data = await callTool<{ notes: AgentNote[] }>(
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
  );
  return data.notes;
}

/** Free-audit preview: fit only, no documents (no credit spent). */
export async function runScore(
  resumeText: string,
  postingText: string,
): Promise<ApplyResult> {
  const { company, role, fit } = await scoreFit(resumeText, postingText);
  return { company, role, fit, bullets: [], keywords: [], agentNotes: [], doc: null };
}

/** Full run: fit + tailor + review. Caller is responsible for spending a credit. */
export async function runFull(
  resumeText: string,
  postingText: string,
): Promise<ApplyResult> {
  const { company, role, fit } = await scoreFit(resumeText, postingText);
  const tailored = await tailor(resumeText, postingText);
  const agentNotes = await review(tailored.doc, postingText);
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
