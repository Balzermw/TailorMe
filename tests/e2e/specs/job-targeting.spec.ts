import { allowDiagnosticFailures, test, expect } from "../helpers/test";
import { mockAgentReview, TEST_JOB_POSTING } from "../helpers/app";

async function reachJobStep(page: import("@playwright/test").Page): Promise<void> {
  await page.goto("/audit?start=upload");
  const sampleButton = page.getByRole("button", { name: /Try with the sample resume/i });
  const nextButton = page.getByRole("button", { name: /Next: pick the job/i });
  await expect(sampleButton).toBeEnabled();

  for (let attempt = 0; attempt < 2; attempt += 1) {
    await sampleButton.scrollIntoViewIfNeeded();
    await sampleButton.click({ force: attempt > 0 });
    try {
      await expect(nextButton).toBeVisible({ timeout: 7_500 });
      break;
    } catch (error) {
      if (attempt === 1) throw error;
    }
  }

  await nextButton.click();
}

test("@critical job targeting keeps score action inert until posting text exists", async ({ page }) => {
  await reachJobStep(page);
  const scoreButton = page.getByRole("button", { name: /Score my fit/i });
  await expect(scoreButton).toHaveCSS("pointer-events", "none");
});

test("@critical job targeting scores a realistic posting with deterministic agent mocks", async ({ page }) => {
  await mockAgentReview(page);
  await reachJobStep(page);
  await page.getByLabel(/Paste a job URL or the posting text/i).fill(TEST_JOB_POSTING);
  await page.getByRole("button", { name: /Score my fit/i }).click();
  await expect(page.getByText(/Strong fit/i)).toBeVisible({ timeout: 15_000 });
  await expect(page.getByRole("button", { name: /Run my free AI agent audit/i })).toBeVisible();
});

test("@critical job URL fetch failure shows a readable retry path", async ({ page }) => {
  allowDiagnosticFailures("This test intentionally returns a controlled 500 from /api/fetch-posting.");
  await page.route("**/api/fetch-posting", async (route) => {
    await route.fulfill({
      status: 500,
      contentType: "application/json",
      body: JSON.stringify({ error: "Injected fetch failure." }),
    });
  });
  await reachJobStep(page);
  await page.getByLabel(/Paste a job URL or the posting text/i).fill("https://example.com/jobs/platform");
  await page.getByRole("button", { name: /Score my fit/i }).click();
  await expect(page.getByText(/Injected fetch failure|Paste the posting text/i)).toBeVisible();
});
