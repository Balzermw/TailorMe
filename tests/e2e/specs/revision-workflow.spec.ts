import { test, expect } from "../helpers/test";
import type { Page } from "@playwright/test";
import { findSensitiveLeak } from "../helpers/redact";
import {
  E2E_REVISION_ACCEPTED_TEXT,
  E2E_REVISION_APP_ID,
  E2E_REVISION_BAD_AI_TEXT,
  E2E_REVISION_CUSTOM_TEXT,
  E2E_REVISION_QUOTED_TEXT,
  E2E_REVISION_REJECTED_SOURCE_TEXT,
  E2E_REVISION_STORAGE_KEY,
} from "../../../src/lib/e2e/revision-fixture";

const EDIT_PATH = `/applications/${E2E_REVISION_APP_ID}/edit`;

test.beforeEach(async ({ page }) => {
  await page.addInitScript((storageKey) => {
    const resetKey = `${storageKey}_reset_done`;
    if (window.sessionStorage.getItem(resetKey) === "1") return;
    window.localStorage.removeItem(storageKey);
    window.sessionStorage.clear();
    window.sessionStorage.setItem(resetKey, "1");
  }, E2E_REVISION_STORAGE_KEY);
});

test("@critical revision accept, reject, edit, reload, and print stay in sync", async ({ page }) => {
  const telemetryBodies = await captureTelemetry(page);
  await openRevisionFixture(page);

  const preview = page.getByTestId("resume-live-preview");
  await expect(page.getByTestId("revision-reviewed-count")).toHaveText("0 of 3 AI changes reviewed");
  await expect(page.getByRole("button", { name: /Review my edits/i })).toHaveCount(0);

  await page.getByTestId("revision-accept-0-0").click();
  await expect(page.getByTestId("revision-accept-0-0")).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByTestId("revision-reviewed-count")).toHaveText("1 of 3 AI changes reviewed");
  await expect(preview).toContainText(E2E_REVISION_ACCEPTED_TEXT);
  await expect(page.getByRole("button", { name: /Review my edits/i })).toHaveCount(0);

  await page.getByTestId("revision-reject-0-1").click();
  await expect(page.getByTestId("revision-reject-0-1")).toHaveAttribute("aria-pressed", "true");
  await expect(preview).toContainText(E2E_REVISION_REJECTED_SOURCE_TEXT);
  await expect(preview).not.toContainText(E2E_REVISION_BAD_AI_TEXT);

  await page.getByTestId("revision-accept-0-1").click();
  await expect(preview).toContainText(E2E_REVISION_BAD_AI_TEXT);
  await page.getByTestId("revision-reject-0-1").click();
  await expect(preview).toContainText(E2E_REVISION_REJECTED_SOURCE_TEXT);
  await expect(page.getByTestId("revision-reviewed-count")).toHaveText("2 of 3 AI changes reviewed");

  await page.getByTestId("revision-edit-0-2").click();
  await expect(page.getByTestId("revision-edit-0-2")).toHaveAttribute("aria-pressed", "true");
  await page.getByTestId("revision-custom-bullet-0-2").fill(E2E_REVISION_CUSTOM_TEXT);
  await expect(page.getByRole("button", { name: /Review my edits/i })).toBeVisible();
  await expect(preview).toContainText(E2E_REVISION_CUSTOM_TEXT);
  await expect(page.getByTestId("revision-reviewed-count")).toHaveText("3 of 3 AI changes reviewed");

  await page.getByRole("button", { name: /Save edits/i }).click();
  await expect(page.getByRole("button", { name: /^Saved$/ })).toBeVisible();

  await page.reload();
  await expect(page.getByText(/Customer Operations Analyst/i)).toBeVisible();
  await page.getByRole("button", { name: /^Experience/i }).click();
  await expect(page.getByTestId("revision-reviewed-count")).toHaveText("3 of 3 AI changes reviewed");
  await expect(page.getByTestId("revision-accept-0-0")).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByTestId("revision-reject-0-1")).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByTestId("revision-edit-0-2")).toHaveAttribute("aria-pressed", "true");
  await expect(preview).toContainText(E2E_REVISION_ACCEPTED_TEXT);
  await expect(preview).toContainText(E2E_REVISION_REJECTED_SOURCE_TEXT);
  await expect(preview).toContainText(E2E_REVISION_CUSTOM_TEXT);
  await expect(preview).not.toContainText(E2E_REVISION_BAD_AI_TEXT);

  const popupPromise = page.waitForEvent("popup");
  await page.getByRole("link", { name: /PDF/i }).click();
  const printPage = await popupPromise;
  await printPage.waitForLoadState("domcontentloaded");
  await expect(printPage.getByTestId("print-document")).toContainText(E2E_REVISION_CUSTOM_TEXT);
  await expect(printPage.getByTestId("print-document")).toContainText(E2E_REVISION_REJECTED_SOURCE_TEXT);
  await expect(printPage.getByTestId("print-document")).not.toContainText(E2E_REVISION_BAD_AI_TEXT);
  await printPage.close();

  expectTelemetryClean(telemetryBodies);
});

test("@critical resolved feedback suggestions clear without duplicating pending cards", async ({ page }) => {
  const telemetryBodies = await captureTelemetry(page);
  await openRevisionFixture(page);

  await page.getByRole("tab", { name: /^Feedback/i }).click();
  await expect(page.getByTestId("feedback-suggestion")).toHaveCount(2);
  await expect(page.getByText("Rewrite the stale tracker line")).toBeVisible();
  await expect(page.getByText("Add a project section")).toBeVisible();

  await page.getByRole("button", { name: /Refresh/i }).click();
  await expect(page.getByRole("button", { name: /Up to date/i })).toBeVisible();
  await expect(page.getByTestId("feedback-suggestion")).toHaveCount(2);

  await page.getByRole("button", { name: /^Experience/i }).click();
  await page.getByTestId("revision-edit-0-2").click();
  await page.getByTestId("revision-custom-bullet-0-2").fill(E2E_REVISION_CUSTOM_TEXT);
  await expect(page.getByTestId("resume-live-preview")).not.toContainText(
    new RegExp(E2E_REVISION_QUOTED_TEXT, "i"),
  );

  await page.getByRole("tab", { name: /^Feedback/i }).click();
  await expect(page.getByText("Rewrite the stale tracker line")).toHaveCount(0);
  await expect(page.getByText("Add a project section")).toBeVisible();
  await expect(page.getByRole("button", { name: /Up to date/i })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /Refresh/i })).toBeVisible();

  await page.getByRole("button", { name: /Refresh/i }).click();
  await expect(page.getByTestId("feedback-suggestion")).toHaveCount(1);
  await expect(page.getByText("Rewrite the stale tracker line")).toHaveCount(0);
  await expect(page.getByText("Add a project section")).toBeVisible();
  await expect(page.getByRole("button", { name: /Up to date/i })).toBeVisible();

  expectTelemetryClean(telemetryBodies);
});

test("@critical review my edits sends changed bullets, handles verdicts, undo, and errors", async ({
  page,
}) => {
  let reviewCalls = 0;
  const reviewBodies: Array<{ changes?: Array<{ id: string; kind: string; original: string; edited: string }> }> = [];
  await page.route("**/api/review-edits", async (route) => {
    reviewCalls += 1;
    const body = route.request().postDataJSON() as { changes?: Array<{ id: string; kind: string; original: string; edited: string }> };
    reviewBodies.push(body);

    if (reviewCalls === 2) {
      await route.fulfill({
        status: 503,
        contentType: "application/json",
        body: JSON.stringify({ error: "Temporary review outage." }),
      });
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        reviews: [
          { id: "summary", verdict: "improved", note: "Sharper summary keeps the operations target." },
          { id: "b:0:0", verdict: "okay", note: "Acceptable edit, but the 40% result is less prominent." },
          { id: "b:0:2", verdict: "risky", note: "Risky because it removes the reporting outcome." },
        ],
      }),
    });
  });

  await openRevisionFixture(page);
  await expect(page.getByRole("button", { name: /Review my edits/i })).toHaveCount(0);

  await page.getByTestId("revision-accept-0-0").click();
  await page.getByTestId("revision-reject-0-1").click();
  await expect(page.getByRole("button", { name: /Review my edits/i })).toHaveCount(0);
  expect(reviewCalls).toBe(0);

  await page.getByRole("button", { name: /^Summary/i }).click();
  await page.locator("textarea.tmE-textarea--lg").fill(
    "Operations analyst who turns messy support data into clear SLA reporting for leadership.",
  );
  await page.getByRole("button", { name: /^Experience/i }).click();
  await page.getByTestId("revision-edit-0-0").click();
  await page
    .getByTestId("revision-custom-bullet-0-0")
    .fill("Built Tableau reporting for 6 support managers and highlighted SLA risk trends weekly.");
  await page.getByTestId("revision-edit-0-2").click();
  await page.getByTestId("revision-custom-bullet-0-2").fill(E2E_REVISION_CUSTOM_TEXT);

  await page.getByRole("button", { name: /Review my edits/i }).click();
  await expect(page.getByText(/AI reviewed your 3 edits/i)).toBeVisible();
  expect(reviewBodies[0].changes?.map((change) => change.id)).toEqual([
    "summary",
    "b:0:0",
    "b:0:2",
  ]);
  expect(reviewBodies[0].changes?.some((change) => change.id === "b:0:1")).toBe(false);
  await expect(page.locator('[data-review-id="summary"]')).toContainText("Improved");
  await expect(page.locator('[data-review-id="b:0:0"]')).toContainText("Okay");
  await expect(page.locator('[data-review-id="b:0:2"]')).toContainText("Risky");
  await expect(page.locator('[data-review-id="b:0:2"]')).toContainText(
    "removes the reporting outcome",
  );

  await page.locator('[data-review-id="b:0:2"]').getByRole("button", { name: /Revert/i }).click();
  await expect(page.locator('[data-review-id="b:0:2"]')).toHaveCount(0);
  await expect(page.getByTestId("resume-live-preview")).toContainText(
    "Maintained an outdated escalation tracker for monthly leadership updates.",
  );

  await page.getByRole("button", { name: /Undo my edits/i }).click();
  await expect(page.getByTestId("revision-reviewed-count")).toHaveText("0 of 3 AI changes reviewed");
  await expect(page.getByRole("button", { name: /Review my edits/i })).toHaveCount(0);
  await page.getByRole("button", { name: /Save edits/i }).click();
  await expect(page.getByRole("button", { name: /^Saved$/ })).toBeVisible();
  expect(reviewCalls).toBe(1);

  await page.getByRole("button", { name: /^Summary/i }).click();
  await page.locator("textarea.tmE-textarea--lg").fill("A small changed summary for error recovery.");
  await page.getByRole("button", { name: /Review my edits/i }).click();
  await expect(page.getByText("Temporary review outage.")).toBeVisible();
  await page.getByRole("button", { name: /Review my edits/i }).click();
  await expect(page.getByText(/AI reviewed your 1 edit/i)).toBeVisible();
  expect(reviewCalls).toBe(3);
});

async function openRevisionFixture(page: Page) {
  await page.goto(EDIT_PATH);
  await expect(page.getByText(/Customer Operations Analyst/i)).toBeVisible();
  await page.getByRole("button", { name: /^Experience/i }).click();
}

async function captureTelemetry(page: Page): Promise<string[]> {
  const bodies: string[] = [];
  await page.route("**/api/events", async (route) => {
    bodies.push(route.request().postData() ?? "");
    await route.fulfill({ status: 204, body: "" });
  });
  return bodies;
}

function expectTelemetryClean(bodies: string[]): void {
  for (const body of bodies) {
    expect(findSensitiveLeak(body, [
      "Avery Stone",
      "avery.synthetic@example.com",
      E2E_REVISION_ACCEPTED_TEXT,
      E2E_REVISION_CUSTOM_TEXT,
    ])).toEqual([]);
  }
}
