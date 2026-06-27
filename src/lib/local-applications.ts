import type { ApplicationRow, ApplyResult } from "@/lib/types";

const STORAGE_KEY = "tm_local_applications_v1";
const MAX_LOCAL_APPLICATIONS = 30;

function nowIso(): string {
  return new Date().toISOString();
}

function makeId(): string {
  const cryptoApi = typeof window !== "undefined" ? window.crypto : undefined;
  if (cryptoApi && "randomUUID" in cryptoApi) return cryptoApi.randomUUID();
  return `local-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function read(): ApplicationRow[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as ApplicationRow[]) : [];
  } catch {
    return [];
  }
}

function write(items: ApplicationRow[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items.slice(0, MAX_LOCAL_APPLICATIONS)));
  } catch {
    /* ignore */
  }
}

export function listLocalApplications(): ApplicationRow[] {
  return read().filter((app) => app && typeof app.id === "string");
}

export function loadLocalApplication(id: string): ApplicationRow | null {
  return listLocalApplications().find((app) => app.id === id) ?? null;
}

export function saveLocalApplication(
  result: ApplyResult,
  resumeId?: string | null,
): ApplicationRow {
  const app: ApplicationRow = {
    id: makeId(),
    company: result.company || "Target company",
    role: result.role || "Target role",
    fitScore: result.fit?.overall ?? null,
    status: result.doc ? "ready" : "scored",
    michaelStatus: "none",
    createdAt: nowIso(),
    result,
    resumeId: resumeId ?? null,
  };
  const items = read().filter((item) => item.id !== app.id);
  write([app, ...items]);
  return app;
}

export function updateLocalApplicationResult(
  id: string,
  result: ApplyResult,
): ApplicationRow | null {
  const items = read();
  const index = items.findIndex((app) => app.id === id);
  if (index < 0) return null;
  const current = items[index];
  const next: ApplicationRow = {
    ...current,
    company: result.company || current.company,
    role: result.role || current.role,
    fitScore: result.fit?.overall ?? current.fitScore,
    status: result.doc ? "ready" : current.status,
    result,
  };
  items[index] = next;
  write(items);
  return next;
}
