import { test, expect } from "../helpers/test";
import { seedLocalResume } from "../helpers/app";
import { expectPrintOrDownloadTarget } from "../helpers/downloads";

test("@critical resume PDF export opens a valid print/download target", async ({ page }) => {
  await seedLocalResume(page);
  await page.goto("/resume/edit");
  await expect(page.getByText(/Jordan Rivera/i)).toBeVisible({ timeout: 10_000 });
  await expectPrintOrDownloadTarget(page, async () => {
    await page.getByRole("link", { name: /PDF/i }).click();
  });
});
