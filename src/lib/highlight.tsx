import { Fragment, type ReactNode } from "react";

// Wrap posting keywords (mint, .tm-k) and quantified metrics (blue, .tm-m) in
// <mark> so a rewrite's keyword alignment + numbers are legible at a glance.
// Returns React NODES, never an HTML string — bullet text is model output and is
// not sanitized, so it must always render as escaped React children.

// %, $amounts, 40k / 2.4M / 3x, p95, or any standalone 2+ digit run.
const METRIC_RE =
  /(\d[\d.,]*\s?%|\$\s?\d[\d.,]*|\b\d[\d.,]*\s?[kmbx]\b|\bp\d{2,}\b|\b\d{2,}[\d.,]*\b)/gi;

type Piece = { t: string; kind: "kw" | "metric" | null };

function splitTag(parts: Piece[], re: RegExp, kind: "kw" | "metric"): Piece[] {
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

export function highlight(text: string, keywords: string[] = []): ReactNode {
  if (!text) return text;
  let parts: Piece[] = [{ t: text, kind: null }];
  parts = splitTag(parts, METRIC_RE, "metric");

  const kw = [...new Set(keywords.map((k) => k.trim()).filter((k) => k.length > 1))]
    .sort((a, b) => b.length - a.length)
    .map((k) => k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  if (kw.length) {
    parts = splitTag(parts, new RegExp(`\\b(${kw.join("|")})\\b`, "gi"), "kw");
  }

  return parts.map((p, i) =>
    p.kind === "metric" ? (
      <mark key={i} className="tm-m">{p.t}</mark>
    ) : p.kind === "kw" ? (
      <mark key={i} className="tm-k">{p.t}</mark>
    ) : (
      <Fragment key={i}>{p.t}</Fragment>
    ),
  );
}
