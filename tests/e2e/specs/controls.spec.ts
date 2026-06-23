import { test, expect } from "../helpers/test";

test("@controls audit chooser buttons navigate or reveal the intended flow", async ({ page }) => {
  await page.goto("/audit");
  await expect(page.getByRole("heading", { name: /How would you like to start/i })).toBeVisible();

  await page.getByRole("button", { name: /I already have a resume/i }).click();
  await expect(page.getByRole("button", { name: /Upload your resume/i })).toBeVisible();
  await page.getByText(/back/i).click();

  await page.getByRole("button", { name: /Import from LinkedIn/i }).click();
  await expect(page).toHaveURL(/\/resume\/import/);
  await page.goBack();

  await page.getByRole("button", { name: /I need to create a resume/i }).click();
  await expect(page).toHaveURL(/\/resume\/new/);
});

test("@controls pricing nav CTA is reachable", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === "mobile-chromium", "Desktop nav links are hidden in the phone layout.");
  await page.goto("/");
  const pricingLink = page.getByRole("link", { name: /Pricing/i }).first();
  await expect(pricingLink).toBeVisible();
  await pricingLink.click();
  await page.waitForURL(/\/pricing/);
});

test("@controls coaching booking CTA is reachable", async ({ page }) => {
  await page.goto("/coaching", { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("link", { name: /Book/i }).or(page.getByRole("button", { name: /Book/i })).first()).toBeVisible();
});
