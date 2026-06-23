import { test, expect } from "../helpers/test";
import { mockAgentReview, TEST_JOB_POSTING } from "../helpers/app";

test("@critical mocked Ada, Max, and Remy review appears and can advance to summary", async ({ page }) => {
  await mockAgentReview(page);
  await page.goto("/audit?start=upload");
  await page.getByRole("button", { name: /Try with the sample resume/i }).click();
  await expect(page.getByRole("button", { name: /Next: pick the job/i })).toBeVisible({
    timeout: 10_000,
  });
  await page.getByRole("button", { name: /Next: pick the job/i }).click();
  await page.getByLabel(/Paste a job URL or the posting text/i).fill(TEST_JOB_POSTING);
  await page.getByRole("button", { name: /Score my fit/i }).click();
  await page.getByRole("button", { name: /Run my free AI agent audit/i }).click({ timeout: 15_000 });

  await expect(page.getByText(/^Ada$/).first()).toBeVisible({ timeout: 10_000 });
  await expect(page.getByText(/Keyword coverage/i)).toBeVisible();
  await expect(page.getByText(/^Max$/).first()).toBeVisible();
  await expect(page.getByText(/Quantified impact/i)).toBeVisible();
  await expect(page.getByText(/^Remy$/).first()).toBeVisible();

  await page.getByRole("button", { name: /See your summary/i }).click();
  await expect(page.getByText(/Your audit summary/i)).toBeVisible();
  await expect(page.getByText(/What to quantify/i)).toBeVisible();
  await expect(page.getByText(/Add a truthful metric where the work supports it/i)).toBeVisible();
});
