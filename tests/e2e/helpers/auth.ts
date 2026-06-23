import type { Page } from "@playwright/test";

export async function clearAuthState(page: Page): Promise<void> {
  await page.addInitScript(() => {
    for (const key of Object.keys(window.localStorage)) {
      if (/supabase|sb-|auth|tm_/.test(key)) window.localStorage.removeItem(key);
    }
    for (const key of Object.keys(window.sessionStorage)) {
      if (/supabase|sb-|auth|tm_/.test(key)) window.sessionStorage.removeItem(key);
    }
  });
}

export async function assertDemoSignedOutMode(page: Page): Promise<void> {
  await page.goto("/signin");
  await page.getByText(/Your first application is free/i).waitFor();
}
