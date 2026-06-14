import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

// Captures the (tool name, model) of every forced-tool call so tests can assert
// per-step model routing. Hoisted so the vi.mock factory can close over it.
const { calls } = vi.hoisted(() => ({
  calls: [] as { name: string; model: string }[],
}));

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
      create: async (params: { model: string; tools: { name: string }[] }) => {
        const name = params.tools[0].name;
        calls.push({ name, model: params.model });
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

beforeEach(() => {
  calls.length = 0;
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

  it("runFull routes the tailor step to the premium model, fit/review to the base", async () => {
    await runFull("resume", "posting");
    const byTool = Object.fromEntries(calls.map((c) => [c.name, c.model]));
    // Tailor (paid deliverable) → premium override; fit + review → base model.
    expect(byTool.tailor_resume).toBe("claude-opus-4-8");
    expect(byTool.report_fit).toBe("claude-sonnet-4-6");
    expect(byTool.agent_review).toBe("claude-sonnet-4-6");
  });

  it("runScore (free audit) uses only the base model, never the premium one", async () => {
    await runScore("resume", "posting");
    expect(calls).toHaveLength(1);
    expect(calls[0].name).toBe("report_fit");
    expect(calls[0].model).toBe("claude-sonnet-4-6");
  });
});
