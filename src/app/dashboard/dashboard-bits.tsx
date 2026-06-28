// Shared presentational bits for the dashboard list rows. No progress
// indicators: a tailored resume is built while the user waits (on the tailoring
// page), so a dashboard row is just a score bar + a status. The ONLY "waiting"
// state surfaced here is a Michael hand-off (human review in flight).

import type { ReactNode } from "react";
import Link from "next/link";
import { PenLine, Upload } from "lucide-react";
import { ROUTES } from "@/components/landing/data";
import { fitTier } from "@/lib/apply/fit-tier";

// New-user entry: lead with bringing an existing resume/LinkedIn (the common
// case), with build-from-scratch as the quiet secondary — instead of dropping
// people straight into the scratch builder.
export function AddResumeChoice() {
  return (
    <div className="tmD-addchoice">
      <Link className="tm-btn tm-btn--primary" href={ROUTES.resumeImport}>
        <Upload size={15} /> Import a resume
      </Link>
      <Link className="tm-btn tm-btn--ghost" href={ROUTES.resumeNew}>
        <PenLine size={14} /> Build from scratch
      </Link>
    </div>
  );
}

export function initials(name: string): string {
  return name
    .split(" ")
    .map((w) => w[0] ?? "")
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

export function DashboardSectionHeader({
  title,
  meta,
  action,
}: {
  title: string;
  meta: string;
  action?: ReactNode;
}) {
  return (
    <div className="tmD-sectionbar">
      <div>
        <b>{title}</b>
        <span>{meta}</span>
      </div>
      {action}
    </div>
  );
}

export function DashboardDocumentGroup({
  title,
  detail,
  count,
  children,
}: {
  title: string;
  detail: string;
  count: string;
  children: ReactNode;
}) {
  return (
    <section className="tmD-doc-group">
      <div className="tmD-doc-group-head">
        <div>
          <h2>{title}</h2>
          <p>{detail}</p>
        </div>
        <span>{count}</span>
      </div>
      <div className="tmD-doc-group-list">{children}</div>
    </section>
  );
}

export function DashboardDocumentEmpty({ children }: { children: ReactNode }) {
  return (
    <div className="tmD-doc-empty">
      <FileTextIcon />
      <p>{children}</p>
    </div>
  );
}

function FileTextIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" width="18" height="18">
      <path
        d="M7 3.75h6.2L18.25 8.8V20.25H7z"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.7"
      />
      <path
        d="M13 4v5h5M9.5 13h5M9.5 16h4"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.7"
      />
    </svg>
  );
}

export function ApplicationTableHead() {
  return (
    <div className="tmD-thead" aria-hidden="true">
      <span>Target</span>
      <span>Fit</span>
      <span>Status</span>
      <span>Updated</span>
    </div>
  );
}

/**
 * Compact fit cell: number + tier word, then a bar that fills the rest of the
 * (flexible) FIT column. `building` = in flight. The score-improvement history
 * lives in the editor's fit panel, not here — the row shows current state.
 */
export function ScoreBar({
  fit,
  building,
}: {
  fit: number | null;
  building?: boolean;
}) {
  if (building) return <span className="tmD-building">Building your documents...</span>;
  if (fit == null) return <span className="tmD-score--empty">Not scored yet</span>;
  const tier = fitTier(fit);
  return (
    <span className="tmD-fit" data-tier={tier.tone} aria-label={`Job fit ${fit} of 100, ${tier.label}`}>
      <span className="tmD-fit-head">
        <b className="tmD-fit-num">{fit}</b>
        <span className="tmD-fit-tier">{tier.label}</span>
      </span>
      <span className="tmD-fit-track">
        <span className="tmD-fit-fill" style={{ width: `${fit}%` }} />
      </span>
    </span>
  );
}

/** Status as a tinted pill with a colored dot. `tone` drives the colors via CSS. */
export function RowStatus({ tone, label }: { tone: string; label: string }) {
  return (
    <span className="tmD-row-status" data-status={tone}>
      <span className="tmD-status-dot" aria-hidden="true" />
      <span className="tmD-row-status-label">{label}</span>
    </span>
  );
}
