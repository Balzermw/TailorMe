"use client";

// Real (Supabase-backed) dashboard: the signed-in user's applications, credits,
// fit breakdown + agent notes per application, and links to the printable PDF.
// Rendered only when Supabase is configured; demo mode uses dashboard-client.tsx.

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Check, ChevronRight, Download, FileText, MoreHorizontal, PenLine, Plus, Settings, X } from "lucide-react";
import { ROUTES } from "@/components/landing/data";
import { editHref, pdfHref } from "@/lib/apply/render";
import type { ApplicationRow } from "@/lib/types";
import type { SessionUser as AuthUser } from "@/lib/auth";

type View = "apps" | "docs";

const STAGE_LABELS = ["Parse", "Fit", "Draft", "Review"];

type Tier = "strong" | "good" | "moderate" | "weak";

const RING_COLOR: Record<string, string> = {
  strong: "var(--tm-mint-500)",
  good: "#84cc16",
  moderate: "#f59e0b",
  weak: "#ef4444",
};

const STATUS_LABEL: Record<string, string> = {
  ready: "Reviewed · ready to download",
  running: "Running",
  scored: "Scored only · no credit spent",
  human_review: "Michael reviewing · returns in ~48h",
};

/** Michael's human pass is mid-flight (requested or actively in review). */
function michaelInReview(app: ApplicationRow) {
  return (
    app.status === "human_review" ||
    app.michaelStatus === "requested" ||
    app.michaelStatus === "in_review"
  );
}

/** Drawer block for the Michael human-review add-on, reflecting michael_status. */
function MichaelPanel({
  app,
  requesting,
  onRequest,
}: {
  app: ApplicationRow;
  requesting: boolean;
  onRequest: () => void;
}) {
  if (app.michaelStatus === "returned") {
    return (
      <div className="tmD-michael is-active">
        <Image src="/michael.png" alt="" width={36} height={36} />
        <div className="flex-1">
          <b>Michael&apos;s review is back</b>
          <span>His line-by-line notes are in your files</span>
        </div>
        <span className="tm-pill tm-pill--mint"><Check size={12} /> done</span>
      </div>
    );
  }
  if (michaelInReview(app)) {
    return (
      <div className="tmD-michael is-active">
        <Image src="/michael.png" alt="" width={36} height={36} />
        <div className="flex-1">
          <b>Michael is reviewing this one</b>
          <span>In queue · returns in ~48h</span>
        </div>
        <span className="tm-pill tm-pill--mint"><Check size={12} /> added</span>
      </div>
    );
  }
  return (
    <button
      type="button"
      className="tmD-michael tmD-michael--btn"
      onClick={onRequest}
      disabled={requesting}
    >
      <Image src="/michael.png" alt="" width={36} height={36} />
      <div className="flex-1">
        <b>Add Michael&apos;s expert review</b>
        <span>Line-by-line pass · 48h turnaround</span>
      </div>
      <span className="tm-pill tm-pill--mint">{requesting ? "…" : "+$49"}</span>
    </button>
  );
}

function scoreTier(score: number | null): Tier | null {
  if (score == null) return null;
  if (score >= 80) return "strong";
  if (score >= 70) return "good";
  if (score >= 55) return "moderate";
  return "weak";
}

function initials(name: string) {
  return name.split(" ").map((w) => w[0] ?? "").join("").toUpperCase().slice(0, 2);
}

function ScoreRing({ fit, running }: { fit: number | null; running?: boolean }) {
  if (running) {
    return (
      <div className="tmD-scoring">
        <span>Scoring…</span>
        <span>In progress</span>
      </div>
    );
  }
  if (fit == null) return <div className="tmD-scoring"><span>—</span></div>;
  const tier = scoreTier(fit);
  const color = tier ? RING_COLOR[tier] : "var(--tm-border)";
  const r = 17, cx = 22, cy = 22;
  const circ = 2 * Math.PI * r;
  const dash = (fit / 100) * circ;
  return (
    <svg viewBox="0 0 44 44" width={44} height={44} className="tmD-ring" aria-label={`Fit score ${fit}`}>
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="var(--tm-gray)" strokeWidth={3.5} />
      <circle cx={cx} cy={cy} r={r} fill="none" stroke={color} strokeWidth={3.5}
        strokeDasharray={`${dash} ${circ - dash}`} strokeLinecap="round"
        transform="rotate(-90 22 22)" />
      <text x={cx} y={cy} textAnchor="middle" dominantBaseline="central"
        fontSize="11" fontWeight="600" fill="var(--tm-ink)">
        {fit}
      </text>
    </svg>
  );
}

function StageProgress({ status }: { status: string }) {
  const doneCount = status === "ready" || status === "human_review" ? 4 : status === "scored" ? 2 : 1;
  const isRunning = status === "running";
  return (
    <div className="tmD-stages">
      {STAGE_LABELS.map((s, i) => {
        const isDone = i < doneCount;
        const isActive = isRunning && i === 1;
        return (
          <div key={s} className="tmD-stage">
            <div className={"tmD-stage-bar" + (isDone ? " done" : isActive ? " active" : "")} />
            <span>{s}</span>
          </div>
        );
      })}
    </div>
  );
}

export default function DashboardLive({
  user,
  credits,
  apps,
}: {
  user: AuthUser;
  credits: number;
  apps: ApplicationRow[];
}) {
  const [view, setView] = useState<View>("apps");
  const [openId, setOpenId] = useState<string | null>(apps[0]?.id ?? null);
  const [requesting, setRequesting] = useState(false);
  const [reviewMsg, setReviewMsg] = useState<string | null>(null);
  const open = apps.find((a) => a.id === openId) ?? null;
  const ready = apps.filter((a) => a.status === "ready" && a.result?.doc);

  // Per-application Michael review: kicks off a Stripe Checkout session; the
  // webhook flips michael_status on success. Demo/no-Stripe → friendly notice.
  async function requestReview(appId: string) {
    setRequesting(true);
    setReviewMsg(null);
    try {
      const res = await fetch(`/api/applications/${appId}/request-review`, {
        method: "POST",
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url as string;
        return;
      }
      if (data.demo) {
        setReviewMsg("Payments aren't configured in this environment.");
      } else if (data.error) {
        setReviewMsg(String(data.error));
      }
    } catch {
      setReviewMsg("Couldn't start the review request. Please try again.");
    } finally {
      setRequesting(false);
    }
  }

  return (
    <section className="tm-sec">
      <div className="tm-wrap">
        {/* Header */}
        <div className="tmD-head">
          <h1>Your applications</h1>
          <div className="tmD-head-right">
            <span className="tmD-credits">
              <b>{credits} credit{credits === 1 ? "" : "s"}</b> ·{" "}
              <Link href={ROUTES.buyCredits}>buy more</Link>
            </span>
            <Link className="tm-btn tm-btn--primary" href={ROUTES.audit}>
              <Plus size={15} /> New application
            </Link>
            <Link className="tm-btn tm-btn--outline" href={ROUTES.settings}>
              <Settings size={14} /> Settings
            </Link>
          </div>
        </div>

        {/* User identity row */}
        <div className="tmD-user">
          <span className="tmD-user-avatar">{initials(user.name)}</span>
          <div>
            <b>{user.name}</b>
            <span>{user.email}</span>
          </div>
        </div>

        {/* Tabs */}
        <div className="tmD-tabs">
          <span className={"tmD-tab" + (view === "apps" ? " is-on" : "")} onClick={() => setView("apps")}>
            Applications <i>{apps.length}</i>
          </span>
          <span className={"tmD-tab" + (view === "docs" ? " is-on" : "")} onClick={() => setView("docs")}>
            Documents <i>{ready.length}</i>
          </span>
        </div>

        {apps.length === 0 ? (
          <div className="tm-card tmD-empty">
            <FileText size={28} strokeWidth={1.6} />
            <h2>No applications yet</h2>
            <p>
              Run your first application free. Paste a job posting and we&apos;ll
              tailor your resume, score the fit, and review every line.
            </p>
            <Link className="tm-btn tm-btn--primary" href={ROUTES.audit}>
              <Plus size={15} /> Start an application
            </Link>
          </div>
        ) : view === "apps" ? (
          <div className="tmD-layout">
            <div>
              {/* Column headers */}
              <div className="tmD-thead">
                <span />
                <span>Application</span>
                <span>Overall score</span>
                <span>Stage progress</span>
                <span>Added</span>
                <span />
              </div>

              <div className="tmD-list">
                {apps.map((a) => (
                  <div
                    key={a.id}
                    className={"tm-card tmD-row" + (openId === a.id ? " is-open" : "")}
                    onClick={() => setOpenId(openId === a.id ? null : a.id)}
                  >
                    <ChevronRight size={15} className="tmD-chevron" />
                    <div className="tmD-row-co">
                      <b>{a.role}</b>
                      <span>{a.company}</span>
                    </div>
                    <ScoreRing fit={a.fitScore ?? null} running={a.status === "running"} />
                    <StageProgress status={a.status} />
                    <span className="tmD-row-date">
                      {new Date(a.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                    </span>
                    <MoreHorizontal size={15} className="tmD-row-menu" />
                  </div>
                ))}
              </div>
            </div>

            {open ? (
              <div className="tm-card tmD-drawer">
                <div className="tmD-drawer-head">
                  <div>
                    <b>{open.role}</b>
                    <span>{open.company} · {new Date(open.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span>
                  </div>
                  <button type="button" className="tmD-drawer-x" onClick={() => setOpenId(null)} aria-label="Close">
                    <X size={16} />
                  </button>
                </div>

                <p className="tmD-status-label" data-status={open.status}>
                  <span className="tmD-status-dot" aria-hidden="true" />
                  {STATUS_LABEL[open.status] ?? open.status}
                </p>

                {open.result?.fit && (
                  <>
                    <p className="tmD-drawer-sec">Fit breakdown</p>
                    <div className="tm-fit">
                      {open.result.fit.dimensions.map((d) => (
                        <div key={d.label} className="tm-fit-row">
                          <label>{d.label}</label>
                          <div className="tm-fit-track">
                            <div className="tm-fit-bar" style={{ width: d.score + "%" }} />
                          </div>
                          <output>{d.score}</output>
                        </div>
                      ))}
                    </div>
                  </>
                )}

                {open.result?.agentNotes && open.result.agentNotes.length > 0 && (
                  <>
                    <p className="tmD-drawer-sec">Top agent fixes</p>
                    {open.result.agentNotes.slice(0, 3).map((n, i) => (
                      <p key={i} className="tmB-rq-item" style={{ fontSize: "12.5px" }}>
                        <span className="tm-pill">{n.agent}</span>{n.text}
                      </p>
                    ))}
                  </>
                )}

                {open.status === "ready" && open.result?.doc ? (
                  <>
                    <p className="tmD-drawer-sec">Files</p>
                    <div className="tmD-files">
                      <span className="tmB-ev-file">
                        <FileText size={15} /> Resume_{open.company.split(" ")[0]}.pdf{" "}
                        <span className="ok"><Check size={11} /> 2 pages</span>
                      </span>
                    </div>
                    <Link
                      className="tm-btn tm-btn--primary justify-center w-full"
                      href={editHref(open.id)}
                    >
                      <PenLine size={14} /> Review &amp; edit
                    </Link>
                    <Link
                      className="tm-btn tm-btn--outline justify-center w-full"
                      href={pdfHref(open.id)}
                    >
                      <Download size={14} /> Download both
                    </Link>
                  </>
                ) : (
                  <>
                    <p className="tmD-drawer-sec">Next step</p>
                    <p className="tm-small" style={{ color: "var(--tm-zinc)", lineHeight: 1.55 }}>
                      {open.status === "scored"
                        ? "Scored without spending a credit. Run the full tailoring when you're ready."
                        : open.status === "running"
                          ? "Agents are working on your application. Check back shortly."
                          : "Add Michael's line-by-line review to strengthen this application."}
                    </p>
                    {open.status !== "running" && (
                      <Link
                        className="tm-btn tm-btn--primary justify-center w-full mt-[4px]"
                        href={ROUTES.audit}
                      >
                        Tailor my resume · 1 credit
                      </Link>
                    )}
                  </>
                )}

                {(open.status === "ready" ||
                  michaelInReview(open) ||
                  open.michaelStatus === "returned") && (
                  <MichaelPanel
                    app={open}
                    requesting={requesting}
                    onRequest={() => requestReview(open.id)}
                  />
                )}
                {reviewMsg && (
                  <p className="tm-small" style={{ color: "var(--tm-zinc)" }}>
                    {reviewMsg}
                  </p>
                )}
              </div>
            ) : (
              <div className="tmD-drawer-empty">
                <FileText size={26} strokeWidth={1.5} />
                <p>Select an application to see its fit breakdown and files.</p>
              </div>
            )}
          </div>
        ) : (
          <div className="tmD-docs">
            {ready.length === 0 ? (
              <div className="tm-card tmD-empty">
                <FileText size={28} strokeWidth={1.6} />
                <p>Tailored documents appear here once an application is ready.</p>
              </div>
            ) : (
              ready.map((a) => (
                <div key={a.id} className="tm-card tmD-doc">
                  <span className="tmD-doc-thumb">
                    <FileText size={20} strokeWidth={1.5} />
                  </span>
                  <div className="tmD-doc-body">
                    <b>{a.role} · {a.company}</b>
                    <span>
                      Resume + cover letter ·{" "}
                      {new Date(a.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                    </span>
                  </div>
                  <div className="tmD-doc-side">
                    {a.fitScore != null && (
                      <span className="tm-pill tm-pill--mint">{a.fitScore} fit</span>
                    )}
                    <Link className="tm-btn tm-btn--outline tm-btn--sm" href={pdfHref(a.id)}>
                      <Download size={13} /> Download
                    </Link>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </section>
  );
}
