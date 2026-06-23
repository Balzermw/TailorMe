import { test, expect } from "../helpers/test";

test("@critical start-from-scratch validates required fields", async ({ page }) => {
  await page.goto("/resume/new");
  await page.getByRole("button", { name: /Create my resume/i }).click();
  await expect(page.getByText(/Add your name/i)).toBeVisible();
});

test("@critical start-from-scratch creates a saved editable base resume", async ({ page }) => {
  await page.goto("/resume/new");
  await page.getByPlaceholder("Jordan Rivera").fill("Sam Carter");
  await page.getByPlaceholder("you@email.com").fill("sam.synthetic@example.com");
  await page.getByPlaceholder("612-227-1149").fill("555-010-1500");
  await page.getByPlaceholder("Portland, OR").fill("Chicago, IL");
  await page.getByPlaceholder("Customer Support Specialist").fill("Operations Analyst");
  await page.locator('input[placeholder="Support Specialist"]').fill("Operations Analyst");
  await page.getByPlaceholder("Acme Inc.").fill("Bright Ops");
  await page.getByPlaceholder(/Jan 2022/i).fill("Jan 2021 - Present");
  await page
    .getByPlaceholder(/Resolved 40\+ tickets/i)
    .fill("Improved weekly reporting accuracy by 31%.\nCoordinated launch tasks across four teams.");
  await page.getByRole("button", { name: /Add education/i }).click();
  await page.getByPlaceholder("BSc Computer Science").fill("BA Business");
  await page.getByPlaceholder("State University").fill("Midwest College");
  await page.getByPlaceholder("2016").fill("2019");
  await page.locator('textarea[placeholder*="Zendesk"]').fill("Excel\nSQL\nOperations reporting");

  await page.getByRole("button", { name: /Create my resume/i }).click();
  await expect(page).toHaveURL(/\/resume\/edit/);
  await expect(page.getByText(/Sam Carter/i)).toBeVisible({ timeout: 10_000 });
  await expect(page.getByRole("button", { name: /Target a job/i })).toBeVisible();
});
