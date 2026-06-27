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

/** One run of unchanged / removed / added text in a word-level redline. */
export type RedlineSeg = { type: "equal" | "removed" | "added"; text: string };

function tokenizeRedline(s: string): string[] {
  return s.match(/\s+|[^\s]+/g) ?? [];
}

function pushRedline(segs: RedlineSeg[], type: RedlineSeg["type"], text: string): void {
  const last = segs[segs.length - 1];
  if (last && last.type === type) last.text += text;
  else segs.push({ type, text });
}

/**
 * Word-level diff of an original bullet vs its AI rewrite. Returns an ordered
 * list of runs so the editor can strike only the words that were removed and
 * highlight only the words that were added — instead of crossing out the whole
 * sentence when a single phrase changed. Pure (no React); LCS over whitespace-
 * aware tokens. Invariants: equal+removed runs reconstruct `before` in order,
 * and equal+added runs reconstruct `after`.
 */
export function wordDiff(before: string, after: string): RedlineSeg[] {
  const a = tokenizeRedline(before);
  const b = tokenizeRedline(after);
  const n = a.length;
  const m = b.length;
  // Suffix LCS-length table so a forward walk emits runs in reading order.
  const dp: number[][] = Array.from({ length: n + 1 }, () =>
    new Array<number>(m + 1).fill(0),
  );
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i][j] =
        a[i] === b[j]
          ? dp[i + 1][j + 1] + 1
          : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }
  const segs: RedlineSeg[] = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) {
      pushRedline(segs, "equal", a[i]);
      i++;
      j++;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      pushRedline(segs, "removed", a[i]);
      i++;
    } else {
      pushRedline(segs, "added", b[j]);
      j++;
    }
  }
  while (i < n) pushRedline(segs, "removed", a[i++]);
  while (j < m) pushRedline(segs, "added", b[j++]);
  return segs;
}
