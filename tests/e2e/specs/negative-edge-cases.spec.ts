import fs from "node:fs/promises";
import path from "node:path";
import { allowDiagnosticFailures, test, expect } from "../helpers/test";
import { ensureSyntheticResumeFixtures } from "../helpers/fixtures";
import { uploadResumeFile } from "../helpers/app";

test("@critical unsupported resume file shows a readable error", async ({ page }) => {
  const dir = path.join(process.cwd(), "tests", "e2e", "fixtures", "resumes", "generated");
  await fs.mkdir(dir, { recursive: true });
  const badFile = path.join(dir, "qa-unsupported.exe");
  await fs.writeFile(badFile, "not a resume");

  await page.goto("/audit?start=upload");
  await expect(page.getByRole("button", { name: /Upload your resume/i })).toBeVisible();
  await uploadResumeFile(page, badFile);
  await expect(page.locator("p", { hasText: /Unsupported file type/i })).toBeVisible({ timeout: 15_000 });
});

test("@critical parse API 500 shows controlled error and does not crash", async ({ page }) => {
  allowDiagnosticFailures("This test intentionally returns a controlled 500 from /api/parse-resume.");
  const [fixture] = await ensureSyntheticResumeFixtures();
  await page.route("**/api/parse-resume", async (route) => {
    await route.fulfill({
      status: 500,
      contentType: "application/json",
      body: JSON.stringify({ error: "Injected parse failure." }),
    });
  });
  await page.goto("/audit?start=upload");
  await expect(page.getByRole("button", { name: /Upload your resume/i })).toBeVisible();
  await uploadResumeFile(page, fixture.path);
  await expect(page.getByText(/Injected parse failure/i)).toBeVisible({ timeout: 10_000 });
});

test("@critical oversized resume is rejected before upload request", async ({ page }) => {
  const dir = path.join(process.cwd(), "tests", "e2e", "fixtures", "resumes", "generated");
  await fs.mkdir(dir, { recursive: true });
  const largeFile = path.join(dir, "qa-oversized-resume.txt");
  await fs.writeFile(largeFile, Buffer.alloc(8 * 1024 * 1024 + 1, "x"));

  let parseCalled = false;
  await page.route("**/api/parse-resume", async (route) => {
    parseCalled = true;
    await route.fulfill({
      status: 500,
      contentType: "application/json",
      body: JSON.stringify({ error: "Oversized file should not be uploaded." }),
    });
  });

  await page.goto("/audit?start=upload");
  await expect(page.getByRole("button", { name: /Upload your resume/i })).toBeVisible();
  await uploadResumeFile(page, largeFile);
  await expect(page.getByText(/File too large \(max 8 MB\)/i)).toBeVisible({ timeout: 10_000 });
  expect(parseCalled).toBe(false);
});
