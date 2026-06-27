import type { Page } from "@playwright/test";
import type { TailoredDoc } from "@/lib/types";
import {
  E2E_REVISION_APP_ID,
  E2E_REVISION_RESULT,
} from "@/lib/e2e/revision-fixture";

export const TEST_JOB_POSTING = [
  "Senior Platform Engineer",
  "Acme Systems is hiring a platform engineer to own Node.js services, Kubernetes deployment standards, reliability, observability, and mentoring.",
  "Requirements: 5+ years backend engineering, distributed systems, AWS, Datadog or Prometheus, CI/CD, and measurable performance wins.",
].join("\n");

export const STRUCTURED_TEST_DOC: TailoredDoc = {
  name: "Jordan Rivera",
  headline: "Customer Support Specialist",
  contact: "555-010-1000 | jordan.synthetic@example.com | Portland, OR",
  summary:
    "Customer support specialist with experience resolving technical tickets, improving help-center content, and tracking SLA performance.",
  experience: [
    {
      role: "Customer Support Specialist",
      company: "Northstar Tools",
      dates: "Jan 2022 - Present",
      bullets: [
        "Resolved 45+ tickets per day across email and chat while maintaining 96% CSAT.",
        "Built help-center articles that reduced repeat questions by 22%.",
      ],
    },
  ],
  education: [{ degree: "BA Communications", school: "State University", dates: "2020" }],
  skills: ["Zendesk", "SLA management", "SQL", "customer onboarding"],
  coverLetter: "",
};

export const RAW_SOURCE_PROFILE_TEXT = [
  "Redon Kalemaj",
  "RF sensor engineer with implementation, integration, and documentation experience.",
  "Associate RF Sensor Engineer, Boeing, St. Louis, MO, May 2023 - Jan 2025",
  "Developed and tested RF sensor systems against detailed hardware requirements.",
  "Skills: requirements analysis, audits and compliance, Altium Designer, C/C++",
].join("\n");

export async function clearClientState(page: Page): Promise<void> {
  await page.addInitScript(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
  });
}

export async function seedRawSourceProfile(page: Page, text: string = RAW_SOURCE_PROFILE_TEXT): Promise<void> {
  await page.addInitScript((sourceText) => {
    window.localStorage.setItem(
      "tm_resume_v1",
      JSON.stringify({
        name: "Redon Kalemaj",
        text: sourceText,
        stats: null,
        source: "pasted",
        savedAt: "2026-06-24T12:00:00.000Z",
      }),
    );
  }, text);
}

export async function seedLocalResume(page: Page, doc: TailoredDoc = STRUCTURED_TEST_DOC): Promise<void> {
  await page.addInitScript((seed) => {
    window.localStorage.setItem(
      "tm_resume_v1",
      JSON.stringify({
        name: seed.name,
        text: [
          seed.name,
          seed.headline,
          seed.contact,
          seed.summary,
          ...seed.experience.flatMap((entry) => [
            `${entry.role}, ${entry.company}, ${entry.dates}`,
            ...entry.bullets,
          ]),
          ...seed.skills,
        ].join("\n"),
        stats: null,
        doc: seed,
        source: "scratch",
        savedAt: new Date().toISOString(),
      }),
    );
  }, doc);
}

export async function mockResumeStructure(page: Page, doc: TailoredDoc = STRUCTURED_TEST_DOC): Promise<void> {
  await page.route("**/api/resume/structure", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ doc }),
    });
  });
}

export async function uploadResumeFile(page: Page, filePath: string): Promise<void> {
  await page.waitForLoadState("networkidle", { timeout: 5_000 }).catch(() => {});
  await page.waitForTimeout(500);
  const input = page.locator("input[type='file']").first();
  await input.setInputFiles(filePath);
}

export async function mockAgentReview(page: Page): Promise<void> {
  await page.route("**/api/apply", async (route) => {
    const request = route.request();
    if (request.method() !== "POST") {
      await route.continue();
      return;
    }
    const body = request.postDataJSON() as { mode?: string } | undefined;
    if (body?.mode === "score") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          result: {
            company: "Acme Systems",
            role: "Senior Platform Engineer",
            fit: {
              overall: 82,
              verdict: "Strong fit",
              summary: "Synthetic score summary for deterministic E2E.",
              locationStatus: "pass",
              locationNote: "Remote role.",
              dimensions: [
                { label: "Technical skills", score: 86, matched: ["Node.js"], gaps: ["Observability"], why: "Strong platform overlap." },
                { label: "Experience match", score: 80, matched: ["Backend"], gaps: [], why: "Enough seniority." },
                { label: "Culture fit", score: 78, matched: ["Mentoring"], gaps: [], why: "Collaboration signals." },
                { label: "Career alignment", score: 84, matched: ["Platform"], gaps: [], why: "Logical next step." },
              ],
              keywords: [
                { term: "Node.js", inResume: true },
                { term: "Kubernetes", inResume: true },
                { term: "Observability", inResume: false },
              ],
              recommendReview: false,
            },
          },
        }),
      });
      return;
    }
    if (body?.mode === "audit") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          result: {
            agents: [
              {
                id: "ats",
                persona: "Ada",
                archetype: "The Parser",
                specialty: "ATS & keywords",
                accent: "blue",
                reads: "Reads your resume like an ATS system",
                kind: "coverage",
                title: "Keyword coverage",
                subtitle: "how many keywords your resume covers from the posting",
                footer: "",
                detail: "Ada found strong platform keywords with one observable gap.",
                matched: 2,
                total: 3,
                keywords: [
                  { name: "Node.js", matched: true, count: "1x" },
                  { name: "Kubernetes", matched: true, count: "1x" },
                  { name: "Observability", matched: false, count: "0x" },
                ],
              },
              {
                id: "impact",
                persona: "Max",
                archetype: "The Quantifier",
                specialty: "Impact & metrics",
                accent: "mint",
                reads: "Reads your resume looking for quantified results",
                kind: "impact",
                title: "Quantified impact",
                subtitle: "how many bullets can be quantified",
                footer: "",
                detail: "Max found measurable impact and one place to add scope.",
                quantified: { count: 1, total: 2 },
                before: "Built help-center articles.",
                after: "Built 18 help-center articles that reduced repeat questions by 22%.",
                stats: [{ value: "22%", label: "fewer repeat questions", accent: "mint" }],
              },
              {
                id: "rolefit",
                persona: "Remy",
                archetype: "The Hiring Manager",
                specialty: "Role-fit",
                accent: "navy",
                reads: "Reads your resume like a hiring manager",
                kind: "ranking",
                title: "Your bullets, ranked",
                subtitle: "scored 0/100 for Senior Platform Engineer",
                chip: "Hard limit",
                footer: "",
                detail: "Remy would lead with platform evidence for this target role.",
                lines: [
                  { rank: 1, label: "Kubernetes standards", score: 88, status: "kept-top" },
                  { rank: 2, label: "Help-center operations", score: 64, status: "kept" },
                ],
              },
            ],
          },
        }),
      });
      return;
    }
    if (body?.mode === "full") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          result: E2E_REVISION_RESULT,
          applicationId: E2E_REVISION_APP_ID,
        }),
      });
      return;
    }
    await route.continue();
  });
}
