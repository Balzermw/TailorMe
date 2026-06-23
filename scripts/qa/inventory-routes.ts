import fs from "node:fs/promises";
import path from "node:path";

export type RouteType = "app route" | "pages route" | "API route";

export interface RouteInventoryItem {
  routePath: string;
  sourceFile: string;
  routeType: RouteType;
  dynamicParams: string[];
  authLikelyRequired: "yes" | "no" | "unknown";
  smokeTestStatus: "not started" | "automated" | "manual" | "blocked";
  notes: string;
}

const pageExt = /\.(tsx|ts|jsx|js)$/;
const pageFilePattern = /^page\.(tsx|ts|jsx|js)$/;
const routeFilePattern = /^route\.(ts|js)$/;
const docsDir = path.join(process.cwd(), "docs", "qa");

export async function buildRouteInventory(): Promise<RouteInventoryItem[]> {
  const items: RouteInventoryItem[] = [];
  for (const appRoot of await existingDirs(["src/app", "app"])) {
    const files = await walk(appRoot);
    for (const file of files) {
      const base = path.basename(file);
      if (!pageFilePattern.test(base) && !routeFilePattern.test(base)) continue;
      const type: RouteType = routeFilePattern.test(base) ? "API route" : "app route";
      const routePath = appRoutePath(appRoot, path.dirname(file));
      const source = normalize(file);
      const contents = await fs.readFile(file, "utf8").catch(() => "");
      items.push({
        routePath,
        sourceFile: source,
        routeType: type,
        dynamicParams: dynamicParams(routePath),
        authLikelyRequired: inferAuthRequirement(routePath, contents, type),
        smokeTestStatus: type === "API route" ? "manual" : dynamicParams(routePath).length ? "manual" : "not started",
        notes: routeNotes(appRoot, path.dirname(file), type),
      });
    }
  }

  for (const pagesRoot of await existingDirs(["src/pages", "pages"])) {
    const files = (await walk(pagesRoot)).filter((file) => pageExt.test(file));
    for (const file of files) {
      if (path.basename(file).startsWith("_")) continue;
      const routePath = pagesRoutePath(pagesRoot, file);
      const contents = await fs.readFile(file, "utf8").catch(() => "");
      items.push({
        routePath,
        sourceFile: normalize(file),
        routeType: routePath.startsWith("/api/") ? "API route" : "pages route",
        dynamicParams: dynamicParams(routePath),
        authLikelyRequired: inferAuthRequirement(routePath, contents, routePath.startsWith("/api/") ? "API route" : "pages route"),
        smokeTestStatus: routePath.startsWith("/api/") || dynamicParams(routePath).length ? "manual" : "not started",
        notes: "",
      });
    }
  }

  return items.sort((a, b) => `${a.routeType}:${a.routePath}`.localeCompare(`${b.routeType}:${b.routePath}`));
}

export async function writeRouteInventory(items: RouteInventoryItem[]): Promise<void> {
  await fs.mkdir(docsDir, { recursive: true });
  await fs.writeFile(
    path.join(docsDir, "route-inventory.json"),
    JSON.stringify(items, null, 2),
    "utf8",
  );
  await fs.writeFile(path.join(docsDir, "route-inventory.md"), routeMarkdown(items), "utf8");
}

export async function main(): Promise<void> {
  const items = await buildRouteInventory();
  await writeRouteInventory(items);
  console.log(`Inventoried ${items.length} routes.`);
}

function routeMarkdown(items: RouteInventoryItem[]): string {
  const rows = items.map((item) =>
    [
      item.routePath,
      item.routeType,
      item.sourceFile,
      item.dynamicParams.join(", ") || "-",
      item.authLikelyRequired,
      item.smokeTestStatus,
      item.notes || "-",
    ]
      .map(escapeCell)
      .join(" | "),
  );
  return [
    "# Route Inventory",
    "",
    "Generated from the local Next.js file tree. Dynamic and API routes are documented but not blindly smoke-tested without safe parameters.",
    "",
    "| Route | Type | Source file | Dynamic params | Auth likely required | Smoke status | Notes |",
    "| --- | --- | --- | --- | --- | --- | --- |",
    ...rows.map((row) => `| ${row} |`),
    "",
  ].join("\n");
}

function appRoutePath(appRoot: string, dir: string): string {
  const rel = path.relative(appRoot, dir);
  const parts = rel
    ? rel.split(path.sep).filter((part) => part && !isRouteGroup(part) && !part.startsWith("@"))
    : [];
  return "/" + parts.join("/");
}

function pagesRoutePath(pagesRoot: string, file: string): string {
  const rel = path.relative(pagesRoot, file).replace(pageExt, "");
  const parts = rel.split(path.sep).filter(Boolean);
  if (parts.at(-1) === "index") parts.pop();
  return "/" + parts.join("/");
}

function dynamicParams(routePath: string): string[] {
  return [...routePath.matchAll(/\[\[?\.\.\.([^\]]+)]|\[([^\]]+)]/g)]
    .map((match) => match[1] || match[2])
    .filter(Boolean);
}

function inferAuthRequirement(
  routePath: string,
  contents: string,
  type: RouteType,
): "yes" | "no" | "unknown" {
  if (type === "API route") {
    if (/getServerUser|getServerSupabase|auth\.getUser|ADMIN_EMAILS|service role/i.test(contents)) {
      return "unknown";
    }
    return "unknown";
  }
  if (/redirect\(ROUTES\.signIn\)|getServerUser|auth\.getUser|ADMIN_EMAILS/i.test(contents)) {
    return "yes";
  }
  if (/getServerSupabase|supabaseConfigured/i.test(contents)) return "unknown";
  return "no";
}

function routeNotes(appRoot: string, dir: string, type: RouteType): string {
  if (type === "API route") return "Route handler; verify with API-level tests or browser flow.";
  void appRoot;
  void dir;
  return "";
}

async function existingDirs(dirs: string[]): Promise<string[]> {
  const out: string[] = [];
  for (const dir of dirs) {
    const full = path.join(process.cwd(), dir);
    const stat = await fs.stat(full).catch(() => null);
    if (stat?.isDirectory()) out.push(full);
  }
  return out;
}

async function walk(root: string): Promise<string[]> {
  const entries = await fs.readdir(root, { withFileTypes: true });
  const out: string[] = [];
  for (const entry of entries) {
    const full = path.join(root, entry.name);
    if (entry.isDirectory()) out.push(...(await walk(full)));
    else if (entry.isFile()) out.push(full);
  }
  return out;
}

function isRouteGroup(segment: string): boolean {
  return segment.startsWith("(") && segment.endsWith(")");
}

function normalize(file: string): string {
  return path.relative(process.cwd(), file).replace(/\\/g, "/");
}

function escapeCell(value: string): string {
  return value.replace(/\|/g, "\\|").replace(/\r?\n/g, " ");
}

if (isDirectRun("inventory-routes.ts")) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}

function isDirectRun(fileName: string): boolean {
  const invoked = process.argv[1] ? path.normalize(process.argv[1]) : "";
  return invoked.endsWith(path.join("scripts", "qa", fileName)) || path.basename(invoked) === fileName;
}
