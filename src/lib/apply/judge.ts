import "server-only";
import { structured, type Provider } from "@/lib/apply/llm";
import type { TailoredDoc } from "@/lib/types";

// LLM-as-judge: a top-tier model scores anonymized tailored resumes against the
// original resume + posting. Used by /api/eval to rank the generator ladder.

export interface Candidate {
  letter: string;
  doc: TailoredDoc;
}

export interface JudgeScore {
  candidate: string;
  faithfulness: number; // no fabrication vs the original resume
  tailoring: number; // fit to the posting
  impact: number; // clarity/strength of the rewriting
  formatting: number; // professional, correct capitalization
  overall: number;
  note: string;
}

export interface Judgment {
  rankings: JudgeScore[];
  winner: string;
  reasoning: string;
}

const JUDGE_SCHEMA = {
  type: "object",
  required: ["rankings", "winner", "reasoning"],
  properties: {
    rankings: {
      type: "array",
      items: {
        type: "object",
        required: [
          "candidate",
          "faithfulness",
          "tailoring",
          "impact",
          "formatting",
          "overall",
          "note",
        ],
        properties: {
          candidate: { type: "string" },
          faithfulness: { type: "integer" },
          tailoring: { type: "integer" },
          impact: { type: "integer" },
          formatting: { type: "integer" },
          overall: { type: "integer" },
          note: { type: "string" },
        },
      },
    },
    winner: { type: "string" },
    reasoning: { type: "string" },
  },
};

function candidateBlock(c: Candidate): string {
  const exp = c.doc.experience
    .map(
      (e) =>
        `- ${e.role} @ ${e.company} (${e.dates}): ${e.bullets.join(" | ")}`,
    )
    .join("\n");
  return `### Candidate ${c.letter}
Summary: ${c.doc.summary}
Experience:
${exp}
Skills: ${c.doc.skills.join(", ")}
Cover letter: ${c.doc.coverLetter}`;
}

export async function judge(
  resumeText: string,
  postingText: string,
  candidates: Candidate[],
  provider: Provider,
  model: string,
): Promise<Judgment> {
  const system =
    "You are a senior technical recruiter and resume expert judging tailored " +
    "resumes. Be rigorous and specific. Heavily penalize any fabricated facts, " +
    "metrics, job titles, dates, or skills that are NOT supported by the " +
    "original resume. Reward genuine tailoring to the posting, clear and " +
    "credible impact framing, and professional formatting (normal " +
    "capitalization — flag all-lowercase or ALL CAPS as a formatting defect). " +
    "Never reward unverifiable or inflated claims.";
  const user =
    `ORIGINAL RESUME:\n${resumeText}\n\nJOB POSTING:\n${postingText}\n\n` +
    `CANDIDATE TAILORED OUTPUTS (anonymized — judge on merit, not style preference):\n\n` +
    candidates.map(candidateBlock).join("\n\n") +
    `\n\nScore EVERY candidate 0–100 on: faithfulness (no fabrication vs the ` +
    `original), tailoring (fit to the posting), impact (clarity/strength), and ` +
    `formatting (professional capitalization). Give an overall 0–100 and a ` +
    `one-line note each. Then name the single best candidate letter and explain why.`;

  return structured<Judgment>({
    step: "review",
    system,
    user,
    name: "judge_candidates",
    description: "Rank the anonymized candidate tailored resumes.",
    schema: JUDGE_SCHEMA,
    maxTokens: 2000,
    provider,
    model,
  });
}
