// Pure helpers shared by the resume editor (client) for working with per-bullet
// before/after diffs and the user's accept/reject/edit decisions. No server or
// React imports — safe to use anywhere.

import type { BulletDiff, EditDecision } from "@/lib/types";

/** Stable key for a bullet at {entry,bullet} coordinates. */
export function bulletKey(entry: number, bullet: number): string {
  return `${entry}:${bullet}`;
}

/** Index the diffs by their {entry,bullet} key for O(1) lookup in render. */
export function diffMap(diffs: BulletDiff[] | undefined): Map<string, BulletDiff> {
  const m = new Map<string, BulletDiff>();
  for (const d of diffs ?? []) m.set(bulletKey(d.entry, d.bullet), d);
  return m;
}

/** Bullets that still carry an undecided AI suggestion. */
export function pendingCount(
  diffs: BulletDiff[] | undefined,
  decisions: Record<string, EditDecision>,
): number {
  let n = 0;
  for (const d of diffs ?? []) {
    if (!decisions[bulletKey(d.entry, d.bullet)]) n++;
  }
  return n;
}

/** Pending suggestions within one experience entry (for the tree badge). */
export function pendingInEntry(
  entry: number,
  diffs: BulletDiff[] | undefined,
  decisions: Record<string, EditDecision>,
): number {
  let n = 0;
  for (const d of diffs ?? []) {
    if (d.entry === entry && !decisions[bulletKey(d.entry, d.bullet)]) n++;
  }
  return n;
}
