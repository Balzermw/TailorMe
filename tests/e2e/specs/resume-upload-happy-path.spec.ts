import { test, expect } from "../helpers/test";
import { ensureSyntheticResumeFixtures } from "../helpers/fixtures";
import { mockAgentReview, mockResumeStructure, TEST_JOB_POSTING, uploadResumeFile } from "../helpers/app";
import {
  E2E_REVISION_ACCEPTED_TEXT,
  E2E_REVISION_APP_ID,
} from "@/lib/e2e/revision-fixture";

test("@smoke @critical upload resume to feedback, agent review, editor, and export handoff", async ({
  page,
}) => {
  const [fixture] = await ensureSyntheticResumeFixtures();
  await mockAgentReview(page);
  await mockResumeStructure(page);
  await page.addInitScript(() => {
    window.localStorage.setItem(
      "tm_session_v1",
      JSON.stringify({
        email: "demo.fresh@example.com",
        name: "Demo Fresh",
        at: Date.now(),
      }),
    );
  });

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

  await expect(page.getByRole("button", { name: /Build tailored draft/i })).toBeVisible();
  await page.getByRole("button", { name: /Build tailored draft/i }).click();
  await expect(page).toHaveURL(new RegExp(`/applications/${E2E_REVISION_APP_ID}/edit`), {
    timeout: 15_000,
  });
  await expect(page.getByText(/Avery Stone/i)).toBeVisible({ timeout: 10_000 });
  await expect(page.getByTestId("revision-reviewed-count")).toContainText("0/3 changes reviewed");
  await expect(page.getByText(E2E_REVISION_ACCEPTED_TEXT)).toBeVisible();
  await expect(page.getByRole("link", { name: /PDF/i })).toBeVisible();
});
