import { test, expect } from "../helpers/test";
import {
  RAW_SOURCE_PROFILE_TEXT,
  clearClientState,
  seedRawSourceProfile,
} from "../helpers/app";

test("@smoke @controls raw-only source profiles open in the paste editor", async ({ page }) => {
  await clearClientState(page);
  await seedRawSourceProfile(page);
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

  await page.goto("/dashboard?view=docs");
  await expect(page.getByRole("heading", { name: /Your workspace/i })).toBeVisible();
  const sourceDoc = page.locator(".tmD-doc").filter({ hasText: "Source profile" });
  await expect(sourceDoc).toContainText("Redon Kalemaj");
  const dashboardUpdate = sourceDoc.getByRole("link", { name: /^Update$/i });
  await expect(dashboardUpdate).toHaveAttribute("href", "/resume/import");
  await dashboardUpdate.click();

  await expect(page).toHaveURL(/\/resume\/import/);
  await expect(page.locator("textarea.tmE-textarea")).toHaveValue(RAW_SOURCE_PROFILE_TEXT);

  await page.goto("/resume/new");
  const builderBanner = page.getByRole("status").filter({ hasText: /source profile/i });
  await expect(builderBanner).toContainText("Redon Kalemaj");
  const builderUpdate = builderBanner.getByRole("link", { name: /Update source/i });
  await expect(builderUpdate).toHaveAttribute("href", "/resume/import");
});
