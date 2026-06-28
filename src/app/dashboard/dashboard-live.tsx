"use client";

// Real (Supabase-backed) dashboard: the signed-in user's saved resume info and
// their targeted roles, fit-ranked, with one clear next action each. Kept
// deliberately lean — the primary jobs are "start a new target" and "reopen /
// export an existing one".

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Check,
  Download,
  FileCheck,
  FileText,
  ListChecks,
  PenLine,
  Settings,
  Target,
  Trash2,
  UserCheck,
  WandSparkles,
  X,
} from "lucide-react";
import { ROUTES } from "@/components/landing/data";
import { MichaelReviewCard } from "@/components/fit/michael-cta";
import { editHref, pdfHref } from "@/lib/apply/render";
import { setTargetResume } from "@/lib/resume";
import { docToResumeText } from "@/lib/apply/serialize";
import type { ApplicationRow, TailoredDoc } from "@/lib/types";
import type { SessionUser as AuthUser } from "@/lib/auth";
import {
  AddResumeChoice,
  ApplicationTableHead,
  DashboardDocumentEmpty,
  DashboardDocumentGroup,
  DashboardSectionHeader,
  RowStatus,
  ScoreBar,
} from "./dashboard-bits";

type View = "apps" | "docs";

const STATUS_LABEL: Record<string, string> = {
  ready: "Targeted draft ready",
  running: "AI tailoring in progress",
  scored: "Fit scored - tailoring not run",
  human_review: "Human review in progress",
};

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function targetLabel(app: ApplicationRow) {
  return `${app.role} - ${app.company}`;
}

/** Whether an expert (human) review is in flight for this application. */
function michaelInReview(app: ApplicationRow) {
  return (
    app.status === "human_review" ||
    app.michaelStatus === "requested" ||
    app.michaelStatus === "in_review"
  );
}

/** The single most useful next action for a row, shown as its status. */
function nextStep(app: ApplicationRow): { label: string; tone: string } {
  if (app.michaelStatus === "returned") return { label: "Expert notes ready", tone: "ready" };
  if (michaelInReview(app)) return { label: "In expert review", tone: "human_review" };
  if (app.status === "running") return { label: "Tailoring in progress", tone: "running" };
  if (app.status === "scored" || !app.result?.doc) return { label: "Run AI tailoring", tone: "scored" };
  if ((app.fitScore ?? 100) < 70) return { label: "Review & edit", tone: "scored" };
  return { label: "Ready to use", tone: "ready" };
}

/** Rank low-fit / unfinished targets first so the work that needs attention surfaces. */
function needRank(app: ApplicationRow) {
  const fit = app.fitScore ?? 101;
  const runningOffset = app.status === "running" ? 35 : 0;
  return fit + runningOffset;
}

function sortByNeed(items: ApplicationRow[]) {
  return [...items].sort((a, b) => needRank(a) - needRank(b));
}

function sortByFit(items: ApplicationRow[]) {
  return [...items].sort((a, b) => (b.fitScore ?? -1) - (a.fitScore ?? -1));
}

function fitBand(fit: number | null) {
  if (fit == null) {
    return {
      label: "Not scored yet",
      detail: "Run this role through tailoring to see where the saved resume matches and where it needs help.",
      tone: "neutral",
    };
  }
  if (fit >= 80) {
    return {
      label: "Strong fit",
      detail: "This targeted package already lines up well. A quick manual pass is optional.",
      tone: "mint",
    };
  }
  if (fit >= 70) {
    return {
      label: "Competitive fit",
      detail: "Usable as-is. A manual pass can tighten the role-specific story.",
      tone: "mint",
    };
  }
  return {
    label: "Needs work",
    detail: "AI tailoring plus a manual edit pass will get this resume role-ready.",
    tone: "amber",
  };
}

export default function DashboardLive({
  user,
  credits,
  apps: appsProp,
  baseResume,
  baseResumeId,
  sourceResumeName,
  sourceResumeText,
  sourceFeedbackCount = 0,
  initialView = "apps",
  reviewNotice,
}: {
  user: AuthUser;
  credits: number;
  apps: ApplicationRow[];
  baseResume: TailoredDoc | null;
  baseResumeId: string | null;
  sourceResumeName?: string | null;
  sourceResumeText?: string | null;
  sourceFeedbackCount?: number;
  initialView?: View;
  reviewNotice?: string | null;
}) {
  const router = useRouter();
  // Optimistically hide rows the user just deleted; the server re-syncs on refresh.
  const [removed, setRemoved] = useState<Set<string>>(new Set());
  const apps = appsProp.filter((a) => !removed.has(a.id));
  const sourceVersions = baseResumeId
    ? apps.filter((a) => a.resumeId === baseResumeId).length
    : 0;
  const ranked = sortByNeed(apps);
  const [view, setView] = useState<View>(initialView);
  const [openId, setOpenId] = useState<string | null>(ranked[0]?.id ?? null);
  const [requesting, setRequesting] = useState(false);
  const [reviewMsg, setReviewMsg] = useState<string | null>(reviewNotice ?? null);
  const [pendingDelete, setPendingDelete] = useState<{ id: string; label: string } | null>(null);
  function requestDelete(id: string, label: string) {
    setPendingDelete({ id, label });
  }
  async function confirmDelete() {
    if (!pendingDelete) return;
    const { id } = pendingDelete;
    setPendingDelete(null);
    if (openId === id) setOpenId(null);
    setRemoved((prev) => new Set(prev).add(id));
    try {
      const res = await fetch(`/api/applications/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      router.refresh();
    } catch {
      // Revert the optimistic removal and surface an error.
      setRemoved((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      setReviewMsg("Couldn't delete that application. Please try again.");
    }
  }

  const ready = apps.filter((a) => a.status === "ready" && a.result?.doc);
  const reviewApps = sortByNeed(
    apps.filter((a) => michaelInReview(a) || a.michaelStatus === "returned"),
  );
  const rawSourceText = baseResume ? "" : (sourceResumeText ?? "").trim();
  const hasSourceProfile = Boolean(baseResume || rawSourceText);
  const sourceDisplayName =
    baseResume?.headline ||
    baseResume?.name ||
    sourceResumeName ||
    "Saved source profile";
  // Count packages a person recognizes: the source profile + each targeted
  // resume. A resume and its cover letter are one package, not two documents.
  const docsCount = (hasSourceProfile ? 1 : 0) + ready.length;

  const open = openId ? ranked.find((a) => a.id === openId) ?? null : null;
  const openStatus = open?.status ?? null;

  function targetBaseResume() {
    const sourceText = baseResume ? docToResumeText(baseResume) : rawSourceText;
    if (!sourceText) return;
    setTargetResume(sourceText, baseResumeId ?? undefined);
    router.push(`${ROUTES.audit}?from=base`);
  }

  async function requestReview(appId: string) {
    setRequesting(true);
    setReviewMsg(null);
    try {
      const res = await fetch(`/api/applications/${appId}/request-review`, { method: "POST" });
      const data = await res.json();
      if (data.url) {
        window.location.assign(data.url as string);
        return;
      }
      if (data.demo) setReviewMsg("Payments are not configured in this environment.");
      else if (data.error) setReviewMsg(String(data.error));
    } catch {
      setReviewMsg("Could not start the review request. Please try again.");
    } finally {
      setRequesting(false);
    }
  }

  return (
    <section className="tm-sec">
      <div className="tm-wrap">
        <div className="tmD-head">
          <div>
            <h1>Your workspace</h1>
            <p className="tmD-sub">
              Signed in as <b className="tm-data">{user.name}</b> · {user.email}
            </p>
          </div>
          <div className="tmD-head-right">
            <span className="tmD-credits">
              <b>{credits} credit{credits === 1 ? "" : "s"}</b> -{" "}
              <Link href={ROUTES.buyCredits}>buy more</Link>
            </span>
            {hasSourceProfile && (
              <button
                type="button"
                className="tm-btn tm-btn--primary tm-btn--sm"
                onClick={targetBaseResume}
              >
                <Target size={15} /> Target a role
              </button>
            )}
            <Link className="tm-btn tm-btn--outline tm-btn--sm" href={ROUTES.settings}>
              <Settings size={14} /> Settings
            </Link>
          </div>
        </div>

        {reviewMsg && (
          <div className="tmD-notice" role="status">
            {reviewMsg}
          </div>
        )}

        {hasSourceProfile && (
          <div className="tm-card tmD-base-resume">
            <span className="tmD-base-thumb">
              <FileText size={18} />
            </span>
            <div className="tmD-base-body">
              <b>Saved resume info</b>
              <span>
                {sourceDisplayName +
                  (sourceVersions > 0
                    ? ` - ${sourceVersions} targeted ${sourceVersions === 1 ? "package" : "packages"}`
                    : "")}
              </span>
            </div>
            <div className="tmD-base-actions">
              {sourceFeedbackCount > 0 && (
                <Link className="tm-btn tm-btn--outline tm-btn--sm" href={`${ROUTES.resumeEdit}#feedback`}>
                  <ListChecks size={14} /> View feedback ({sourceFeedbackCount})
                </Link>
              )}
              {baseResume ? (
                <Link className="tm-btn tm-btn--outline tm-btn--sm" href={ROUTES.resumeEdit}>
                  <PenLine size={14} /> Edit source
                </Link>
              ) : (
                <Link className="tm-btn tm-btn--outline tm-btn--sm" href={ROUTES.resumeImport}>
                  <PenLine size={14} /> Update source
                </Link>
              )}
            </div>
          </div>
        )}

        <div className="tmD-tabs" role="tablist" aria-label="Dashboard views">
          <button
            type="button"
            role="tab"
            aria-selected={view === "apps"}
            className={"tmD-tab" + (view === "apps" ? " is-on" : "")}
            onClick={() => setView("apps")}
          >
            Targeted roles <i>{apps.length}</i>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={view === "docs"}
            className={"tmD-tab" + (view === "docs" ? " is-on" : "")}
            onClick={() => setView("docs")}
          >
            Documents <i>{docsCount}</i>
          </button>
        </div>

        {apps.length === 0 && view === "apps" ? (
          <div className="tm-card tmD-empty">
            <FileText size={28} strokeWidth={1.6} />
            <h2>{hasSourceProfile ? "No targeted roles yet" : "Add your resume to get started"}</h2>
            <p>
              {hasSourceProfile
                ? "Target a role to create an AI-tailored resume, then review the changes and export it."
                : "Bring your LinkedIn or an existing resume, or build one from scratch. Then tailor it to any job and export a clean PDF."}
            </p>
            {!hasSourceProfile && <AddResumeChoice />}
          </div>
        ) : view === "apps" ? (
          <>
            <DashboardSectionHeader
              title="Targeted roles"
              meta={`${apps.length} total - the ones that need attention come first`}
            />
            <ApplicationTableHead />

            <div className={"tmD-layout mt-[4px]" + (ranked.length > 0 ? " has-drawer" : "")}>
              <div>
                <div className="tmD-list">
                  {ranked.map((app) => {
                    const building = app.status === "running";
                    const step = nextStep(app);
                    return (
                      <div key={app.id} className="tmD-row-wrap">
                        <button
                          type="button"
                          className={"tm-card tmD-row" + (open?.id === app.id ? " is-open" : "")}
                          onClick={() => setOpenId(open?.id === app.id ? null : app.id)}
                          aria-expanded={open?.id === app.id}
                          aria-controls={`dashboard-drawer-${app.id}`}
                        >
                          <div className="tmD-row-co">
                            <span className="tmD-row-ico" aria-hidden="true">
                              <FileText size={17} strokeWidth={1.7} />
                            </span>
                            <div className="tmD-row-co-text">
                              <b>{app.role}</b>
                              <span>{app.company}</span>
                            </div>
                          </div>
                          <ScoreBar fit={app.fitScore ?? null} building={building} />
                          <RowStatus tone={step.tone} label={step.label} />
                          <span className="tmD-row-date">{formatDate(app.createdAt)}</span>
                        </button>
                        <button
                          type="button"
                          className="tmD-row-del"
                          aria-label={`Delete ${app.role}`}
                          onClick={() => requestDelete(app.id, app.company ? `${app.role} @ ${app.company}` : app.role)}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>

              {open ? (
                <div className="tm-card tmD-drawer" id={`dashboard-drawer-${open.id}`}>
                  <div className="tmD-drawer-head">
                    <div>
                      <b>{open.role}</b>
                      <span>{open.company} - {formatDate(open.createdAt)}</span>
                    </div>
                    <button type="button" className="tmD-drawer-x" onClick={() => setOpenId(null)} aria-label="Close">
                      <X size={16} />
                    </button>
                  </div>

                  <p className="tmD-status-label" data-status={openStatus ?? open.status}>
                    <span className="tmD-status-dot" aria-hidden="true" />
                    {STATUS_LABEL[openStatus ?? open.status] ?? openStatus ?? open.status}
                  </p>

                  <div className="tmD-fit-summary" data-tone={fitBand(open.fitScore ?? null).tone}>
                    <b>{fitBand(open.fitScore ?? null).label}</b>
                    <span>{fitBand(open.fitScore ?? null).detail}</span>
                  </div>

                  {open.result?.fit && (
                    <>
                      <p className="tmD-drawer-sec">Fit breakdown</p>
                      <div className="tm-fit">
                        {open.result.fit.dimensions.map((dimension) => (
                          <div key={dimension.label} className="tm-fit-row">
                            <label>{dimension.label}</label>
                            <div className="tm-fit-track">
                              <div className="tm-fit-bar" style={{ width: dimension.score + "%" }} />
                            </div>
                            <output>{dimension.score}</output>
                          </div>
                        ))}
                      </div>
                    </>
                  )}

                  {open.result?.agentNotes && open.result.agentNotes.length > 0 && (
                    <>
                      <p className="tmD-drawer-sec">What the agents changed</p>
                      {open.result.agentNotes.slice(0, 3).map((note, index) => (
                        <p key={index} className="tmB-rq-item" style={{ fontSize: "12.5px" }}>
                          <span className="tm-pill">{note.agent}</span>{note.text}
                        </p>
                      ))}
                    </>
                  )}

                  <div className="tmD-drawer-actions">
                    {open.status === "ready" && open.result?.doc ? (
                      <>
                        <Link className="tm-btn tm-btn--primary justify-center" href={editHref(open.id)}>
                          <PenLine size={14} /> Review &amp; edit
                        </Link>
                        <Link
                          className="tm-btn tm-btn--outline justify-center"
                          href={pdfHref(open.id)}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <Download size={14} /> Export PDF
                        </Link>
                        {open.michaelStatus === "returned" ? (
                          <Link className="tm-btn tm-btn--outline justify-center" href={editHref(open.id)}>
                            <Check size={14} /> Open expert notes
                          </Link>
                        ) : michaelInReview(open) ? (
                          <span className="tm-pill" style={{ justifySelf: "center" }}>
                            <UserCheck size={12} /> Expert review in progress
                          </span>
                        ) : (
                          <button
                            type="button"
                            className="tm-btn tm-btn--outline justify-center"
                            onClick={() => requestReview(open.id)}
                            disabled={requesting}
                          >
                            <UserCheck size={14} />{" "}
                            {requesting ? "Starting..." : "Request expert review (+$79)"}
                          </button>
                        )}
                      </>
                    ) : (
                      <Link className="tm-btn tm-btn--primary justify-center" href={ROUTES.audit}>
                        <WandSparkles size={14} /> Run AI tailoring
                      </Link>
                    )}
                  </div>
                </div>
              ) : ranked.length > 0 ? (
                <div className="tmD-drawer-empty">
                  <FileText size={22} strokeWidth={1.6} />
                  <p>Select a targeted role to see its fit and what changed.</p>
                </div>
              ) : null}
            </div>
            {(() => {
              const weak = apps.filter((a) => a.fitScore != null && a.fitScore < 70).length;
              return weak > 0 ? <MichaelReviewCard weakCount={weak} /> : null;
            })()}
          </>
        ) : (
          <div className="tmD-docs">
            {docsCount === 0 ? (
              <div className="tm-card tmD-empty">
                <FileText size={28} strokeWidth={1.6} />
                <p>Your saved resume and targeted packages will appear here.</p>
              </div>
            ) : (
              <>
                {hasSourceProfile && (
                  <DashboardDocumentGroup
                    title="Source resume"
                    detail="Your reusable experience, skills, and outcomes. Every targeted resume starts from this."
                    count="1 item"
                  >
                    {baseResume ? (
                      <div className="tm-card tmD-doc">
                        <span className="tmD-doc-thumb">
                          <FileText size={20} strokeWidth={1.5} />
                        </span>
                        <div className="tmD-doc-body">
                          <b>Resume info</b>
                          <span>{sourceDisplayName}</span>
                          <span className="tmD-doc-file"><FileText size={12} /> Experience, roles, skills, and outcomes</span>
                        </div>
                        <div className="tmD-doc-side">
                          <span className="tm-pill">source</span>
                          <Link className="tm-btn tm-btn--outline tm-btn--sm" href={ROUTES.resumeEdit}>
                            <PenLine size={13} /> Edit
                          </Link>
                        </div>
                      </div>
                    ) : rawSourceText ? (
                      <div className="tm-card tmD-doc">
                        <span className="tmD-doc-thumb">
                          <FileText size={20} strokeWidth={1.5} />
                        </span>
                        <div className="tmD-doc-body">
                          <b>Source profile</b>
                          <span>{sourceDisplayName}</span>
                          <span className="tmD-doc-file"><FileText size={12} /> Saved resume/profile text</span>
                        </div>
                        <div className="tmD-doc-side">
                          <span className="tm-pill">source</span>
                          <Link className="tm-btn tm-btn--outline tm-btn--sm" href={ROUTES.resumeImport}>
                            <PenLine size={13} /> Update
                          </Link>
                        </div>
                      </div>
                    ) : null}
                  </DashboardDocumentGroup>
                )}

                <DashboardDocumentGroup
                  title="Targeted resumes"
                  detail="Role-specific resumes (with cover letters) ranked by fit. Reopen to review changes or export."
                  count={`${ready.length} ${ready.length === 1 ? "package" : "packages"}`}
                >
                  {ready.length > 0 ? (
                    sortByFit(ready).map((app) => (
                      <div key={app.id} className="tm-card tmD-doc">
                        <span className="tmD-doc-thumb">
                          <FileCheck size={20} strokeWidth={1.5} />
                        </span>
                        <div className="tmD-doc-body">
                          <b>{targetLabel(app)}</b>
                          <span>
                            Resume{(app.result?.doc?.coverLetter ?? "").trim() ? " + cover letter" : ""} - {formatDate(app.createdAt)}
                          </span>
                          {(app.fitScore ?? 100) < 70 && (
                            <span className="tmD-doc-advice">Low fit - a manual edit pass is recommended.</span>
                          )}
                        </div>
                        <div className="tmD-doc-side">
                          <span className="tm-pill">{app.fitScore == null ? "unscored" : `${app.fitScore} fit`}</span>
                          <Link className="tm-btn tm-btn--outline tm-btn--sm" href={editHref(app.id)}>
                            <PenLine size={13} /> Edit
                          </Link>
                          <Link
                            className="tm-btn tm-btn--outline tm-btn--sm"
                            href={pdfHref(app.id)}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            <Download size={13} /> PDF
                          </Link>
                          <button
                            type="button"
                            className="tm-btn tm-btn--outline tm-btn--sm tmD-del-btn"
                            aria-label={`Delete ${targetLabel(app)}`}
                            onClick={() => requestDelete(app.id, targetLabel(app))}
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </div>
                    ))
                  ) : (
                    <DashboardDocumentEmpty>Target a role to create your first targeted resume.</DashboardDocumentEmpty>
                  )}
                </DashboardDocumentGroup>

                {reviewApps.length > 0 && (
                  <DashboardDocumentGroup
                    title="Expert review"
                    detail="Targeted packages sent for a human expert pass, in progress or returned."
                    count={`${reviewApps.length} ${reviewApps.length === 1 ? "package" : "packages"}`}
                  >
                    {reviewApps.map((app) => (
                      <div key={app.id} className="tm-card tmD-doc">
                        <span className="tmD-doc-thumb">
                          <UserCheck size={20} strokeWidth={1.5} />
                        </span>
                        <div className="tmD-doc-body">
                          <b>{targetLabel(app)}</b>
                          <span>
                            {app.michaelStatus === "returned" ? "Expert notes returned" : "In expert review"} - {formatDate(app.createdAt)}
                          </span>
                        </div>
                        <div className="tmD-doc-side">
                          <span className={app.michaelStatus === "returned" ? "tm-pill tm-pill--mint" : "tm-pill"}>
                            {app.michaelStatus === "returned" ? "returned" : "in review"}
                          </span>
                          {app.result?.doc && (
                            <Link className="tm-btn tm-btn--outline tm-btn--sm" href={editHref(app.id)}>
                              <PenLine size={13} /> Open
                            </Link>
                          )}
                        </div>
                      </div>
                    ))}
                  </DashboardDocumentGroup>
                )}
              </>
            )}
          </div>
        )}
      </div>
      {pendingDelete && (
        <div
          className="tmD-modal-backdrop"
          role="presentation"
          onClick={() => setPendingDelete(null)}
        >
          <div
            className="tm-card tmD-modal"
            role="dialog"
            aria-modal="true"
            aria-label="Delete targeted resume"
            onClick={(e) => e.stopPropagation()}
          >
            <h3>Delete this targeted resume?</h3>
            <p className="tmD-modal-target">
              <b>{pendingDelete.label}</b>
            </p>
            <p>Will be permanently removed, including its cover letter and fit history.</p>
            <p className="tmD-modal-warn">This can&apos;t be undone.</p>
            <div className="tmD-modal-actions">
              <button
                type="button"
                className="tm-btn tm-btn--outline"
                onClick={() => setPendingDelete(null)}
              >
                Cancel
              </button>
              <button type="button" className="tm-btn tmSet-danger-fill" onClick={confirmDelete}>
                <Trash2 size={14} /> Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
