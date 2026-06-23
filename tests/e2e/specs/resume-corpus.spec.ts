import { test, expect } from "../helpers/test";
import { ensureSyntheticResumeFixtures } from "../helpers/fixtures";
import { uploadResumeFile } from "../helpers/app";

test("@corpus parses at least five representative synthetic resume fixtures", async ({ page }) => {
  const fixtures = (await ensureSyntheticResumeFixtures()).slice(0, 5);
  const failures: string[] = [];

  for (const fixture of fixtures) {
    await test.step(`parse ${fixture.id}`, async () => {
      await page.goto("/audit?start=upload");
      await page.evaluate(() => {
        window.localStorage.clear();
        window.sessionStorage.clear();
      });
      await page.goto("/audit?start=upload");
      await expect(page.getByRole("button", { name: /Upload your resume/i })).toBeVisible();
      await uploadResumeFile(page, fixture.path);
      try {
        await expect(page.getByRole("button", { name: /Next: pick the job/i })).toBeVisible({
          timeout: 20_000,
        });
      } catch (error) {
        failures.push(`${fixture.id}: ${error instanceof Error ? error.message : String(error)}`);
      }
    });
  }

  expect(failures).toEqual([]);
});
