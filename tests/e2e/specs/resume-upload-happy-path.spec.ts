import { test, expect } from "../helpers/test";
import { ensureSyntheticResumeFixtures } from "../helpers/fixtures";
import { mockAgentReview, mockResumeStructure, TEST_JOB_POSTING, uploadResumeFile } from "../helpers/app";

test("@smoke @critical upload resume to feedback, agent review, editor, and export handoff", async ({
  page,
}) => {
  const [fixture] = await ensureSyntheticResumeFixtures();
  await mockAgentReview(page);
  await mockResumeStructure(page);

  await page.goto("/audit?start=upload");
  await expect(page.getByRole("button", { name: /Upload your resume/i })).toBeVisible();
  await uploadResumeFile(page, fixture.path);

  await expect(page.getByRole("button", { name: /Next: pick the job/i })).toBeVisible({
    timeout: 20_000,
  });
  await page.getByRole("button", { name: /Next: pick the job/i }).click();

  await page.getByLabel(/Paste a job URL or the posting text/i).fill(TEST_JOB_POSTING);
  await page.getByRole("button", { name: /Score my fit/i }).click();

  await expect(page.getByRole("button", { name: /Run my free AI agent audit/i })).toBeVisible({
    timeout: 15_000,
  });
  await page.getByRole("button", { name: /Run my free AI agent audit/i }).click();

  await expect(page.getByText(/^Ada$/).first()).toBeVisible({ timeout: 10_000 });
  await expect(page.getByText(/^Max$/).first()).toBeVisible();
  await expect(page.getByText(/^Remy$/).first()).toBeVisible();
  await page.getByRole("button", { name: /See your summary/i }).click();

  await expect(page.getByRole("button", { name: /Open in editor/i })).toBeVisible();
  await page.getByRole("button", { name: /Open in editor/i }).click();
  await expect(page).toHaveURL(/\/resume\/edit/);
  await expect(page.getByText(/Jordan Rivera/i)).toBeVisible({ timeout: 10_000 });
  await expect(page.getByRole("link", { name: /PDF/i })).toBeVisible();
});
