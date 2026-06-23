import { test as base, expect } from "@playwright/test";
import { attachPageDiagnostics, expectDiagnosticsClean, type PageDiagnostics } from "./observability";

export const ALLOW_DIAGNOSTICS = "allow-diagnostics";

export const test = base.extend<{ diagnostics: PageDiagnostics }>({
  diagnostics: async ({ page }, run, testInfo) => {
    const realResume = /@real-corpus/.test(testInfo.title);
    const diagnostics = attachPageDiagnostics(page, testInfo, { realResume });
    await run(diagnostics);
    const allowed = testInfo.annotations.some((a) => a.type === ALLOW_DIAGNOSTICS);
    if (testInfo.status === testInfo.expectedStatus && !allowed) {
      await expectDiagnosticsClean(diagnostics);
    } else {
      await diagnostics.attach();
    }
  },
});

export { expect };

export function allowDiagnosticFailures(reason: string): void {
  test.info().annotations.push({ type: ALLOW_DIAGNOSTICS, description: reason });
}
