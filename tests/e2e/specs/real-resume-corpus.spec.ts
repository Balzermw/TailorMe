import { test, expect } from "../helpers/test";
import {
  loadRealResumeCorpus,
  writeRealResumeReport,
  type RealResumeResult,
} from "../helpers/real-resume-corpus";
import { mockAgentReview, TEST_JOB_POSTING, uploadResumeFile } from "../helpers/app";
import { evaluateRealSuggestionQuality } from "../helpers/resume-quality";

test("@real-corpus private real-resume corpus runner continues after file failures", async ({ page }, testInfo) => {
  test.skip(process.env.RUN_REAL_RESUME_CORPUS !== "1", "Real-resume corpus is opt-in only.");
  const items = await loadRealResumeCorpus();
  test.skip(!items.length, "No real resumes matched the selected corpus filters.");

  const liveAiMode = process.env.RUN_LIVE_AI_E2E === "1";
  const defaultPerFileTimeoutMs = liveAiMode ? 180_000 : 45_000;
  const minQualityScore = Math.max(
    0,
    Number(process.env.REAL_RESUME_MIN_QUALITY_SCORE || 85) || 85,
  );
  const perFileTimeoutMs = Math.max(
    5_000,
    Number(process.env.REAL_RESUME_PER_FILE_TIMEOUT_MS || defaultPerFileTimeoutMs) || defaultPerFileTimeoutMs,
  );
  testInfo.setTimeout(120_000 + items.length * (perFileTimeoutMs + 10_000));
  if (!liveAiMode) await mockAgentReview(page);

  const results: RealResumeResult[] = [];
  const priorSuggestionTexts: string[] = [];
  for (const item of items) {
    await test.step(`real corpus ${item.id}`, async () => {
      let stage = "upload";
      try {
        await page.goto("/audit?start=upload");
        await page.evaluate(() => {
          window.localStorage.clear();
          window.sessionStorage.clear();
        });
        await page.goto("/audit?start=upload");
        await expect(page.getByRole("button", { name: /Upload your resume/i })).toBeVisible();
        const parseResponsePromise =
          item.sizeBytes <= 8 * 1024 * 1024
            ? page
                .waitForResponse(
                  (response) =>
                    response.url().includes("/api/parse-resume") &&
                    response.request().method() === "POST",
                  { timeout: perFileTimeoutMs },
                )
                .then(async (response) => ({
                  ok: response.ok(),
                  payload: (await response.json().catch(() => null)) as { degraded?: boolean; error?: string } | null,
                }))
                .catch(() => null)
            : Promise.resolve(null);
        await uploadResumeFile(page, item.filePath);
        stage = "parse";
        const parsed = page.getByRole("button", { name: /Next: pick the job/i });
        const error = page
          .locator("text=/couldn.t|too large|scanned|image-only|try a PDF|AI parse unavailable/i")
          .first();
        const result = await Promise.race([
          parsed.waitFor({ state: "visible", timeout: perFileTimeoutMs }).then(() => "parsed"),
          error.waitFor({ state: "visible", timeout: perFileTimeoutMs }).then(() => "error"),
        ]);
        if (result === "parsed") {
          const parseResponse = await parseResponsePromise;
          if (liveAiMode && parseResponse?.payload?.degraded) {
            throw new Error(
              parseResponse.payload.error ||
                "Live AI parse degraded to the local heuristic fallback.",
            );
          }
          stage = "score";
          await parsed.click();
          await page.getByLabel(/Paste a job URL or the posting text/i).fill(TEST_JOB_POSTING);
          await page.getByRole("button", { name: /Score my fit/i }).click();
          await expect(page.getByRole("button", { name: /Run my free AI agent audit/i })).toBeVisible({
            timeout: perFileTimeoutMs,
          });

          stage = "agent-review";
          await page.getByRole("button", { name: /Run my free AI agent audit/i }).click();
          await expect(page.getByText(/^Ada$/).first()).toBeVisible({ timeout: perFileTimeoutMs });
          await expect(page.getByText(/^Max$/).first()).toBeVisible();
          await expect(page.getByText(/^Remy$/).first()).toBeVisible();
          const reviewText = await page.locator("main").innerText({ timeout: perFileTimeoutMs });
          const summaryButton = page.getByRole("button", { name: /See your summary/i });
          if (await summaryButton.isVisible().catch(() => false)) {
            stage = "summary";
            await summaryButton.click();
            await expect(page.getByText(/Your audit summary/i)).toBeVisible({ timeout: perFileTimeoutMs });
          }
          const summaryText = await page.locator("main").innerText({ timeout: perFileTimeoutMs }).catch(() => "");
          stage = "quality";
          const quality = evaluateRealSuggestionQuality(`${reviewText}\n${summaryText}`);
          const normalizedSuggestionText = normalizeSuggestionText(`${reviewText}\n${summaryText}`);
          const maxSimilarityToPrior = Math.max(
            0,
            ...priorSuggestionTexts.map((prior) => suggestionSimilarity(prior, normalizedSuggestionText)),
          );
          quality.maxSimilarityToPrior = Number(maxSimilarityToPrior.toFixed(3));
          if (maxSimilarityToPrior >= 0.92) {
            quality.issues.push("too_template_like");
            quality.score = Math.max(0, quality.score - 22);
          } else if (maxSimilarityToPrior >= 0.85) {
            quality.score = Math.max(0, quality.score - 6);
          }
          priorSuggestionTexts.push(normalizedSuggestionText);
          const qualityIssues = [...quality.issues];
          if (quality.score < minQualityScore) qualityIssues.push("quality_score_below_min");
          const passedQuality = quality.score >= minQualityScore && qualityIssues.length === 0;
          results.push({
            id: item.id,
            type: item.type,
            category: item.category,
            status: passedQuality ? "passed" : "failed",
            stage,
            error: passedQuality ? undefined : `Quality issues: ${qualityIssues.join(", ")}`,
            qualityScore: quality.score,
            qualityIssues,
            qualitySignals: {
              agentCount: quality.agentCount,
              actionableMentions: quality.actionableMentions,
              charCount: quality.charCount,
              sensitiveLeaks: quality.sensitiveLeaks,
              targetKeywordMentions: quality.targetKeywordMentions,
              gapMentions: quality.gapMentions,
              groundingMentions: quality.groundingMentions,
              metricGuidanceMentions: quality.metricGuidanceMentions,
              sectionMentions: quality.sectionMentions,
              rewritePairCount: quality.rewritePairCount,
              concreteFixCount: quality.concreteFixCount,
              genericPhraseCount: quality.genericPhraseCount,
              uniqueTokenRatio: Number(quality.uniqueTokenRatio.toFixed(3)),
              maxSimilarityToPrior: quality.maxSimilarityToPrior,
            },
          });
        } else {
          const errorText = await error.innerText().catch(() => "");
          const expectedRejection = /too large|scanned|image-only|couldn.t read any text/i.test(errorText);
          results.push({
            id: item.id,
            type: item.type,
            category: item.category,
            status: expectedRejection ? "skipped" : "failed",
            stage,
            error: expectedRejection ? "Expected unsupported-file rejection shown." : "Readable UI parse error shown.",
          });
        }
      } catch (error) {
        results.push({
          id: item.id,
          type: item.type,
          category: item.category,
          status: "failed",
          stage,
          error: error instanceof Error ? error.message : String(error),
        });
      }
      await writeRealResumeReport(results);
    });
  }

  await writeRealResumeReport(results);
  expect(results.length).toBe(items.length);
});

function normalizeSuggestionText(value: string): string {
  return value.toLowerCase().replace(/\s+/g, " ").trim();
}

function suggestionSimilarity(a: string, b: string): number {
  const aTokens = suggestionTokens(a);
  const bTokens = suggestionTokens(b);
  if (aTokens.size === 0 || bTokens.size === 0) return 0;
  let intersection = 0;
  for (const token of aTokens) {
    if (bTokens.has(token)) intersection++;
  }
  return intersection / (aTokens.size + bTokens.size - intersection);
}

function suggestionTokens(value: string): Set<string> {
  return new Set(
    value
      .replace(/[^a-z0-9.%$+-]+/g, " ")
      .split(/\s+/)
      .filter((token) => token.length >= 4),
  );
}
