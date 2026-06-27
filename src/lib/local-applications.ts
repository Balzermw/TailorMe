import type { ApplicationRow, ApplyResult, FitBreakdown, TailoredDoc } from "@/lib/types";
import { appendFitEntry, ensureInitialHistory } from "@/lib/apply/fit-history";

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
  const app = listLocalApplications().find((item) => item.id === id) ?? null;
  // Backfill a one-point fit timeline for applications saved before the re-check
  // loop shipped, so the editor always has a history to render (read-time, not
  // persisted; stamped with createdAt so it's stable across reads).
  if (app?.result && !(app.result.fitHistory && app.result.fitHistory.length)) {
    app.result = {
      ...app.result,
      fitHistory: ensureInitialHistory(app.result, app.createdAt),
    };
  }
  return app;
}

/** Permanently remove one local application. Returns true if a row was deleted. */
export function deleteLocalApplication(id: string): boolean {
  const items = read();
  const next = items.filter((app) => app.id !== id);
  if (next.length === items.length) return false;
  write(next);
  return true;
}

export function saveLocalApplication(
  result: ApplyResult,
  resumeId?: string | null,
): ApplicationRow {
  const createdAt = nowIso();
  // Seed the opening point on the fit timeline if the caller didn't.
  const seeded: ApplyResult = {
    ...result,
    fitHistory: ensureInitialHistory(result, createdAt),
  };
  const app: ApplicationRow = {
    id: makeId(),
    company: seeded.company || "Target company",
    role: seeded.role || "Target role",
    fitScore: seeded.fit?.overall ?? null,
    status: seeded.doc ? "ready" : "scored",
    michaelStatus: "none",
    createdAt,
    result: seeded,
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

/**
 * Demo-mode re-check: append a "recheck" point to the fit timeline, update the
 * stored fit + (current) doc, and persist. Delegates the actual write to
 * updateLocalApplicationResult (which re-derives fitScore from result.fit).
 */
export function recheckLocalApplication(
  id: string,
  newFit: FitBreakdown,
  newDoc: TailoredDoc | null,
): ApplicationRow | null {
  const current = loadLocalApplication(id);
  if (!current?.result) return null;
  const base = ensureInitialHistory(current.result, current.createdAt);
  const result: ApplyResult = {
    ...current.result,
    fit: newFit,
    doc: newDoc ?? current.result.doc,
    fitHistory: appendFitEntry(base, newFit.overall, newFit.verdict, "recheck", nowIso()),
  };
  return updateLocalApplicationResult(id, result);
}
