import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const EXPECTED_BULLETS = [
  "Built Node.js services for platform teams while cutting p95 latency 38%.",
  "Maintained Kubernetes jobs supporting reliable platform deployments.",
  "Improved observability dashboards for faster incident response.",
];

const REPAIRED_BULLETS = [
  "Built Node.js services for platform teams while cutting p95 latency 38% with source-safe wording.",
  "Maintained Kubernetes jobs supporting reliable platform deployments with source-safe wording.",
  "Improved observability dashboards for faster incident response with source-safe wording.",
];

// Captures the (tool name, model) of every forced-tool call so tests can assert
// per-step model routing. Hoisted so the vi.mock factory can close over it.
const { calls, fixtureOverrides } = vi.hoisted(() => ({
  calls: [] as { name: string; model: string }[],
  // Per-test fixture overrides keyed by tool name. An Error value makes that
  // tool call throw, to exercise best-effort fallback paths.
  fixtureOverrides: {} as Record<string, unknown>,
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
      bullets: [
        {
          before: "Built Node.js services for platform teams.",
          after: "Built Node.js services for platform teams while cutting p95 latency 38%.",
        },
        {
          before: "Maintained Kubernetes jobs.",
          after: "Maintained Kubernetes jobs supporting reliable platform deployments.",
        },
        {
          before: "Improved observability dashboards.",
          after: "Improved observability dashboards for faster incident response.",
        },
      ],
      keywords: ["Distributed systems", "Kubernetes"],
      doc: {
        name: "Alex Mercer",
        headline: "Senior Platform Engineer",
        contact: "Copenhagen",
        summary: "Platform engineer.",
        experience: [
          {
            role: "SSE",
            company: "Brightline",
            dates: "2019–now",
            bullets: [
              "Built Node.js services for platform teams while cutting p95 latency 38%.",
              "Maintained Kubernetes jobs supporting reliable platform deployments.",
              "Improved observability dashboards for faster incident response.",
            ],
          },
        ],
        skills: ["Node.js"],
        coverLetter: "Dear team,\n\nHello.\n\nSincerely.",
      },
    },
    repair_rewrite_evidence: {
      bullets: [
        {
          before: "Built Node.js services for platform teams.",
          after: "Built Node.js services for platform teams while cutting p95 latency 38%.",
        },
        {
          before: "Maintained Kubernetes jobs.",
          after: "Maintained Kubernetes jobs supporting reliable platform deployments.",
        },
        {
          before: "Improved observability dashboards.",
          after: "Improved observability dashboards for faster incident response.",
        },
      ],
    },
    agent_review: {
      notes: [
        { agent: "ATS & keywords", kind: "fix", text: "Add observability." },
        { agent: "Impact & metrics", kind: "polish", text: "Add a baseline." },
      ],
    },
    report_profile: {
      name: "Alex Mercer",
      primaryRole: "Senior Platform Engineer",
      yearsExperience: 7,
      roleCount: 1,
      bulletCount: 2,
      metricBulletCount: 0,
      skills: ["Node.js", "alex@example.com"],
      sampleBullets: [
        { text: "Built Node.js services for platform teams.", hasMetric: false },
        { text: "Contact alex@example.com for details.", hasMetric: false },
      ],
      proofPoints: [
        {
          title: "Contact detail used as evidence",
          summary: "The email alex@example.com should never appear in public audit feedback.",
          quote: "alex@example.com",
          why: "An email is contact information, not resume evidence.",
          fix: "Keep contact details in the header only.",
          severity: "high",
        },
      ],
    },
    rank_lines: {
      lines: [
        { label: "Built platform services", score: 91, status: "kept-top" },
        { label: "Email alex@example.com", score: 12, status: "cut" },
      ],
      impactStats: [
        { value: "38%", label: "lower p95 latency" },
        { value: "555-222-1212", label: "contact phone" },
      ],
    },
    // Faithfulness pass: same shape as tailor_resume's doc, no corrections → "clean".
    verify_faithfulness: {
      summary: "Platform engineer.",
      experience: [
        {
          role: "SSE",
          company: "Brightline",
          dates: "2019–now",
          bullets: [
            "Built Node.js services for platform teams while cutting p95 latency 38%.",
            "Maintained Kubernetes jobs supporting reliable platform deployments.",
            "Improved observability dashboards for faster incident response.",
          ],
        },
      ],
      corrections: [],
    },
  };
  class FakeAnthropic {
    messages = {
      create: async (params: { model: string; tools: { name: string }[] }) => {
        const name = params.tools[0].name;
        calls.push({ name, model: params.model });
        const input = name in fixtureOverrides ? fixtureOverrides[name] : FIXTURES[name];
        if (input instanceof Error) throw input; // exercise best-effort fallbacks
        // Clone so the pipeline can't mutate a shared fixture across tests (a real
        // API returns fresh objects each call); otherwise an adopted repair in one
        // test leaks into later ones.
        return { content: [{ type: "tool_use", name, input: structuredClone(input) }] };
      },
    };
  }
  return { default: FakeAnthropic };
});

let runScore: typeof import("./pipeline").runScore;
let runFull: typeof import("./pipeline").runFull;
let runAudit: typeof import("./pipeline").runAudit;
let parseResume: typeof import("./pipeline").parseResume;
let redactContactInfoForPublicOutput: typeof import("./pipeline").redactContactInfoForPublicOutput;

beforeAll(async () => {
  process.env.ANTHROPIC_API_KEY = "sk-ant-test";
  const mod = await import("./pipeline");
  runScore = mod.runScore;
  runFull = mod.runFull;
  runAudit = mod.runAudit;
  parseResume = mod.parseResume;
  redactContactInfoForPublicOutput = mod.redactContactInfoForPublicOutput;
});

beforeEach(() => {
  calls.length = 0;
  for (const k of Object.keys(fixtureOverrides)) delete fixtureOverrides[k];
});

function tailoredDocFixture(bullets = EXPECTED_BULLETS) {
  return {
    name: "Alex Mercer",
    headline: "Senior Platform Engineer",
    contact: "Copenhagen",
    summary: "Platform engineer.",
    experience: [
      {
        role: "SSE",
        company: "Brightline",
        dates: "2019-now",
        bullets,
      },
    ],
    skills: ["Node.js"],
    coverLetter: "Dear team.\n\nHello.\n\nSincerely.",
  };
}

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
    expect(r.bulletDiffs).toHaveLength(3);
    expect(r.tailorDiagnostics?.qualityGate).toBe("passed");
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

  it("repairs missing rewrite evidence before storing the full result", async () => {
    fixtureOverrides.tailor_resume = {
      bullets: [],
      keywords: ["Distributed systems", "Kubernetes"],
      doc: tailoredDocFixture(),
    };

    const r = await runFull("resume", "posting");

    expect(r.bulletDiffs).toHaveLength(3);
    expect(r.tailorDiagnostics?.qualityGate).toBe("passed");
    expect(r.tailorDiagnostics?.repairPasses).toBe(1);
    expect(r.tailorDiagnostics?.rawRewritePairs).toBe(0);
    expect(calls.some((c) => c.name === "repair_rewrite_evidence")).toBe(true);
  });

  it("repairs incomplete tailor documents before review and storage", async () => {
    fixtureOverrides.tailor_resume = {
      bullets: [],
      keywords: ["Distributed systems"],
      doc: { name: "Alex Mercer", headline: "Senior Platform Engineer" },
    };
    fixtureOverrides.repair_tailored_document = {
      bullets: [
        {
          before: "Built Node.js services for platform teams.",
          after: EXPECTED_BULLETS[0],
        },
        {
          before: "Maintained Kubernetes jobs.",
          after: EXPECTED_BULLETS[1],
        },
        {
          before: "Improved observability dashboards.",
          after: EXPECTED_BULLETS[2],
        },
      ],
      keywords: ["Distributed systems", "Kubernetes"],
      doc: tailoredDocFixture(),
    };

    const r = await runFull("resume", "posting");

    expect(r.doc?.experience[0].bullets).toEqual(EXPECTED_BULLETS);
    expect(r.bulletDiffs).toHaveLength(3);
    expect(r.tailorDiagnostics?.qualityGate).toBe("passed");
    expect(r.tailorDiagnostics?.documentRepairPasses).toBe(1);
    expect(calls.filter((c) => c.name === "tailor_resume")).toHaveLength(2);
    expect(calls.some((c) => c.name === "repair_tailored_document")).toBe(true);
    expect(calls.some((c) => c.name === "agent_review")).toBe(true);
  });

  it("rejects incomplete tailor documents when focused repair still cannot render experience", async () => {
    fixtureOverrides.tailor_resume = {
      bullets: [],
      keywords: ["Distributed systems"],
      doc: { name: "Alex Mercer", headline: "Senior Platform Engineer" },
    };
    fixtureOverrides.repair_tailored_document = {
      bullets: [],
      keywords: ["Distributed systems"],
      doc: { name: "Alex Mercer", headline: "Senior Platform Engineer" },
    };

    await expect(runFull("resume", "posting")).rejects.toThrow(/incomplete document/);
    expect(calls.some((c) => c.name === "repair_tailored_document")).toBe(true);
    expect(calls.some((c) => c.name === "agent_review")).toBe(false);
  });

  it("rejects full results that cannot produce three anchored rewrite rows", async () => {
    fixtureOverrides.tailor_resume = {
      bullets: [],
      keywords: ["Distributed systems", "Kubernetes"],
      doc: tailoredDocFixture(),
    };
    fixtureOverrides.repair_rewrite_evidence = { bullets: [] };

    await expect(runFull("resume", "posting")).rejects.toThrow(/verifiable bullet rewrites/);
    expect(calls.filter((c) => c.name === "tailor_resume")).toHaveLength(2);
    expect(calls.some((c) => c.name === "agent_review")).toBe(false);
  });
});

describe("public audit output hygiene", () => {
  const piiPattern =
    /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b|\b(?:\+?1[-.\s]?)?(?:\(?\d{3}\)?[-.\s]?)\d{3}[-.\s]?\d{4}\b|linkedin\.com\/[^\s"'<>]+|\b\d{1,6}\s+[A-Z][A-Za-z0-9.'-]*(?:\s+[A-Z][A-Za-z0-9.'-]*){0,4}\s+(?:St|Street|Ave|Avenue|Rd|Road|Blvd|Drive|Dr|Lane|Ln|Court|Ct)\b/i;

  it("redacts contact details from public review text", () => {
    const redacted = redactContactInfoForPublicOutput(
      "Email alex@example.com, call 555-222-1212, see linkedin.com/in/alex, or visit 123 Market St.",
    );

    expect(redacted).not.toMatch(piiPattern);
    expect(redacted).toContain("the contact email");
    expect(redacted).toContain("the contact phone");
    expect(redacted).toContain("the LinkedIn profile");
    expect(redacted).toContain("the street address");
  });

  it("keeps parse proof points and sample bullets free of contact snippets", async () => {
    const stats = await parseResume(
      "Alex Mercer\nalex@example.com\nBuilt Node.js services for platform teams.\nContact alex@example.com for details.",
    );
    const publicText = JSON.stringify(stats);

    expect(publicText).not.toMatch(piiPattern);
    expect(stats.skills).toEqual(["Node.js"]);
    expect((stats.sampleBullets ?? []).map((b) => b.text)).toEqual([
      "Built Node.js services for platform teams.",
    ]);
    expect(stats.proofPoints?.[0]?.quote).toBeUndefined();
  });

  it("redacts audit result fields and always includes quantified-impact guidance", async () => {
    fixtureOverrides.report_fit = {
      company: "Nordpeak Systems",
      role: "Senior Platform Engineer",
      overall: 84,
      verdict: "Strong fit",
      locationStatus: "unclear",
      locationNote: "Contact alex@example.com is listed, but location is unclear.",
      summary: "Why 84 - strong fit: call 555-222-1212 should not be visible.",
      dimensions: [
        {
          label: "Technical skills",
          score: 88,
          matched: ["Node.js", "linkedin.com/in/alex"],
          gaps: ["Would need proof beyond 123 Market St."],
          why: "Email alex@example.com is not valid evidence.",
        },
      ],
      keywords: [
        { term: "Node.js", inResume: true },
        { term: "alex@example.com", inResume: true },
      ],
    };

    const result = await runAudit("resume with Node.js and alex@example.com", "posting");
    const publicText = JSON.stringify(result);

    expect(publicText).not.toMatch(piiPattern);
    expect(publicText).toMatch(/truthful metric/i);
    expect(publicText).toMatch(/Do not invent the number/i);
    expect(result.agents?.find((a) => a.id === "impact")?.stats).toEqual([
      { value: "38%", label: "lower p95 latency", accent: "blue" },
    ]);
    expect(result.agents?.find((a) => a.id === "rolefit")?.lines).toEqual([
      { rank: 1, label: "Built platform services", score: 91, status: "kept-top" },
    ]);
  });
});

describe("faithfulness verification pass (trust-signal integrity)", () => {
  it("marks a clean run 'clean' and leaves the doc intact", async () => {
    const r = await runFull("resume", "posting");
    expect(r.verification?.status).toBe("clean");
    expect(r.verification?.corrections).toEqual([]);
    expect(r.verification?.checked).toBeGreaterThan(0);
    expect(r.doc?.experience[0].bullets).toEqual(EXPECTED_BULLETS);
  });

  it("marks a run with applied repairs 'corrected' and adopts the repaired bullets", async () => {
    fixtureOverrides.verify_faithfulness = {
      summary: "Platform engineer.",
      experience: [
        {
          role: "SSE",
          company: "Brightline",
          dates: "2019–now",
          bullets: REPAIRED_BULLETS,
        },
      ],
      corrections: [
        { kind: "inflated-scope", claim: "global team", note: "resume says 'a team'." },
      ],
    };
    fixtureOverrides.repair_rewrite_evidence = {
      bullets: REPAIRED_BULLETS.map((after, i) => ({
        before: [
          "Built Node.js services for platform teams.",
          "Maintained Kubernetes jobs.",
          "Improved observability dashboards.",
        ][i],
        after,
      })),
    };
    const r = await runFull("resume", "posting");
    expect(r.verification?.status).toBe("corrected");
    expect(r.verification?.corrections).toHaveLength(1);
    expect(r.doc?.experience[0].bullets).toEqual(REPAIRED_BULLETS);
  });

  it("NEVER claims 'clean' when the verify call throws — status 'unavailable', doc untouched", async () => {
    fixtureOverrides.verify_faithfulness = new Error("provider timeout");
    const r = await runFull("resume", "posting");
    expect(r.verification?.status).toBe("unavailable");
    expect(r.verification?.corrections).toEqual([]);
    expect(r.doc?.experience[0].bullets).toEqual(EXPECTED_BULLETS); // unchanged
  });

  it("treats a shape mismatch as 'unavailable' and discards the repair + its corrections", async () => {
    fixtureOverrides.verify_faithfulness = {
      summary: "Platform engineer.",
      experience: [], // wrong role count → shape mismatch
      corrections: [{ kind: "fabricated", claim: "z", note: "n" }],
    };
    const r = await runFull("resume", "posting");
    expect(r.verification?.status).toBe("unavailable");
    expect(r.verification?.corrections).toEqual([]); // not reported — repair was discarded
    expect(r.doc?.experience[0].bullets).toEqual(EXPECTED_BULLETS); // original kept
  });

  it("rejects a repair that empties a bullet to '' (post-filter count guard, not pre-filter)", async () => {
    fixtureOverrides.verify_faithfulness = {
      summary: "Platform engineer.",
      experience: [
        // raw count 1 matches the draft, but filter(Boolean) makes it 0 — must NOT be adopted
        { role: "SSE", company: "Brightline", dates: "2019–now", bullets: [""] },
      ],
      corrections: [{ kind: "fabricated", claim: "x", note: "unsupported" }],
    };
    const r = await runFull("resume", "posting");
    expect(r.verification?.status).toBe("unavailable");
    expect(r.doc?.experience[0].bullets).toEqual(EXPECTED_BULLETS); // bullet not silently dropped
  });

  it("treats a reordered experience array as a shape mismatch (no header/bullet desync)", async () => {
    fixtureOverrides.verify_faithfulness = {
      summary: "Platform engineer.",
      experience: [
        // same count + bullet-count profile, but a DIFFERENT company → must be rejected
        { role: "SSE", company: "Globex", dates: "2019–now", bullets: ["y"] },
      ],
      corrections: [],
    };
    const r = await runFull("resume", "posting");
    expect(r.verification?.status).toBe("unavailable");
    expect(r.doc?.experience[0].company).toBe("Brightline");
    expect(r.doc?.experience[0].bullets).toEqual(EXPECTED_BULLETS);
  });
});
