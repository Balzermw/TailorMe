import fs from "node:fs/promises";
import path from "node:path";
import type { Download, Page } from "@playwright/test";
import { expect } from "@playwright/test";

export async function expectDownloadNonEmpty(download: Download, expectedExtension?: string): Promise<void> {
  const filePath = await download.path();
  expect(filePath).toBeTruthy();
  if (!filePath) return;
  const stat = await fs.stat(filePath);
  expect(stat.size).toBeGreaterThan(0);
  if (expectedExtension) {
    expect(download.suggestedFilename().toLowerCase()).toMatch(
      new RegExp(`${escapeRegExp(expectedExtension.toLowerCase())}$`),
    );
  }
}

export async function expectPrintOrDownloadTarget(page: Page, click: () => Promise<void>): Promise<void> {
  const popupPromise = page.waitForEvent("popup").catch(() => null);
  const downloadPromise = page.waitForEvent("download").catch(() => null);
  await click();
  const [popup, download] = await Promise.all([popupPromise, downloadPromise]);
  if (download) {
    await expectDownloadNonEmpty(download);
    return;
  }
  expect(popup).toBeTruthy();
  if (popup) {
    await popup.waitForLoadState("domcontentloaded");
    await expect(popup.locator("body")).not.toHaveText(/^\s*$/);
    await popup.close();
  }
}

export function artifactPath(...parts: string[]): string {
  return path.join(process.cwd(), "tests", "e2e", "results", ...parts);
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
