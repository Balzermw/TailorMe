"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
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
import { MichaelReviewCard } from "@/components/fit/michael-cta";
import type { ApplicationRow, TailoredDoc } from "@/lib/types";
import {
  AddResumeChoice,
  DashboardDocumentEmpty,
  DashboardDocumentGroup,
  RowStatus,
  ScoreBar,
} from "./dashboard-bits";

function targetLabel(app: ApplicationRow): string {
  return app.company ? `${app.role} @ ${app.company}` : app.role;
}

function nextStep(app: ApplicationRow): { label: string; tone: string } {
  if (app.status === "running") return { label: "Building draft", tone: "running" };
  if (!app.result?.doc) return { label: "Run AI tailoring", tone: "scored" };
  if ((app.fitScore ?? 100) < 70) return { label: "Review & edit", tone: "scored" };
  return { label: "Ready to use", tone: "ready" };
}

export default function DashboardClient() {
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
  const sourceLabel =
    baseResume?.headline ||
    baseResume?.name ||
    savedResume?.doc?.headline ||
    savedResume?.doc?.name ||
    savedResume?.name ||
    "Saved source profile";
  const feedbackCount =
    (savedResume?.stats as { proofPoints?: unknown[] } | null)?.proofPoints?.length ?? 0;
  const weakCount = apps.filter((a) => a.fitScore != null && a.fitScore < 70).length;
  const targetBaseResume = () => {
    const sourceText = baseResume ? docToResumeText(baseResume) : rawSourceText;
    if (!sourceText) return;
    setTargetResume(sourceText);
    router.push(`${ROUTES.audit}?from=base`);
  };

  // The master profile (source resume) — one compact card above the targeted list.
  const sourceCard = (
    <div className="tm-card tmD-doc tmD-doc--source">
      <span className="tmD-doc-thumb">
        <FileText size={18} strokeWidth={1.6} />
      </span>
      <div className="tmD-doc-body">
        <span className="tmD-doc-eyebrow">Master profile</span>
        <b>{baseResume ? "Resume info" : "Source profile"}</b>
        <span>{sourceLabel}</span>
      </div>
      <div className="tmD-doc-side">
        {baseResume && feedbackCount > 0 && (
          <Link className="tm-btn tm-btn--outline tm-btn--sm" href={`${ROUTES.resumeEdit}#feedback`}>
            <ListChecks size={13} /> Feedback ({feedbackCount})
          </Link>
        )}
        <Link
          className="tm-btn tm-btn--outline tm-btn--sm"
          href={baseResume ? ROUTES.resumeEdit : ROUTES.resumeImport}
        >
          <PenLine size={13} /> {baseResume ? "Edit" : "Update"}
        </Link>
      </div>
    </div>
  );

  return (
    <section className="tm-sec">
      <div className="tm-wrap">
        <div className="tmD-head">
          <div>
            <h1>Your workspace</h1>
            <p className="tmD-sub">
              Signed in as <b className="tm-data">{session.name}</b> · {session.email}
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

        {!hasSourceProfile && apps.length === 0 ? (
          <div className="tm-card tmD-empty">
            <FileText size={28} strokeWidth={1.6} />
            <h2>Add your resume to get started</h2>
            <p>
              Bring your LinkedIn or an existing resume, or build one from scratch. Then tailor it to
              any job and export a clean PDF.
            </p>
            <AddResumeChoice />
          </div>
        ) : (
          <div className="tmD-docs">
            {hasSourceProfile && (
              <DashboardDocumentGroup
                title="Your resume"
                detail="Your master profile. Every targeted resume starts from this one."
                count="1 source"
              >
                {sourceCard}
              </DashboardDocumentGroup>
            )}

            {/* One unified list: each row IS the package (resume + cover letter +
                fit), with edit/export/delete inline. No more roles-vs-resumes split. */}
            <DashboardDocumentGroup
              title="Targeted resumes"
              detail="One per role, ranked by fit. Each is a package: resume, cover letter, and score. Edit or export inline."
              count={`${apps.length} ${apps.length === 1 ? "package" : "packages"}`}
            >
              {apps.length > 0 ? (
                <div className="tmD-prow-list">
                  {[...apps]
                    .sort((a, b) => (b.fitScore ?? -1) - (a.fitScore ?? -1))
                    .map((app) => {
                      const step = nextStep(app);
                      const hasCover = Boolean((app.result?.doc?.coverLetter ?? "").trim());
                      return (
                        <div key={app.id} className="tm-card tmD-prow">
                          <div className="tmD-row-co">
                            <span className="tmD-row-ico" aria-hidden="true">
                              <FileText size={17} strokeWidth={1.7} />
                            </span>
                            <div className="tmD-row-co-text">
                              <b>{app.role}</b>
                              <span>{app.company || "Target role"}</span>
                            </div>
                          </div>
                          <ScoreBar fit={app.fitScore ?? null} building={app.status === "running"} />
                          <RowStatus tone={step.tone} label={step.label} />
                          <div className="tmD-prow-actions">
                            {hasCover && (
                              <span className="tmD-prow-cover" title="Includes a tailored cover letter">
                                <Mail size={13} /> Cover
                              </span>
                            )}
                            <Link className="tm-btn tm-btn--outline tm-btn--sm" href={editHref(app.id)}>
                              <PenLine size={13} /> Edit
                            </Link>
                            <Link
                              className="tm-btn tm-btn--outline tm-btn--sm"
                              href={printHref(app.id, true)}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              PDF
                            </Link>
                            <button
                              type="button"
                              className="tmD-prow-del"
                              aria-label={`Delete ${targetLabel(app)}`}
                              onClick={() => requestDelete(app.id, targetLabel(app))}
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                </div>
              ) : (
                <DashboardDocumentEmpty>
                  Target a role to create your first tailored resume.
                </DashboardDocumentEmpty>
              )}
            </DashboardDocumentGroup>

            {weakCount > 0 && <MichaelReviewCard weakCount={weakCount} />}
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
