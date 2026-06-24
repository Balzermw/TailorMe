import fs from "node:fs/promises";
import path from "node:path";
import { loadEnvConfig } from "@next/env";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Page } from "@playwright/test";
import { test, expect } from "../helpers/test";
import { TEST_JOB_POSTING, uploadResumeFile } from "../helpers/app";
import { loadRealResumeCorpus, type RealResumeItem } from "../helpers/real-resume-corpus";
import { redactText } from "../helpers/redact";
import { docToResumeText } from "@/lib/apply/serialize";
import type { ApplyResult, ProofPoint } from "@/lib/types";

loadEnvConfig(process.cwd());

interface RevisionRunResult {
  id: string;
  type: string;
  category: string;
  status: "passed" | "failed" | "skipped";
  stage: string;
  error?: string;
  diffCount?: number;
  changeMetrics?: RevisionChangeMetrics;
  reviewedCount?: string;
  suggestionChecks?: {
    before: number;
    afterFix: number;
    afterRefresh: number;
  };
}

interface RevisionChangeMetrics {
  aiRewritePairs: number;
  changedRewritePairs: number;
  rewritesInFinalDoc: number;
  beforesStillInFinalDoc: number;
  sourceFinalTokenSimilarity: number;
  finalLengthRatio: number;
  finalDifferentFromSource: boolean;
  uiDiffCoverage: number;
  pipelineQualityGate?: string;
  pipelineAttempts?: number;
  pipelineRepairPasses?: number;
  pipelineDocumentRepairPasses?: number;
  pipelineMatchedBulletDiffs?: number;
  pipelinePostVerifyRewritePairs?: number;
}

const MANUAL_EDIT_TEXT =
  "Clarified role-aligned impact for this live revision QA pass using only existing resume context.";
const ANCHORED_SUGGESTION_TITLE = "QA anchored suggestion clears after edit";
const PERSISTENT_SUGGESTION_TITLE = "QA persistent section suggestion";

test.describe.configure({ mode: "serial" });

test("@real-corpus @live-ai paid revision UI batch exercises editor decisions on real resumes", async ({
  page,
}, testInfo) => {
  test.skip(
    process.env.RUN_REAL_RESUME_REVISION_UI !== "1",
    "Live paid revision UI corpus is opt-in only.",
  );
  test.skip(process.env.RUN_LIVE_AI_E2E !== "1", "Live AI mode is required.");
  test.skip(process.env.RUN_REAL_RESUME_CORPUS !== "1", "Real corpus mode is required.");

  const items = await loadRealResumeCorpus();
  test.skip(!items.length, "No real resumes matched the selected corpus filters.");

  const perFileTimeoutMs = Math.max(
    60_000,
    Number(process.env.REAL_RESUME_PER_FILE_TIMEOUT_MS || 240_000) || 240_000,
  );
  testInfo.setTimeout(180_000 + items.length * (perFileTimeoutMs + 90_000));

  const sb = supabaseAdmin();
  const user = await ensureE2EUser(sb);
  await signIn(page, user.email, user.password);

  const results: RevisionRunResult[] = [];
  for (const item of items) {
    await test.step(`real revision ${item.id}`, async () => {
      const result = await runOne(page, sb, item, perFileTimeoutMs);
      results.push(result);
      await writeRevisionReport(results);
    });
  }

  await writeRevisionReport(results);
  expect(results.length).toBe(items.length);
});

async function runOne(
  page: Page,
  sb: SupabaseClient,
  item: RealResumeItem,
  perFileTimeoutMs: number,
): Promise<RevisionRunResult> {
  let stage = "upload";
  let changeMetrics: RevisionChangeMetrics | undefined;
  try {
    await resetFlowState(page);
    await page.goto("/audit?start=upload");
    await expect(page.getByRole("button", { name: /Upload your resume/i })).toBeVisible();

    const parseResponsePromise = page
      .waitForResponse(
        (response) =>
          response.url().includes("/api/parse-resume") &&
          response.request().method() === "POST",
        { timeout: perFileTimeoutMs },
      )
      .then(async (response) => ({
        ok: response.ok(),
        status: response.status(),
        payload: (await response.json().catch(() => null)) as {
          text?: string;
          stats?: { proofPoints?: ProofPoint[] };
          degraded?: boolean;
          error?: string;
        } | null,
      }));

    await uploadResumeFile(page, item.filePath);
    stage = "parse";
    const parsed = page.getByRole("button", { name: /Next: pick the job/i });
    const error = page
      .locator("text=/couldn.t|too large|scanned|image-only|try a PDF|AI parse unavailable/i")
      .first();
    const parseState = await Promise.race([
      parsed.waitFor({ state: "visible", timeout: perFileTimeoutMs }).then(() => "parsed"),
      error.waitFor({ state: "visible", timeout: perFileTimeoutMs }).then(() => "error"),
    ]);
    const parseResponse = await parseResponsePromise;
    if (parseState !== "parsed" || !parseResponse.ok || !parseResponse.payload?.text) {
      const errorText = await error.innerText().catch(() => parseResponse.payload?.error ?? "");
      const expectedRejection = /too large|scanned|image-only|couldn.t read any text/i.test(errorText);
      return {
        id: item.id,
        type: item.type,
        category: item.category,
        status: expectedRejection ? "skipped" : "failed",
        stage,
        error: expectedRejection ? "Expected unsupported-file rejection shown." : "Parse did not produce usable text.",
      };
    }
    if (parseResponse.payload.degraded) {
      throw new Error(parseResponse.payload.error || "Live AI parse degraded.");
    }

    stage = "full-tailor";
    const full = await page.evaluate(
      async ({ resumeText, proofPoints, postingText }) => {
        const res = await fetch("/api/apply", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            mode: "full",
            resumeText,
            postingText,
            proofPoints,
          }),
        });
        return {
          ok: res.ok,
          status: res.status,
          data: (await res.json().catch(() => null)) as {
            applicationId?: string | null;
            result?: ApplyResult;
            error?: string;
          } | null,
        };
      },
      {
        resumeText: parseResponse.payload.text,
        proofPoints: parseResponse.payload.stats?.proofPoints ?? [],
        postingText: TEST_JOB_POSTING,
      },
    );
    if (!full.ok || !full.data?.applicationId || !full.data.result) {
      throw new Error(`Full tailoring failed at ${full.status}: ${full.data?.error ?? "no application"}`);
    }

    const appId = full.data.applicationId;
    const result = full.data.result;
    changeMetrics = computeChangeMetrics(parseResponse.payload.text, result);
    if (
      !changeMetrics.finalDifferentFromSource ||
      changeMetrics.changedRewritePairs === 0 ||
      changeMetrics.rewritesInFinalDoc === 0
    ) {
      return {
        id: item.id,
        type: item.type,
        category: item.category,
        status: "failed",
        stage,
        error: "Paid tailoring did not produce measurable AI rewrite evidence.",
        diffCount: result.bulletDiffs?.length ?? 0,
        changeMetrics,
      };
    }
    const diffs = result.bulletDiffs ?? [];
    changeMetrics.uiDiffCoverage = ratio(diffs.length, changeMetrics.changedRewritePairs);
    if (diffs.length < 3) {
      return {
        id: item.id,
        type: item.type,
        category: item.category,
        status: "skipped",
        stage,
        error: `Not enough bullet diffs to exercise accept/reject/edit (${diffs.length}).`,
        diffCount: diffs.length,
        changeMetrics,
      };
    }
    await seedAnchoredSuggestions(sb, appId, result, diffs[2].after);

    stage = "editor";
    await page.goto(`/applications/${appId}/edit`);
    await expect(page.locator(".tmE-head h1").first()).toContainText(/Platform Engineer/i, {
      timeout: 30_000,
    });
    await page.getByRole("button", { name: /^Experience/i }).click();
    await expect(page.locator('[data-testid^="revision-diff-"]')).toHaveCount(diffs.length);

    stage = "suggestions";
    await page.getByRole("button", { name: /^Suggestions/i }).click();
    const suggestionsBefore = await page.getByTestId("feedback-suggestion").count();
    await expect(page.getByText(ANCHORED_SUGGESTION_TITLE)).toBeVisible();
    await expect(page.getByText(PERSISTENT_SUGGESTION_TITLE)).toBeVisible();

    stage = "editor";
    const accept = diffs[0];
    const reject = diffs[1];
    const edit = diffs[2];
    await page.getByRole("button", { name: /^Experience/i }).click();
    await page.getByTestId(revisionTestId("accept", accept)).click();
    await expect(page.getByTestId(revisionTestId("accept", accept))).toHaveAttribute("aria-pressed", "true");
    await page.getByTestId(revisionTestId("reject", reject)).click();
    await expect(page.getByTestId(revisionTestId("reject", reject))).toHaveAttribute("aria-pressed", "true");
    await page.getByTestId(revisionTestId("edit", edit)).click();
    await page.getByTestId(`revision-custom-bullet-${edit.entry}-${edit.bullet}`).fill(MANUAL_EDIT_TEXT);
    await expect(page.getByRole("button", { name: /Review my edits/i })).toBeVisible();

    stage = "suggestions";
    await page.getByRole("button", { name: /^Suggestions/i }).click();
    await expect(page.getByText(ANCHORED_SUGGESTION_TITLE)).toHaveCount(0);
    await expect(page.getByText(PERSISTENT_SUGGESTION_TITLE)).toBeVisible();
    const suggestionsAfterFix = await page.getByTestId("feedback-suggestion").count();

    stage = "save-reload";
    await page.getByRole("button", { name: /Save edits/i }).click();
    await expect(page.getByText(/^Saved$/)).toBeVisible({ timeout: 20_000 });
    await page.reload();
    await expect(page.locator(".tmE-head h1").first()).toContainText(/Platform Engineer/i, {
      timeout: 30_000,
    });
    await page.getByRole("button", { name: /^Experience/i }).click();
    const reviewedCount = await page.getByTestId("revision-reviewed-count").innerText();
    await expect(page.getByTestId(revisionTestId("accept", accept))).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByTestId(revisionTestId("reject", reject))).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByTestId(revisionTestId("edit", edit))).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByTestId("resume-live-preview")).toContainText(MANUAL_EDIT_TEXT);

    stage = "print";
    await page.goto(`/applications/${appId}/print`);
    await expect(page.getByTestId("print-document")).toContainText(MANUAL_EDIT_TEXT);

    return {
      id: item.id,
      type: item.type,
      category: item.category,
      status: "passed",
      stage,
      diffCount: diffs.length,
      changeMetrics,
      reviewedCount,
      suggestionChecks: {
        before: suggestionsBefore,
        afterFix: suggestionsAfterFix,
        afterRefresh: suggestionsAfterFix,
      },
    };
  } catch (error) {
    return {
      id: item.id,
      type: item.type,
      category: item.category,
      status: "failed",
      stage,
      error: error instanceof Error ? error.message : String(error),
      changeMetrics,
    };
  }
}

function revisionTestId(
  action: "accept" | "reject" | "edit",
  diff: { entry: number; bullet: number },
): string {
  return `revision-${action}-${diff.entry}-${diff.bullet}`;
}

async function resetFlowState(page: Page): Promise<void> {
  await page.goto("/");
  await page.evaluate(() => {
    for (const key of Object.keys(window.sessionStorage)) {
      if (key.startsWith("tm_")) window.sessionStorage.removeItem(key);
    }
    for (const key of Object.keys(window.localStorage)) {
      if (key.startsWith("tm_resume") || key.startsWith("tm_draft")) {
        window.localStorage.removeItem(key);
      }
    }
  });
}

function supabaseAdmin(): SupabaseClient {
  const url = requiredEnv("NEXT_PUBLIC_SUPABASE_URL");
  const serviceRole = requiredEnv("SUPABASE_SERVICE_ROLE_KEY");
  return createClient(url, serviceRole, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

async function ensureE2EUser(
  sb: SupabaseClient,
): Promise<{ email: string; password: string }> {
  const email = `revision-ui-${Date.now()}@example.com`;
  const password = `Revision-ui-${Date.now()}!`;
  const { error } = await sb.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: "Revision UI QA" },
  });
  if (error) throw new Error(`Could not create Supabase E2E user: ${error.message}`);
  return { email, password };
}

async function signIn(page: Page, email: string, password: string): Promise<void> {
  await page.goto("/signin");
  await page.getByRole("button", { name: /^Sign in$/i }).click();
  await page.getByLabel(/^Email$/i).fill(email);
  await page.getByLabel(/^Password$/i).fill(password);
  await page.getByRole("button", { name: /^Sign in$/i }).last().click();
  await expect(page).toHaveURL(/\/dashboard/, { timeout: 30_000 });
}

async function seedAnchoredSuggestions(
  sb: SupabaseClient,
  appId: string,
  result: ApplyResult,
  quote: string,
): Promise<void> {
  const proofPoints: ProofPoint[] = [
    {
      title: ANCHORED_SUGGESTION_TITLE,
      summary: "Anchored to a real tailored bullet for live revision UI QA.",
      quote,
      why: "The card should disappear when the quoted line changes.",
      fix: "Edit the referenced bullet.",
      severity: "high",
      ruleId: "qa_live_revision_quote_clears",
      category: "impact",
    },
    {
      title: PERSISTENT_SUGGESTION_TITLE,
      summary: "A no-quote suggestion should persist until the section is improved.",
      why: "Missing-section findings cannot be quote-pruned.",
      fix: "Improve the missing section.",
      severity: "medium",
      ruleId: "qa_live_revision_missing_persists",
      category: "structure",
    },
  ];
  const { error } = await sb
    .from("applications")
    .update({ result: { ...result, proofPoints } })
    .eq("id", appId);
  if (error) throw new Error(`Could not seed revision suggestions: ${error.message}`);
}

async function writeRevisionReport(results: RevisionRunResult[]): Promise<void> {
  const docsDir = path.join(process.cwd(), "docs", "qa");
  const resultsDir = path.join(process.cwd(), "tests", "e2e", "results");
  await fs.mkdir(docsDir, { recursive: true });
  await fs.mkdir(resultsDir, { recursive: true });
  const passed = results.filter((r) => r.status === "passed").length;
  const failed = results.filter((r) => r.status === "failed").length;
  const skipped = results.filter((r) => r.status === "skipped").length;
  const lines = [
    "# Real Resume Revision UI Results",
    "",
    "Private corpus revision reports are anonymized. Raw filenames, resume text, parsed JSON, screenshots, and edited resume content are intentionally omitted.",
    "",
    `- Total: ${results.length}`,
    `- Passed: ${passed}`,
    `- Failed: ${failed}`,
    `- Skipped: ${skipped}`,
    "",
    "| ID | Type | Category | Status | Stage | Diffs | Reviewed | Suggestions | Error |",
    "| --- | --- | --- | --- | --- | --- | --- | --- | --- |",
    ...results.map((r) => {
      const suggestions = r.suggestionChecks
        ? `${r.suggestionChecks.before}->${r.suggestionChecks.afterFix}`
        : "";
      const metrics = r.changeMetrics
        ? [
            `rewrites ${r.changeMetrics.rewritesInFinalDoc}/${r.changeMetrics.changedRewritePairs}`,
            `sim ${r.changeMetrics.sourceFinalTokenSimilarity}`,
            `coverage ${r.changeMetrics.uiDiffCoverage}`,
            r.changeMetrics.pipelineQualityGate
              ? `gate ${r.changeMetrics.pipelineQualityGate}`
              : "",
            r.changeMetrics.pipelineAttempts
              ? `attempts ${r.changeMetrics.pipelineAttempts}`
              : "",
            r.changeMetrics.pipelineRepairPasses
              ? `repair ${r.changeMetrics.pipelineRepairPasses}`
              : "",
            r.changeMetrics.pipelineDocumentRepairPasses
              ? `docRepair ${r.changeMetrics.pipelineDocumentRepairPasses}`
              : "",
          ]
            .filter(Boolean)
            .join(", ")
        : "";
      return `| ${r.id} | ${r.type} | ${r.category} | ${r.status} | ${r.stage} | ${r.diffCount ?? ""} | ${sanitizeCell(r.reviewedCount ?? "")} | ${suggestions} | ${sanitizeCell([metrics, r.error].filter(Boolean).join("; "))} |`;
    }),
    "",
  ].join("\n");
  await fs.writeFile(reportMarkdownPath(), lines, "utf8");
  await fs.writeFile(
    path.join(resultsDir, `real-resume-revision-ui-results-${reportSuffix()}.json`),
    JSON.stringify(results, null, 2),
    "utf8",
  );
}

function computeChangeMetrics(sourceText: string, result: ApplyResult): RevisionChangeMetrics {
  const finalText = result.doc ? docToResumeText(result.doc) : "";
  const finalHay = normalizeForCompare(finalText);
  const sourceNorm = normalizeForCompare(sourceText);
  const pairs = result.bullets ?? [];
  const changedPairs = pairs.filter(
    (pair) =>
      normalizeForCompare(pair.before) !== normalizeForCompare(pair.after) &&
      normalizeForCompare(pair.after).length >= 12,
  );
  const rewritesInFinalDoc = changedPairs.filter((pair) =>
    containsNormalized(finalHay, pair.after),
  ).length;
  const beforesStillInFinalDoc = changedPairs.filter((pair) =>
    containsNormalized(finalHay, pair.before),
  ).length;
  return {
    aiRewritePairs: pairs.length,
    changedRewritePairs: changedPairs.length,
    rewritesInFinalDoc,
    beforesStillInFinalDoc,
    sourceFinalTokenSimilarity: Number(tokenSimilarity(sourceNorm, finalHay).toFixed(3)),
    finalLengthRatio: Number(ratio(finalHay.length, sourceNorm.length).toFixed(3)),
    finalDifferentFromSource: sourceNorm !== finalHay,
    uiDiffCoverage: ratio(result.bulletDiffs?.length ?? 0, changedPairs.length),
    pipelineQualityGate: result.tailorDiagnostics?.qualityGate,
    pipelineAttempts: result.tailorDiagnostics?.attempts,
    pipelineRepairPasses: result.tailorDiagnostics?.repairPasses,
    pipelineDocumentRepairPasses: result.tailorDiagnostics?.documentRepairPasses,
    pipelineMatchedBulletDiffs: result.tailorDiagnostics?.matchedBulletDiffs,
    pipelinePostVerifyRewritePairs: result.tailorDiagnostics?.postVerifyRewritePairs,
  };
}

function containsNormalized(normalizedHaystack: string, value: string): boolean {
  const needle = normalizeForCompare(value);
  if (needle.length < 12) return false;
  return normalizedHaystack.includes(needle);
}

function normalizeForCompare(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9%$]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenSimilarity(a: string, b: string): number {
  const aTokens = comparableTokens(a);
  const bTokens = comparableTokens(b);
  if (!aTokens.size || !bTokens.size) return 0;
  let intersection = 0;
  for (const token of aTokens) if (bTokens.has(token)) intersection += 1;
  return intersection / (aTokens.size + bTokens.size - intersection);
}

function comparableTokens(value: string): Set<string> {
  return new Set(value.split(/\s+/).filter((token) => token.length >= 3));
}

function ratio(numerator: number, denominator: number): number {
  if (!denominator) return 0;
  return Number((numerator / denominator).toFixed(3));
}

function reportMarkdownPath(): string {
  return path.join(
    process.cwd(),
    "docs",
    "qa",
    `REAL_RESUME_REVISION_UI_RESULTS_${reportSuffix()}.md`,
  );
}

function reportSuffix(): string {
  return safeSuffix(process.env.REAL_RESUME_REPORT_SUFFIX || "live-paid-revision-ui");
}

function sanitizeCell(value: string): string {
  return redactText(value, { realResume: true })
    .replace(/\|/g, "/")
    .replace(/\r?\n/g, " ")
    .slice(0, 220);
}

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required for live revision UI testing.`);
  return value;
}

function safeSuffix(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80);
}
