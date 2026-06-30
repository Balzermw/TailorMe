import { test, expect } from "../helpers/test";
import {
  E2E_AGENT_AI_REWRITE_EDITED,
  E2E_AGENT_ADA_KEYWORD,
  E2E_AGENT_MAX_EDITED,
  E2E_AGENT_MAX_ORIGINAL,
  E2E_AGENT_REVIEW_APP_ID,
  E2E_AGENT_REVIEW_STORAGE_KEY,
  E2E_REVISION_APP_ID,
  E2E_REVISION_STORAGE_KEY,
} from "../../../src/lib/e2e/revision-fixture";

const AGENT_EDIT_PATH = `/applications/${E2E_AGENT_REVIEW_APP_ID}/edit`;

test.beforeEach(async ({ page }) => {
  await page.addInitScript(
    ([agentKey, revisionKey]) => {
      const resetKey = `${agentKey}_reset_done`;
      if (window.sessionStorage.getItem(resetKey) === "1") return;
      window.localStorage.removeItem(agentKey);
      window.localStorage.removeItem(revisionKey);
      window.sessionStorage.clear();
      window.sessionStorage.setItem(resetKey, "1");
    },
    [E2E_AGENT_REVIEW_STORAGE_KEY, E2E_REVISION_STORAGE_KEY],
  );
});

test("@critical Agent Review v2 shows aggregate agent suggestions and persists decisions", async ({ page }) => {
  await page.route("**/api/resume/rewrite", async (route) => {
    const body = route.request().postDataJSON() as { section?: string };
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        rewrite: body.section === "skills" ? E2E_AGENT_ADA_KEYWORD : E2E_AGENT_MAX_EDITED,
      }),
    });
  });

  await page.goto(AGENT_EDIT_PATH);
  await expect(page.getByRole("heading", { name: /Customer Engineer at Applied Materials/i })).toBeVisible();
  await expect(page.getByTestId("revision-reviewed-count")).toHaveText("0 of 4 agent changes reviewed");
  await expect(page.getByText(/AI rewrite/i)).toHaveCount(0);
  await expect(page.getByRole("tab", { name: /3 Agent Review 4/i })).toBeVisible();
  await page.getByRole("tab", { name: /3 Agent Review/i }).click();

  // Guided model: the panel opens on Ada's pass and shows only her progress,
  // context, and cards. Remy's and Max's passes wait until you select them.
  await expect(page.getByText("0 of 4 reviewed")).toBeVisible();
  await expect(page.getByRole("button", { name: /Add suggestion/i })).toHaveCount(0);
  await expect(page.getByTestId("agent-pass-ada_ats")).toContainText("ATS 72/100");
  await expect(page.getByTestId("agent-pass-remy_rolefit")).toContainText("Role Fit 81/100");
  await expect(page.getByTestId("agent-pass-max_impact")).toContainText("Impact 64/100");
  await expect(page.getByText("Ada's ATS score estimates keyword coverage and parser readiness.")).toBeVisible();

  await expect(page.getByText(`Add ATS keyword: ${E2E_AGENT_ADA_KEYWORD}`)).toBeVisible();
  await expect(page.getByText("Review role-fit rewrite")).toHaveCount(0);
  await expect(page.getByText("Tighten a marginal line")).toHaveCount(0);
  await expect(page.getByText("Add a truthful metric")).toHaveCount(0);

  await page.getByTestId("agent-pass-remy_rolefit").click();
  await expect(page.getByText("Remy's Role Fit score estimates how directly the resume supports this target role.")).toBeVisible();
  // Switching passes filters the cards: Ada's keyword card is gone, Remy's appear.
  await expect(page.getByText(`Add ATS keyword: ${E2E_AGENT_ADA_KEYWORD}`)).toHaveCount(0);
  const roleFitRewriteCard = page.locator(".tmE-fix", { hasText: "Review role-fit rewrite" });
  await expect(roleFitRewriteCard).toBeVisible();
  await expect(page.getByTestId("resume-live-preview")).toContainText(E2E_AGENT_AI_REWRITE_EDITED);
  await roleFitRewriteCard.getByRole("button", { name: /^Accept$/ }).click();
  await expect(page.getByText("Review role-fit rewrite")).toHaveCount(0);
  await expect(page.getByText("Tighten a marginal line")).toBeVisible();
  await expect(page.getByTestId("resume-live-preview")).toContainText(E2E_AGENT_MAX_ORIGINAL);
  const marginalLineCard = page.locator(".tmE-fix", { hasText: "Tighten a marginal line" });
  await marginalLineCard.getByRole("button", { name: /^Dismiss$/ }).click();
  await expect(page.getByText("Tighten a marginal line")).toHaveCount(0);
  // Remy's pass is now cleared, so its completion + handoff to the next pass shows.
  await expect(page.getByText("Remy's pass is complete.")).toBeVisible();
  await expect(page.getByTestId("resume-live-preview")).toContainText(E2E_AGENT_MAX_ORIGINAL);

  await page.getByTestId("agent-pass-max_impact").click();
  await expect(page.getByText("Max's Impact score estimates how much proof, scale, and measurable outcome appears in the resume.")).toBeVisible();
  const metricCard = page.locator(".tmE-fix", { hasText: "Add a truthful metric" });
  await expect(metricCard).toBeVisible();
  await expect(metricCard.getByText("Only add real metrics you can support.")).toBeVisible();
  const draftFixButton = metricCard.getByRole("button", { name: /Draft fix with AI/i });
  await draftFixButton.scrollIntoViewIfNeeded();
  const draftScrollY = await page.evaluate(() => window.scrollY);
  await draftFixButton.click();
  await expect(page.locator(".tmE-draft-ta")).toHaveValue(E2E_AGENT_MAX_EDITED);
  await expect
    .poll(async () => Math.abs((await page.evaluate(() => window.scrollY)) - draftScrollY))
    .toBeLessThan(8);
  await page.locator(".tmE-draft-ta").fill(
    E2E_AGENT_MAX_EDITED.replace("[insert real metric]", "20 tool escalations per month"),
  );
  await metricCard.getByRole("button", { name: /Apply to Experience/i }).click();
  await expect(page.getByTestId("resume-live-preview")).toContainText(
    "20 tool escalations per month",
  );
  await expect(
    page.locator(".tmE-preview .mcv-add", { hasText: "20 tool escalations per month" }),
  ).toBeVisible();
  await expect(page.getByRole("tab", { name: /3 Agent Review/i })).toHaveAttribute("aria-selected", "true");
  await expect(page.getByRole("button", { name: /Edit Experience/i })).toBeVisible();
  await expect(page.getByText("Add a truthful metric")).toHaveCount(0);

  await page.getByTestId("agent-pass-ada_ats").click();
  const keywordCard = page.locator(".tmE-fix", { hasText: `Add ATS keyword: ${E2E_AGENT_ADA_KEYWORD}` });
  await keywordCard.getByRole("button", { name: /Draft fix with AI/i }).click();
  await expect(page.locator(".tmE-draft-ta")).toHaveValue(E2E_AGENT_ADA_KEYWORD);
  await keywordCard.getByRole("button", { name: /Apply to Skills/i }).click();
  await expect(page.getByTestId("resume-live-preview")).toContainText(E2E_AGENT_ADA_KEYWORD);
  await expect(page.getByRole("tab", { name: /3 Agent Review/i })).toHaveAttribute("aria-selected", "true");
  await expect(page.getByRole("button", { name: /Edit Skills/i })).toBeVisible();
  await expect(page.getByTestId("revision-reviewed-count")).toHaveText("4 of 4 agent changes reviewed");
  await expect(page.getByText("All 3 agent passes reviewed.")).toBeVisible();

  await page.getByRole("button", { name: /Save edits/i }).click();
  await expect(page.getByRole("button", { name: /^Saved$/ })).toBeVisible();
  await page.reload();
  await page.getByRole("tab", { name: /3 Agent Review/i }).click();
  await expect(page.getByText("All 3 agent passes reviewed.")).toBeVisible();
  await expect(page.getByText(`Add ATS keyword: ${E2E_AGENT_ADA_KEYWORD}`)).toHaveCount(0);
  await expect(page.getByText("Tighten a marginal line")).toHaveCount(0);
  await expect(page.getByText("Add a truthful metric")).toHaveCount(0);
  await expect(page.getByText("Review role-fit rewrite")).toHaveCount(0);
  await expect(page.getByTestId("resume-live-preview")).toContainText(E2E_AGENT_ADA_KEYWORD);
  await expect(page.getByTestId("resume-live-preview")).toContainText(
    "20 tool escalations per month",
  );

  const popupPromise = page.waitForEvent("popup");
  await page.getByRole("link", { name: /PDF/i }).click();
  const printPage = await popupPromise;
  await printPage.waitForLoadState("domcontentloaded");
  await expect(printPage.getByTestId("print-document")).toContainText(E2E_AGENT_ADA_KEYWORD);
  await expect(printPage.getByTestId("print-document")).toContainText(
    "20 tool escalations per month",
  );
  await printPage.close();
});

test("@critical old revision rows without agentPasses still load generic feedback", async ({ page }) => {
  await page.goto(`/applications/${E2E_REVISION_APP_ID}/edit`);
  await expect(page.getByText(/Customer Operations Analyst/i)).toBeVisible();
  await page.getByRole("tab", { name: /^Feedback/i }).click();
  await expect(page.getByText("Rewrite the stale tracker line")).toBeVisible();
  await expect(page.getByRole("button", { name: /Add suggestion/i })).toHaveCount(0);
  await expect(page.getByTestId("agent-pass-ada_ats")).toHaveCount(0);
});
