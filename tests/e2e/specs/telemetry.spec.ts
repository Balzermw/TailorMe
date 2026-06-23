import { test, expect } from "../helpers/test";
import { findSensitiveLeak } from "../helpers/redact";

test("@critical telemetry events stay allowlisted and PII-free during key interactions", async ({ page }) => {
  const bodies: string[] = [];
  await page.route("**/api/events", async (route) => {
    bodies.push(route.request().postData() ?? "");
    await route.fulfill({ status: 204, body: "" });
  });

  await page.goto("/audit");
  await page.getByRole("button", { name: /I need to create a resume/i }).click();
  await expect(page).toHaveURL(/\/resume\/new/);
  await page.waitForTimeout(4_500);

  expect(bodies.length).toBeGreaterThan(0);
  for (const body of bodies) {
    expect(findSensitiveLeak(body)).toEqual([]);
    expect(body).not.toContain("Jordan Rivera");
    expect(body).not.toContain("Senior Platform Engineer");
  }
});
