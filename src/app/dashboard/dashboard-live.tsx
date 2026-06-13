"use client";

// Real (Supabase-backed) dashboard: the signed-in user's applications, credits,
// fit breakdown + agent notes per application, and links to the printable PDF.
// Rendered only when Supabase is configured; demo mode uses dashboard-client.tsx.

import { useState } from "react";
import Link from "next/link";
import { Download, FileText, Plus, Settings, X } from "lucide-react";
import { ROUTES } from "@/components/landing/data";
import { pdfHref } from "@/lib/apply/render";
import type { ApplicationRow } from "@/lib/types";
import type { SessionUser as AuthUser } from "@/lib/auth";

type View = "apps" | "docs";

const STATUS_DOT: Record<string, string> = {
  ready: "ok",
  running: "run",
  scored: "idle",
  human_review: "wait",
};
const STATUS_LABEL: Record<string, string> = {
  ready: "ready",
  running: "running",
  scored: "scored — not tailored",
  human_review: "with Michael",
};

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
  const open = apps.find((a) => a.id === openId) ?? null;
  const ready = apps.filter((a) => a.status === "ready" && a.result?.doc);

  return (
    <section className="tm-sec">
      <div className="tm-wrap">
        <div className="tmD-head">
          <h1>Your applications</h1>
          <div className="tmD-head-right">
            <span className="tmD-credits">
              <b>{credits}</b> credit{credits === 1 ? "" : "s"} ·{" "}
              <Link href={ROUTES.buyCredits}>buy more</Link>
            </span>
            <Link className="tm-btn tm-btn--primary tm-btn--sm" href={ROUTES.audit}>
              <Plus size={14} /> New application
            </Link>
            <Link
              className="tm-btn tm-btn--outline tm-btn--sm"
              href={ROUTES.settings}
            >
              <Settings size={14} /> Settings
            </Link>
          </div>
        </div>

        <p className="tm-small mt-[8px]">
          Signed in as {user.name} · {user.email}
        </p>

        <div className="tmD-tabs">
          <span
            className={"tmD-tab" + (view === "apps" ? " is-on" : "")}
            onClick={() => setView("apps")}
          >
            Applications <i>{apps.length}</i>
          </span>
          <span
            className={"tmD-tab" + (view === "docs" ? " is-on" : "")}
            onClick={() => setView("docs")}
          >
            Documents <i>{ready.length}</i>
          </span>
        </div>

        {apps.length === 0 ? (
          <div className="tm-card tmD-empty">
            <FileText size={28} strokeWidth={1.6} />
            <h2>No applications yet</h2>
            <p>
              Run your first application free — paste a job posting and we’ll
              tailor your resume, score the fit, and review every line.
            </p>
            <Link className="tm-btn tm-btn--primary" href={ROUTES.audit}>
              <Plus size={15} /> Start an application
            </Link>
          </div>
        ) : view === "apps" ? (
          <div className={"tmD-layout" + (open ? " has-drawer" : "")}>
            <div className="tmD-list">
              {apps.map((a) => (
                <div
                  key={a.id}
                  className={"tm-card tmD-row" + (openId === a.id ? " is-open" : "")}
                  onClick={() => setOpenId(a.id)}
                >
                  <div className="tmD-row-co">
                    <b>{a.company}</b>
                    <span>{a.role}</span>
                  </div>
                  <div className="tmD-fit">
                    <div className="tmD-fit-track">
                      <div
                        className={
                          "tmD-fit-bar" +
                          ((a.fitScore ?? 0) >= 80
                            ? " is-mint"
                            : (a.fitScore ?? 0) < 60
                              ? " is-weak"
                              : "")
                        }
                        style={{ width: (a.fitScore ?? 0) + "%" }}
                      ></div>
                    </div>
                    <output>{a.fitScore ?? "—"}</output>
                  </div>
                  <div className="tmD-status">
                    <span
                      className={"tmD-status-dot " + (STATUS_DOT[a.status] ?? "idle")}
                    ></span>
                    {STATUS_LABEL[a.status] ?? a.status}
                  </div>
                  <div className="tmD-row-date">
                    {new Date(a.createdAt).toLocaleDateString()}
                  </div>
                </div>
              ))}
            </div>

            {open && (
              <div className="tm-card tmD-drawer">
                <div className="tmD-drawer-head">
                  <div>
                    <b>{open.company}</b>
                    <span>{open.role}</span>
                  </div>
                  <span className="tmD-drawer-x" onClick={() => setOpenId(null)}>
                    <X size={16} />
                  </span>
                </div>

                {open.result?.fit && (
                  <div className="tm-fit">
                    {open.result.fit.dimensions.map((d) => (
                      <div key={d.label} className="tm-fit-row">
                        <label>{d.label}</label>
                        <div className="tm-fit-track">
                          <div
                            className="tm-fit-bar"
                            style={{ width: d.score + "%" }}
                          ></div>
                        </div>
                        <output>{d.score}</output>
                      </div>
                    ))}
                  </div>
                )}

                {open.result?.agentNotes && open.result.agentNotes.length > 0 && (
                  <>
                    <div className="tmD-drawer-sec">Top agent fixes</div>
                    {open.result.agentNotes.slice(0, 3).map((n, i) => (
                      <p key={i} className="tmB-rq-item">
                        <span className="tm-pill">{n.agent}</span>
                        {n.text}
                      </p>
                    ))}
                  </>
                )}

                {open.status === "ready" && open.result?.doc ? (
                  <>
                    <div className="tmD-drawer-sec">Files</div>
                    <Link
                      className="tm-btn tm-btn--primary tm-btn--sm justify-center"
                      href={pdfHref(open.id)}
                    >
                      <Download size={14} /> Resume + cover letter (PDF)
                    </Link>
                  </>
                ) : (
                  <Link
                    className="tm-btn tm-btn--primary tm-btn--sm justify-center"
                    href={ROUTES.audit}
                  >
                    Tailor my resume — 1 credit
                  </Link>
                )}
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
                    <FileText size={20} />
                  </span>
                  <div className="tmD-doc-body">
                    <b>Resume + cover letter</b>
                    <span className="tmD-doc-co">
                      {a.company} · {a.role}
                    </span>
                  </div>
                  <div className="tmD-doc-side">
                    {a.fitScore != null && (
                      <span className="tm-pill tm-pill--mint">{a.fitScore}</span>
                    )}
                    <Link
                      className="tm-btn tm-btn--outline tm-btn--sm"
                      href={pdfHref(a.id)}
                    >
                      <Download size={13} /> PDF
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
