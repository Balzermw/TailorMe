import type { Page, TestInfo } from "@playwright/test";
import { expect } from "@playwright/test";
import { findSensitiveLeak, redactJsonString, redactText, type RedactionContext } from "./redact";

export interface DiagnosticsOptions extends RedactionContext {
  allowConsoleErrors?: boolean;
  allowNetworkErrors?: boolean;
  allowServerErrors?: boolean;
}

export interface PageDiagnostics {
  consoleErrors: string[];
  pageErrors: string[];
  requestFailures: string[];
  serverErrors: string[];
  telemetryLeaks: string[];
  telemetryBodies: string[];
  attach: () => Promise<void>;
  issues: () => string[];
}

export function attachPageDiagnostics(
  page: Page,
  testInfo: TestInfo,
  options: DiagnosticsOptions = {},
): PageDiagnostics {
  const diagnostics: PageDiagnostics = {
    consoleErrors: [],
    pageErrors: [],
    requestFailures: [],
    serverErrors: [],
    telemetryLeaks: [],
    telemetryBodies: [],
    attach: async () => {
      const body = JSON.stringify(
        {
          consoleErrors: diagnostics.consoleErrors,
          pageErrors: diagnostics.pageErrors,
          requestFailures: diagnostics.requestFailures,
          serverErrors: diagnostics.serverErrors,
          telemetryLeaks: diagnostics.telemetryLeaks,
          telemetryBodies: diagnostics.telemetryBodies,
        },
        null,
        2,
      );
      if (body !== "{}") {
        await testInfo.attach("page-diagnostics.json", {
          body,
          contentType: "application/json",
        });
      }
    },
    issues: () => [
      ...(options.allowConsoleErrors ? [] : diagnostics.consoleErrors.map((m) => `console: ${m}`)),
      ...diagnostics.pageErrors.map((m) => `pageerror: ${m}`),
      ...(options.allowNetworkErrors
        ? []
        : diagnostics.requestFailures.map((m) => `requestfailed: ${m}`)),
      ...(options.allowServerErrors ? [] : diagnostics.serverErrors.map((m) => `server: ${m}`)),
      ...diagnostics.telemetryLeaks.map((m) => `telemetry: ${m}`),
    ],
  };

  page.on("console", (message) => {
    if (message.type() !== "error") return;
    const text = message.text();
    if (isIgnoredConsoleError(text)) return;
    diagnostics.consoleErrors.push(redactText(text, options));
  });

  page.on("pageerror", (error) => {
    diagnostics.pageErrors.push(redactText(error.stack || error.message, options));
  });

  page.on("requestfailed", (request) => {
    const failure = request.failure();
    const url = request.url();
    if (isIgnoredRequestFailure(url, failure?.errorText)) return;
    diagnostics.requestFailures.push(
      redactText(`${request.method()} ${url} ${failure?.errorText ?? ""}`, options),
    );
  });

  page.on("request", (request) => {
    if (!request.url().includes("/api/events")) return;
    const body = request.postData() ?? "";
    if (body) {
      diagnostics.telemetryBodies.push(redactJsonString(body, options));
      const leaks = findSensitiveLeak(body, options.names);
      for (const leak of leaks) diagnostics.telemetryLeaks.push(leak);
    }
  });

  page.on("response", (response) => {
    const status = response.status();
    if (status < 500) return;
    const url = response.url();
    if (isIgnoredServerResponse(url)) return;
    diagnostics.serverErrors.push(redactText(`${status} ${response.request().method()} ${url}`, options));
  });

  return diagnostics;
}

export async function expectNoVisibleAppCrash(page: Page): Promise<void> {
  const body = page.locator("body");
  await expect(body).not.toContainText(/Unhandled Runtime Error|Application error|Hydration failed/i);
  await expect(body).not.toHaveText(/^\s*$/);
}

export async function expectDiagnosticsClean(diagnostics: PageDiagnostics): Promise<void> {
  await diagnostics.attach();
  expect(diagnostics.issues()).toEqual([]);
}

function isIgnoredConsoleError(text: string): boolean {
  return /favicon\.ico|ResizeObserver loop limit exceeded/i.test(text);
}

function isIgnoredRequestFailure(url: string, errorText = ""): boolean {
  if (/favicon\.ico|\/_next\/webpack-hmr/i.test(url)) return true;
  if (/net::ERR_ABORTED/i.test(errorText)) return true;
  return false;
}

function isIgnoredServerResponse(url: string): boolean {
  return /\/api\/events$/.test(url);
}
