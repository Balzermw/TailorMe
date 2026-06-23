import fs from "node:fs/promises";
import path from "node:path";
import { chromium, type Page } from "@playwright/test";
import { buildRouteInventory, writeRouteInventory, type RouteInventoryItem } from "./inventory-routes";

export interface ControlInventoryItem {
  id: string;
  pageRoute: string;
  sourceFile: string;
  controlName: string;
  controlType: string;
  selectorStrategy: string;
  accessibleNamePresent: "yes" | "no";
  expectedBehavior: string;
  requiredInputs: string;
  normalState: string;
  emptyState: string;
  invalidState: string;
  loadingState: string;
  successState: string;
  errorState: string;
  disabledStateExpected: "yes" | "no" | "unknown";
  keyboardActivationExpected: "yes" | "no";
  telemetryEventExpected: "yes" | "no" | "unknown";
  expectedTelemetryEventName: string;
  testFile: string;
  testStatus: "not started" | "automated" | "manual" | "blocked" | "passed" | "failed";
  notes: string;
  bugId: string;
}

const docsDir = path.join(process.cwd(), "docs", "qa");

export async function inventoryControls(): Promise<ControlInventoryItem[]> {
  const baseURL = process.env.E2E_BASE_URL || process.env.NEXT_PUBLIC_APP_URL || "http://127.0.0.1:3000";
  const routes = await buildRouteInventory();
  await writeRouteInventory(routes);
  const publicRoutes = routes.filter((route) => shouldVisit(route));
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const controls: ControlInventoryItem[] = [];

  try {
    for (const route of publicRoutes) {
      const url = new URL(route.routePath, baseURL).toString();
      await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30_000 }).catch(() => null);
      await page.waitForLoadState("networkidle", { timeout: 5_000 }).catch(() => null);
      const pageControls = await extractControls(page);
      for (const control of pageControls) {
        controls.push({
          id: `QA-${String(controls.length + 1).padStart(4, "0")}`,
          pageRoute: route.routePath,
          sourceFile: route.sourceFile,
          controlName: control.name || "(missing accessible name)",
          controlType: control.type,
          selectorStrategy: control.selectorStrategy,
          accessibleNamePresent: control.name ? "yes" : "no",
          expectedBehavior: inferExpectedBehavior(control),
          requiredInputs: "TBD from test or manual QA",
          normalState: control.disabled ? "disabled on inventory crawl" : "visible",
          emptyState: "TBD",
          invalidState: "TBD",
          loadingState: "TBD",
          successState: "TBD",
          errorState: "TBD",
          disabledStateExpected: control.disabled ? "yes" : "unknown",
          keyboardActivationExpected: ["button", "link", "tab", "menuitem"].includes(control.type)
            ? "yes"
            : "no",
          telemetryEventExpected: inferTelemetryExpected(control),
          expectedTelemetryEventName: "",
          testFile: inferTestFile(route.routePath),
          testStatus: "not started",
          notes: control.notes,
          bugId: "",
        });
      }
    }
  } finally {
    await browser.close();
  }

  await writeAcceptanceMatrix(controls);
  return controls;
}

export async function writeAcceptanceMatrix(items: ControlInventoryItem[]): Promise<void> {
  await fs.mkdir(docsDir, { recursive: true });
  await fs.writeFile(path.join(docsDir, "acceptance-matrix.json"), JSON.stringify(items, null, 2), "utf8");
  await fs.writeFile(path.join(docsDir, "acceptance-matrix.csv"), toCsv(items), "utf8");
  const markdown = toMarkdown(items);
  await fs.writeFile(path.join(docsDir, "ACCEPTANCE_MATRIX.md"), markdown, "utf8");
  await fs.writeFile(path.join(docsDir, "acceptance-matrix.md"), markdown, "utf8");
}

async function extractControls(page: Page): Promise<
  { name: string; type: string; selectorStrategy: string; disabled: boolean; notes: string }[]
> {
  return page.evaluate(() => {
    const selector =
      "button,a[href],input,select,textarea,[role='button'],[role='menuitem'],[role='tab'],[role='switch'],[role='checkbox'],[role='radio']";
    const nodes = Array.from(document.querySelectorAll<HTMLElement>(selector)).filter((el) => {
      const style = window.getComputedStyle(el);
      const rect = el.getBoundingClientRect();
      return style.visibility !== "hidden" && style.display !== "none" && rect.width > 0 && rect.height > 0;
    });
    return nodes.map((el) => {
      const role = el.getAttribute("role");
      const tag = el.tagName.toLowerCase();
      const input = el as HTMLInputElement;
      const text = (el.innerText || el.textContent || "").replace(/\s+/g, " ").trim();
      const aria = el.getAttribute("aria-label") || "";
      const placeholder = input.placeholder || "";
      const label = labelText(el);
      const name = aria || label || text || placeholder || "";
      const type = role || (tag === "a" ? "link" : tag === "input" ? input.type || "input" : tag);
      const selectorStrategy =
        role && name
          ? `getByRole('${role}', { name: /${escapeSlash(name)}/i })`
          : tag === "a" && name
            ? `getByRole('link', { name: /${escapeSlash(name)}/i })`
            : tag === "button" && name
              ? `getByRole('button', { name: /${escapeSlash(name)}/i })`
              : label
                ? `getByLabel(/${escapeSlash(label)}/i)`
                : placeholder
                  ? `getByPlaceholder(/${escapeSlash(placeholder)}/i)`
                  : "needs stable accessible selector";
      return {
        name,
        type,
        selectorStrategy,
        disabled:
          input.disabled ||
          el.getAttribute("aria-disabled") === "true" ||
          window.getComputedStyle(el).pointerEvents === "none",
        notes: name ? "" : "Missing accessible name or detectable label.",
      };
    });

    function labelText(el: Element): string {
      const id = el.getAttribute("id");
      if (id) {
        const explicit = document.querySelector(`label[for='${CSS.escape(id)}']`);
        if (explicit?.textContent) return explicit.textContent.replace(/\s+/g, " ").trim();
      }
      const wrapping = el.closest("label");
      if (wrapping?.textContent) return wrapping.textContent.replace(/\s+/g, " ").trim();
      const parent = el.parentElement;
      const previous = parent?.querySelector("label");
      if (previous?.textContent) return previous.textContent.replace(/\s+/g, " ").trim();
      return "";
    }

    function escapeSlash(value: string): string {
      return value.replace(/\//g, "\\/").slice(0, 80);
    }
  });
}

function shouldVisit(route: RouteInventoryItem): boolean {
  if (route.routeType === "API route") return false;
  if (route.dynamicParams.length) return false;
  return true;
}

function inferExpectedBehavior(control: { type: string; name: string }): string {
  const name = control.name.toLowerCase();
  if (control.type === "link") return "Navigate to the linked route or open the expected external target.";
  if (/upload|file|choose/.test(name)) return "Open or submit the resume file selection flow.";
  if (/download|pdf|print/.test(name)) return "Open or download the resume export without corrupt output.";
  if (/save/.test(name)) return "Persist the current resume/application state.";
  if (/delete|remove|forget/.test(name)) return "Remove only the selected item after the expected confirmation or clear affordance.";
  if (/score|audit|feedback|review|tailor|generate|regenerate/.test(name)) return "Run the relevant review/generation action with loading, success, and failure states.";
  return "Verify click behavior, keyboard activation, loading/success/error states, and no silent no-op.";
}

function inferTelemetryExpected(control: { name: string }): "yes" | "no" | "unknown" {
  return /pricing|checkout|feedback|target|tailor|pdf|upload|scratch|sample|faq/i.test(control.name)
    ? "yes"
    : "unknown";
}

function inferTestFile(routePath: string): string {
  if (routePath === "/audit") return "tests/e2e/specs/resume-upload-happy-path.spec.ts";
  if (routePath.startsWith("/resume/new")) return "tests/e2e/specs/resume-start-from-scratch.spec.ts";
  if (routePath.startsWith("/resume/edit")) return "tests/e2e/specs/resume-editor.spec.ts";
  if (routePath.startsWith("/pricing") || routePath.startsWith("/buy-credits")) return "tests/e2e/specs/controls.spec.ts";
  return "tests/e2e/specs/controls.spec.ts";
}

function toCsv(items: ControlInventoryItem[]): string {
  const headers = Object.keys(items[0] ?? {
    id: "",
    pageRoute: "",
    sourceFile: "",
    controlName: "",
    controlType: "",
    selectorStrategy: "",
    accessibleNamePresent: "",
    expectedBehavior: "",
    requiredInputs: "",
    normalState: "",
    emptyState: "",
    invalidState: "",
    loadingState: "",
    successState: "",
    errorState: "",
    disabledStateExpected: "",
    keyboardActivationExpected: "",
    telemetryEventExpected: "",
    expectedTelemetryEventName: "",
    testFile: "",
    testStatus: "",
    notes: "",
    bugId: "",
  });
  return [headers.join(","), ...items.map((item) => headers.map((header) => csvCell(String(item[header as keyof ControlInventoryItem] ?? ""))).join(","))].join("\n");
}

function toMarkdown(items: ControlInventoryItem[]): string {
  const rows = items.map(
    (item) =>
      `| ${item.id} | ${escapeCell(item.pageRoute)} | ${escapeCell(item.controlName)} | ${item.controlType} | ${item.accessibleNamePresent} | ${escapeCell(item.expectedBehavior)} | ${item.testStatus} | ${escapeCell(item.notes || "-")} |`,
  );
  return [
    "# Acceptance Matrix",
    "",
    "Generated from visible interactive controls. Expected behavior starts conservative and should be tightened as page-specific tests mature.",
    "",
    "| ID | Page / route | Control name | Type | Accessible name | Expected behavior | Test status | Notes |",
    "| --- | --- | --- | --- | --- | --- | --- | --- |",
    ...rows,
    "",
  ].join("\n");
}

function csvCell(value: string): string {
  return `"${value.replace(/"/g, '""')}"`;
}

function escapeCell(value: string): string {
  return value.replace(/\|/g, "\\|").replace(/\r?\n/g, " ");
}

export async function main(): Promise<void> {
  const items = await inventoryControls();
  console.log(`Inventoried ${items.length} controls.`);
}

if (isDirectRun("inventory-controls.ts")) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}

function isDirectRun(fileName: string): boolean {
  const invoked = process.argv[1] ? path.normalize(process.argv[1]) : "";
  return invoked.endsWith(path.join("scripts", "qa", fileName)) || path.basename(invoked) === fileName;
}
