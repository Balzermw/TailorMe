"use client";

import { Loader2, Plus, RefreshCw, TrendingDown, TrendingUp } from "lucide-react";
import type { FitBreakdown, FitHistoryEntry } from "@/lib/types";
import { fitTier } from "@/lib/apply/fit-tier";
import { shouldEscalateToMichael } from "@/lib/apply/fit-history";
import { ManualReviewCTA } from "@/components/fit/michael-cta";

const TONE_COLOR: Record<string, string> = {
  strong: "var(--tm-mint-600)",
  good: "var(--tm-mint-600)",
  fair: "#b8791f",
  weak: "var(--tm-zinc)",
};

// The single biggest lever to raise the score, in plain language: a missing
// must-have keyword cluster, else the weakest dimension's first gap, else the
// score summary. Pure derivation from the fit breakdown we already compute.
function biggestLever(fit: FitBreakdown): string {
  const missing = (fit.keywords ?? []).filter((k) => !k.inResume).map((k) => k.term);
  if (missing.length) {
    return `Work in the must-have keywords this posting screens for: ${missing.slice(0, 3).join(", ")}.`;
  }
  const weakest = [...(fit.dimensions ?? [])].sort((a, b) => a.score - b.score)[0];
  if (weakest?.gaps?.length) return weakest.gaps[0];
  if (weakest) return `Strengthen ${weakest.label.toLowerCase()} with concrete, quantified evidence.`;
  return fit.summary || "Add quantified evidence that matches the posting.";
}

/**
 * The fit score as a progress loop: where you are, the biggest lever, the score
 * history, a free re-check, and (once earned) the human-coaching escalation.
 * Presentational — the parent owns fit/history state and the onRecheck action.
 */
export function FitPanel({
  fit,
  history,
  onRecheck,
  rechecking,
  pendingChanges = true,
  demoNote,
  onAddKeywords,
}: {
  fit: FitBreakdown;
  history: FitHistoryEntry[];
  onRecheck?: () => void;
  rechecking?: boolean;
  // Whether the draft has unsaved edits to re-score. When false the re-check is
  // disabled, so the score only moves when the resume actually changed.
  pendingChanges?: boolean;
  demoNote?: boolean;
  // Apply the missing posting keywords to the resume's Skills section, so the
  // "biggest lever" is a real one-click action instead of dead advice text.
  onAddKeywords?: (terms: string[]) => void;
}) {
  const tier = fitTier(fit.overall);
  const color = TONE_COLOR[tier.tone] ?? "var(--tm-ink)";
  const scores = history.map((h) => h.overall);
  const delta = scores.length > 1 ? scores[scores.length - 1] - scores[scores.length - 2] : 0;
  const escalate = shouldEscalateToMichael(history);
  const missingKeywords = (fit.keywords ?? []).filter((k) => !k.inResume).map((k) => k.term).slice(0, 8);

  return (
    <div className="tmFit-panel">
      <div className="tmFit-top">
        <div className="tmFit-score" style={{ color }}>
          <b>{fit.overall}</b>
          <span>{tier.label}</span>
        </div>
        {scores.length > 1 && (
          <span className={"tmFit-delta" + (delta < 0 ? " is-down" : "")}>
            {delta < 0 ? <TrendingDown size={13} /> : <TrendingUp size={13} />}
            {scores.join(" → ")}
          </span>
        )}
        <span className="tmFit-track" aria-hidden="true">
          <span className="tmFit-fill" style={{ width: `${fit.overall}%`, background: color }} />
        </span>
      </div>

      {missingKeywords.length > 0 ? (
        <div className="tmFit-leverbox">
          <p className="tmFit-lever">
            <b>Biggest lever:</b> add the must-have keywords this posting screens for, where you
            genuinely have them.
          </p>
          <div className="tmFit-kwchips">
            {missingKeywords.map((t) => (
              <span key={t} className="tmFit-kwchip" title={`"${t}" is not in your resume yet`}>
                {t}
              </span>
            ))}
          </div>
          {onAddKeywords && (
            <button
              type="button"
              className="tm-btn tm-btn--outline tm-btn--sm tmFit-kwadd"
              onClick={() => onAddKeywords(missingKeywords)}
            >
              <Plus size={13} /> Add to skills
            </button>
          )}
        </div>
      ) : (
        <p className="tmFit-lever">
          <b>Biggest lever:</b> {biggestLever(fit)}
        </p>
      )}

      {delta < 0 && scores.length > 1 && (
        <p className="tmFit-note">
          The score dipped on your last re-check, usually because an edit removed matched evidence.
          Add it back or strengthen it, then re-check.
        </p>
      )}

      {onRecheck && (
        <div className="tmFit-actions">
          <button
            type="button"
            className="tm-btn tm-btn--primary tm-btn--sm"
            onClick={onRecheck}
            disabled={rechecking || !pendingChanges}
          >
            {rechecking ? <Loader2 size={14} className="tmFit-spin" /> : <RefreshCw size={14} />}
            {rechecking ? "Re-checking..." : "Re-check fit"}
          </button>
          <span className="tm-small tmFit-hint">
            {pendingChanges
              ? "Re-scores your current draft against this job and saves it. Free, no credit."
              : "Edit a line to improve your resume, then re-check to move your fit."}
          </span>
        </div>
      )}

      {demoNote && (
        <p className="tmFit-note">Demo mode simulates the re-score so you can see the loop.</p>
      )}

      {escalate && <ManualReviewCTA overall={fit.overall} />}
    </div>
  );
}
