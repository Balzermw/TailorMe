"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  Calendar,
  FileCheck,
  FileText,
  ListChecks,
  Lock,
  Mail,
  PenLine,
  Settings,
  Target,
  Trash2,
} from "lucide-react";
import { ROUTES } from "@/components/landing/data";
import { useDemoSession } from "@/lib/use-session";
import { loadBaseResumeDoc, loadSavedResume, setTargetResume, type SavedResume } from "@/lib/resume";
import { docToResumeText } from "@/lib/apply/serialize";
import { editHref, printHref } from "@/lib/apply/render";
import { deleteLocalApplication, listLocalApplications } from "@/lib/local-applications";
import type { ApplicationRow, TailoredDoc } from "@/lib/types";
import {
  AddResumeChoice,
  ApplicationTableHead,
  DashboardDocumentEmpty,
  DashboardDocumentGroup,
  RowStatus,
  ScoreBar,
} from "./dashboard-bits";

type View = "apps" | "docs";

function formatDate(iso: string): string {
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return "recent";
  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric" }).format(new Date(t));
}

function targetLabel(app: ApplicationRow): string {
  return app.company ? `${app.role} @ ${app.company}` : app.role;
}

function nextStep(app: ApplicationRow): { label: string; tone: string } {
  if (app.status === "running") return { label: "Building draft", tone: "running" };
  if (!app.result?.doc) return { label: "Run AI tailoring", tone: "scored" };
  if ((app.fitScore ?? 100) < 70) return { label: "Review & edit", tone: "scored" };
  return { label: "Ready to use", tone: "ready" };
}

function DocumentsView({
  baseResume,
  savedResume,
  apps,
  onDelete,
}: {
  baseResume: TailoredDoc | null;
  savedResume: SavedResume | null;
  apps: ApplicationRow[];
  onDelete: (id: string, label: string) => void;
}) {
  const rawSourceText = baseResume ? "" : (savedResume?.text ?? "").trim();
  const hasSourceProfile = Boolean(baseResume || rawSourceText);
  const sourceLabel =
    baseResume?.headline ||
    baseResume?.name ||
    savedResume?.doc?.headline ||
    savedResume?.doc?.name ||
    savedResume?.name ||
    "Saved source profile";
  const feedbackCount =
    (savedResume?.stats as { proofPoints?: unknown[] } | null)?.proofPoints?.length ?? 0;
  const ready = apps.filter((app) => app.result?.doc);
  const totalDocCount = (hasSourceProfile ? 1 : 0) + ready.length;

  if (totalDocCount === 0) {
    return (
      <div className="tm-card tmD-empty">
        <FileText size={28} strokeWidth={1.6} />
        <h2>No documents yet</h2>
        <p>Bring your LinkedIn or an existing resume, or build one from scratch. Your resumes and cover letters appear here.</p>
        <AddResumeChoice />
      </div>
    );
  }

  return (
    <div className="tmD-docs">
      {hasSourceProfile && (
        <DashboardDocumentGroup
          title="Source resume"
          detail="Your reusable experience, skills, and outcomes. Every targeted resume starts from this."
          count="1 item"
        >
          {baseResume ? (
            <div className="tm-card tmD-doc tmD-doc--source">
              <span className="tmD-doc-thumb"><FileText size={22} strokeWidth={1.6} /></span>
              <div className="tmD-doc-body">
                <span className="tmD-doc-eyebrow">Master profile</span>
                <b>Resume info</b>
                <span>{sourceLabel}</span>
              </div>
              <div className="tmD-doc-side">
                {feedbackCount > 0 && (
                  <Link className="tm-btn tm-btn--outline tm-btn--sm" href={`${ROUTES.resumeEdit}#feedback`}>
                    <ListChecks size={13} /> Feedback ({feedbackCount})
                  </Link>
                )}
                <Link className="tm-btn tm-btn--outline tm-btn--sm" href={ROUTES.resumeEdit}>
                  <PenLine size={13} /> Edit
                </Link>
              </div>
            </div>
          ) : (
            <div className="tm-card tmD-doc tmD-doc--source">
              <span className="tmD-doc-thumb"><FileText size={22} strokeWidth={1.6} /></span>
              <div className="tmD-doc-body">
                <span className="tmD-doc-eyebrow">Master profile</span>
                <b>Source profile</b>
                <span>{sourceLabel}</span>
              </div>
              <div className="tmD-doc-side">
                <Link className="tm-btn tm-btn--outline tm-btn--sm" href={ROUTES.resumeImport}>
                  <PenLine size={13} /> Update
                </Link>
              </div>
            </div>
          )}
        </DashboardDocumentGroup>
      )}

      <DashboardDocumentGroup
        title="Targeted resumes"
        detail="Role-specific resumes (with cover letters) ranked by fit. Reopen to review changes or export."
        count={`${ready.length} ${ready.length === 1 ? "package" : "packages"}`}
      >
        {ready.length > 0 ? (
          [...ready]
            .sort((a, b) => (b.fitScore ?? -1) - (a.fitScore ?? -1))
            .map((app) => (
              <div key={app.id} className="tm-card tmD-doc">
                <span className="tmD-doc-thumb"><FileCheck size={20} strokeWidth={1.5} /></span>
                <div className="tmD-doc-body">
                  <b>{targetLabel(app)}</b>
                  <span className="tmD-doc-meta">
                    <span><FileText size={12} strokeWidth={1.8} /> Resume</span>
                    {(app.result?.doc?.coverLetter ?? "").trim() && (
                      <span><Mail size={12} strokeWidth={1.8} /> Cover letter</span>
                    )}
                    <span><Calendar size={12} strokeWidth={1.8} /> {formatDate(app.createdAt)}</span>
                  </span>
                  {(app.fitScore ?? 100) < 70 && (
                    <span className="tmD-doc-advice">
                      <AlertTriangle size={12} strokeWidth={2} /> Needs manual edits or human review.
                    </span>
                  )}
                </div>
                <div className="tmD-doc-side">
                  <span className="tm-pill">{app.fitScore == null ? "unscored" : `${app.fitScore} fit`}</span>
                  <Link className="tm-btn tm-btn--outline tm-btn--sm" href={editHref(app.id)}>
                    <PenLine size={13} /> Edit
                  </Link>
                  <Link className="tm-btn tm-btn--outline tm-btn--sm" href={printHref(app.id, true)} target="_blank" rel="noopener noreferrer">
                    PDF
                  </Link>
                  <button
                    type="button"
                    className="tm-btn tm-btn--outline tm-btn--sm tmD-del-btn"
                    aria-label={`Delete ${targetLabel(app)}`}
                    onClick={() => onDelete(app.id, targetLabel(app))}
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
    </div>
  );
}

export default function DashboardClient({ initialView = "apps" }: { initialView?: View }) {
  const [view, setView] = useState<View>(initialView);
  const router = useRouter();
  const [baseResume, setBaseResume] = useState<TailoredDoc | null>(null);
  const [savedResume, setSavedResume] = useState<SavedResume | null>(null);
  const [apps, setApps] = useState<ApplicationRow[]>([]);
  const [pendingDelete, setPendingDelete] = useState<{ id: string; label: string } | null>(null);
  function requestDelete(id: string, label: string) {
    setPendingDelete({ id, label });
  }
  function confirmDelete() {
    if (!pendingDelete) return;
    deleteLocalApplication(pendingDelete.id);
    setApps(listLocalApplications());
    setPendingDelete(null);
  }
  useEffect(() => {
    let active = true;
    const refreshSource = async () => {
      const [doc, saved] = await Promise.all([loadBaseResumeDoc(), loadSavedResume()]);
      if (!active) return;
      setBaseResume(doc);
      setSavedResume(saved);
    };
    void refreshSource();
    window.addEventListener("focus", refreshSource);
    window.addEventListener("storage", refreshSource);
    return () => {
      active = false;
      window.removeEventListener("focus", refreshSource);
      window.removeEventListener("storage", refreshSource);
    };
  }, []);
  useEffect(() => {
    const refresh = () => setApps(listLocalApplications());
    refresh();
    window.addEventListener("focus", refresh);
    window.addEventListener("storage", refresh);
    return () => {
      window.removeEventListener("focus", refresh);
      window.removeEventListener("storage", refresh);
    };
  }, []);
  const session = useDemoSession();

  if (!session) {
    return (
      <section className="tm-sec">
        <div className="tm-wrap">
          <div className="tm-card tmD-empty mt-[12px]">
            <Lock size={30} strokeWidth={1.5} className="text-[var(--tm-blue-600)]" />
            <h2>Sign in to see your workspace</h2>
            <p>Your targeted resumes, cover letters, and agent feedback live here. Sign in to pick up where you left off.</p>
            <Link className="tm-btn tm-btn--primary tm-btn--lg" href={ROUTES.signIn}>Sign in</Link>
          </div>
        </div>
      </section>
    );
  }

  const rawSourceText = baseResume ? "" : (savedResume?.text ?? "").trim();
  const hasSourceProfile = Boolean(baseResume || rawSourceText);
  const readyCount = apps.filter((app) => app.result?.doc).length;
  const docsCount = (hasSourceProfile ? 1 : 0) + readyCount;
  const targetBaseResume = () => {
    const sourceText = baseResume ? docToResumeText(baseResume) : rawSourceText;
    if (!sourceText) return;
    setTargetResume(sourceText);
    router.push(`${ROUTES.audit}?from=base`);
  };

  return (
    <section className="tm-sec">
      <div className="tm-wrap">
        <div className="tmD-head">
          <div>
            <h1>Your workspace</h1>
            <p className="tmD-sub">
              Signed in as {session.name} - {session.email}
            </p>
          </div>
          <div className="tmD-head-right">
            <span className="tmD-credits">
              <b>Local workspace</b>
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

        {view === "docs" ? (
          <DocumentsView baseResume={baseResume} savedResume={savedResume} apps={apps} onDelete={requestDelete} />
        ) : apps.length > 0 ? (
          <div className="tmD-docs">
            <section className="tmD-doc-group">
              <div className="tmD-doc-group-head">
                <div>
                  <h2>Targeted roles</h2>
                  <p>Fit-ranked drafts. Reopen to review changes or export.</p>
                </div>
                <span>{`${apps.length} ${apps.length === 1 ? "draft" : "drafts"}`}</span>
              </div>
              <div className="tmD-doc-group-list tmD-doc-group-list--table">
                <ApplicationTableHead />
                <div className="tmD-list">
                  {[...apps]
                    .sort((a, b) => (b.fitScore ?? -1) - (a.fitScore ?? -1))
                    .map((app) => {
                      const step = nextStep(app);
                      return (
                        <div key={app.id} className="tmD-row-wrap">
                          <Link className="tm-card tmD-row" href={editHref(app.id)}>
                            <div className="tmD-row-co">
                              <span className="tmD-row-ico" aria-hidden="true">
                                <FileText size={17} strokeWidth={1.7} />
                              </span>
                              <div className="tmD-row-co-text">
                                <b>{app.role}</b>
                                <span>{app.company}</span>
                              </div>
                            </div>
                            <ScoreBar fit={app.fitScore ?? null} building={app.status === "running"} history={app.result?.fitHistory} />
                            <RowStatus tone={step.tone} label={step.label} />
                            <span className="tmD-row-date">{formatDate(app.createdAt)}</span>
                          </Link>
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
            </section>
          </div>
        ) : (
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
              <button
                type="button"
                className="tm-btn tmSet-danger-fill"
                onClick={confirmDelete}
              >
                <Trash2 size={14} /> Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
