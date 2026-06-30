import { Fragment, type ReactNode } from "react";

// Wrap posting keywords (mint, .tm-k) and quantified metrics (blue, .tm-m) in
// <mark> so a rewrite's keyword alignment + numbers are legible at a glance.
// Returns React NODES, never an HTML string — bullet text is model output and is
// not sanitized, so it must always render as escaped React children.

// %, $amounts, 40k / 2.4M / 3x, p95, or any standalone 2+ digit run.
const METRIC_RE =
  /(\d[\d.,]*\s?%|\$\s?\d[\d.,]*|\b\d[\d.,]*\s?[kmbx]\b|\bp\d{2,}\b|\b\d{2,}[\d.,]*\b)/gi;
// "[add %]", "[industry/field]" — fill-in-the-blank slots an AI draft or template
// leaves behind. Split these FIRST so the metric matcher can't carve up a slot.
const PLACEHOLDER_RE = /\[[^\]]+\]/g;

type PieceKind = "kw" | "metric" | "ph" | "add" | null;
type Piece = { t: string; kind: PieceKind };

function splitTag(parts: Piece[], re: RegExp, kind: Exclude<PieceKind, null>): Piece[] {
  const out: Piece[] = [];
  for (const p of parts) {
    if (p.kind) {
      out.push(p);
      continue;
    }
    const s = p.t;
    re.lastIndex = 0;
    let last = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(s))) {
      if (m.index > last) out.push({ t: s.slice(last, m.index), kind: null });
      out.push({ t: m[0], kind });
      last = m.index + m[0].length;
      if (m.index === re.lastIndex) re.lastIndex++; // guard against zero-width
    }
    if (last < s.length) out.push({ t: s.slice(last), kind: null });
  }
  return out;
}

// Does this text actually contain anything `highlight()` would tint? Lets the
// editor show the keyword/metric legend only when there's real color on screen.
export function highlightHits(
  text: string,
  keywords: string[] = [],
): { kw: boolean; metric: boolean } {
  if (!text) return { kw: false, metric: false };
  const metric = new RegExp(METRIC_RE.source, "i").test(text);
  const kw = keywords.some((k) => {
    const t = k.trim();
    if (t.length <= 1) return false;
    return new RegExp(`\\b${t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i").test(text);
  });
  return { kw, metric };
}

export function highlight(
  text: string,
  keywords: string[] = [],
  opts?: { additions?: string[]; placeholders?: boolean },
): ReactNode {
  if (!text) return text;
  let parts: Piece[] = [{ t: text, kind: null }];
  const additions = [...new Set((opts?.additions ?? []).map((a) => a.trim()).filter((a) => a.length > 1))]
    .sort((a, b) => b.length - a.length)
    .map((a) => a.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\s+/g, "\\s+"));
  if (additions.length) {
    parts = splitTag(parts, new RegExp(`(${additions.join("|")})`, "gi"), "add");
  }
  if (opts?.placeholders) parts = splitTag(parts, PLACEHOLDER_RE, "ph");
  parts = splitTag(parts, METRIC_RE, "metric");

  const kw = [...new Set(keywords.map((k) => k.trim()).filter((k) => k.length > 1))]
    .sort((a, b) => b.length - a.length)
    .map((k) => k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  if (kw.length) {
    parts = splitTag(parts, new RegExp(`\\b(${kw.join("|")})\\b`, "gi"), "kw");
  }

  return parts.map((p, i) =>
    p.kind === "ph" ? (
      <mark key={i} className="tm-ph">{p.t}</mark>
    ) : p.kind === "add" ? (
      <mark key={i} className="mcv-add">{p.t}</mark>
    ) : p.kind === "metric" ? (
      <mark key={i} className="tm-m">{p.t}</mark>
    ) : p.kind === "kw" ? (
      <mark key={i} className="tm-k">{p.t}</mark>
    ) : (
      <Fragment key={i}>{p.t}</Fragment>
    ),
  );
}
