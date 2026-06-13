import { beforeAll, describe, expect, it, vi } from "vitest";

// Mock the Anthropic SDK: every forced-tool call returns a canned tool_use
// input keyed by the requested tool name. Lets us test the pipeline's
// orchestration + shaping without a network call or API key.
vi.mock("@anthropic-ai/sdk", () => {
  const FIXTURES: Record<string, unknown> = {
    report_fit: {
      company: "Nordpeak Systems",
      role: "Senior Platform Engineer",
      overall: 84,
      verdict: "Strong fit",
      locationPass: true,
      locationNote: "Remote EU — profile lists Copenhagen",
      summary: "Why 84 — strong fit: platform work lines up.",
      dimensions: [
        { label: "Technical skills", score: 88, matched: ["Node.js"], gaps: [] },
        { label: "Experience match", score: 80, matched: ["7 yrs"], gaps: [] },
      ],
    },
    tailor_resume: {
      bullets: [{ before: "Did things", after: "Led migration cutting p95 38%" }],
      keywords: ["Distributed systems", "Kubernetes"],
      doc: {
        name: "Alex Mercer",
        headline: "Senior Platform Engineer",
        contact: "Copenhagen",
        summary: "Platform engineer.",
        experience: [
          { role: "SSE", company: "Brightline", dates: "2019–now", bullets: ["x"] },
        ],
        skills: ["Node.js"],
        coverLetter: "Dear team,\n\nHello.\n\nSincerely.",
      },
    },
    agent_review: {
      notes: [
        { agent: "ATS & keywords", kind: "fix", text: "Add observability." },
        { agent: "Impact & metrics", kind: "polish", text: "Add a baseline." },
      ],
    },
  };
  class FakeAnthropic {
    messages = {
      create: async (params: { tools: { name: string }[] }) => {
        const name = params.tools[0].name;
        return { content: [{ type: "tool_use", name, input: FIXTURES[name] }] };
      },
    };
  }
  return { default: FakeAnthropic };
});

let runScore: typeof import("./pipeline").runScore;
let runFull: typeof import("./pipeline").runFull;

beforeAll(async () => {
  process.env.ANTHROPIC_API_KEY = "sk-ant-test";
  const mod = await import("./pipeline");
  runScore = mod.runScore;
  runFull = mod.runFull;
});

describe("apply pipeline", () => {
  it("runScore returns fit only, no documents", async () => {
    const r = await runScore("resume", "posting");
    expect(r.company).toBe("Nordpeak Systems");
    expect(r.role).toBe("Senior Platform Engineer");
    expect(r.fit.overall).toBe(84);
    expect(r.fit.dimensions).toHaveLength(2);
    expect(r.doc).toBeNull();
    expect(r.bullets).toEqual([]);
    expect(r.agentNotes).toEqual([]);
  });

  it("runFull returns fit + tailored doc + bullets + agent notes", async () => {
    const r = await runFull("resume", "posting");
    expect(r.fit.overall).toBe(84);
    expect(r.bullets[0].after).toContain("p95");
    expect(r.keywords).toContain("Kubernetes");
    expect(r.doc?.name).toBe("Alex Mercer");
    expect(r.doc?.experience).toHaveLength(1);
    expect(r.agentNotes.map((n) => n.agent)).toContain("ATS & keywords");
  });
});
