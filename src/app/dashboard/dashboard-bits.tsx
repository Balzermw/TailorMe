// Shared presentational bits for the dashboard list rows. No progress
// indicators: a tailored resume is built while the user waits (on the tailoring
// page), so a dashboard row is just a score bar + a status. The ONLY "waiting"
// state surfaced here is a Michael hand-off (human review in flight).

export function initials(name: string): string {
  return name
    .split(" ")
    .map((w) => w[0] ?? "")
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

/** Horizontal overall-score bar + number. `building` = tailoring in flight. */
export function ScoreBar({ fit, building }: { fit: number | null; building?: boolean }) {
  if (building) return <span className="tmD-building">Building your documents…</span>;
  if (fit == null) return <span className="tmD-score--empty">—</span>;
  // High fits read as green, lower ones as blue (no alarming red in the list).
  const color = fit >= 70 ? "var(--tm-mint-500)" : "var(--tm-blue-400)";
  return (
    <span className="tmD-score" aria-label={`Job fit score ${fit} out of 100`}>
      <span className="tmD-score-track">
        <span className="tmD-score-fill" style={{ width: `${fit}%`, background: color }} />
      </span>
      <b className="tmD-score-num">{fit}</b>
      <span className="tmD-score-label">fit</span>
    </span>
  );
}

/** Inline status with a colored dot. `tone` drives the dot color via CSS. */
export function RowStatus({ tone, label }: { tone: string; label: string }) {
  return (
    <span className="tmD-row-status" data-status={tone}>
      <span className="tmD-status-dot" aria-hidden="true" />
      <span style={{ overflow: "hidden", textOverflow: "ellipsis", minWidth: 0 }}>{label}</span>
    </span>
  );
}
