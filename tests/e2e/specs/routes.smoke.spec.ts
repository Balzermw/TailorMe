import { test, expect } from "../helpers/test";
import { expectNoVisibleAppCrash } from "../helpers/observability";

const publicRoutes = [
  "/",
  "/audit",
  "/audit?start=upload",
  "/resume/new",
  "/resume/edit",
  "/resume/import",
  "/resume/print",
  "/applications/tailoring",
  "/transformation",
  "/pricing",
  "/coaching",
  "/contact",
  "/dashboard",
  "/dashboard-demo",
  "/signin",
  "/forgot-password",
  "/settings",
  "/buy-credits",
  "/book-session",
  "/privacy",
  "/terms",
  "/security",
];

test.describe("@smoke @routes route smoke", () => {
  for (const route of publicRoutes) {
    test(`@smoke @routes ${route} renders without a blank or crash state`, async ({ page }) => {
      await page.goto(route);
      await page.waitForLoadState("domcontentloaded");
      await expect(page.locator("body")).toBeVisible();
      await expectNoVisibleAppCrash(page);
    });
  }
});
