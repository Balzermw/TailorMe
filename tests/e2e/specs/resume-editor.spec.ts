import { test, expect } from "../helpers/test";
import { seedLocalResume } from "../helpers/app";

test("@critical editor supports adding content, saving, feedback, and target-job handoff", async ({ page }) => {
  await seedLocalResume(page);
  await page.goto("/resume/edit");
  await expect(page.getByText(/Jordan Rivera/i)).toBeVisible({ timeout: 10_000 });

  await page.getByRole("button", { name: /^Experience/i }).click();
  await page.getByRole("button", { name: /Customer Support Specialist/i }).click();
  await page.getByRole("button", { name: /Add bullet/i }).click();
  await page.locator(".tmE-bullet-row textarea").last().fill("Reduced escalation backlog by 18% in one quarter.");
  await page.getByRole("button", { name: /Save resume/i }).click();
  await expect(page.getByText(/^Saved$/)).toBeVisible();

  await page.getByRole("tab", { name: /^Feedback/i }).click();
  await page.getByRole("button", { name: /Get feedback/i }).click();
  await expect(page.locator(".tmE-fix-status")).toContainText(/Looks solid|No major issues/i, {
    timeout: 10_000,
  });

  await page.getByRole("button", { name: /Target a job/i }).click();
  await expect(page).toHaveURL(/\/audit\?from=base/);
});
