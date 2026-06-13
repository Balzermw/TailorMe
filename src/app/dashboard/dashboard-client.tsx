"use client";

// Dashboard — ported from the design handoff (tm-page-dashboard.jsx).
// Filter chips, sort, detail drawer, simulated live pipeline run,
// Michael review tracking, documents tab, signed-out gate.

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Check, Download, FileText, Lock, Plus } from "lucide-react";
import { AGENTS_FULL, ROUTES, SCORES } from "@/components/landing/data";
import { useDemoSession } from "@/lib/use-session";

const PIPE_STAGES = ["Parse", "Fit", "Draft", "Review", "Compile", "Done"];

type Tier = "strong" | "good" | "moderate" | "weak";
type Status = "ready" | "running" | "michael" | "scored";
type MichaelState = "none" | "reviewing";

type App = {
  id: string;
  co: string;
  role: string;
  fit: number | null;
  tier: Tier | null;
  status: Status;
  date: string;
  michael: MichaelState;
};

const APPS: App[] = [
  {
    id: "nordpeak",
    co: "Nordpeak Systems",
    role: "Senior Platform Engineer",
    fit: 84,
    tier: "strong",
    status: "ready",
    date: "Today",
    michael: "none",
  },
  {
    id: "lumengrid",
    co: "Lumen Grid",
    role: "Staff Backend Engineer",
    fit: null,
    tier: null,
    status: "running",
    date: "Today",
    michael: "none",
  },
  {
    id: "helio",
    co: "Helio Analytics",
    role: "Senior Software Engineer",
    fit: 76,
    tier: "good",
    status: "michael",
    date: "Yesterday",
    michael: "reviewing",
  },
  {
    id: "brightcart",
    co: "Brightcart",
    role: "Engineering Manager",
    fit: 58,
    tier: "moderate",
    status: "scored",
    date: "Jun 8",
    michael: "none",
  },
  {
    id: "vantora",
    co: "Vantora",
    role: "Senior Frontend Engineer",
    fit: 41,
    tier: "weak",
    status: "scored",
    date: "Jun 6",
    michael: "none",
  },
];

const STATUS: Record<Status, { dot: string; label: string }> = {
  ready: { dot: "ok", label: "Reviewed — ready to download" },
  running: { dot: "run", label: "Running" },
  michael: { dot: "wait", label: "Michael reviewing — returns in ~36h" },
  scored: { dot: "idle", label: "Scored only — no credit spent" },
};

type Doc = {
  name: string;
  kind: string;
  co: string;
  pages: string;
  date: string;
  fit: number | null;
};

const DOCS: Doc[] = [
  {
    name: "Resume_Nordpeak.pdf",
    kind: "Tailored resume",
    co: "Nordpeak Systems · Senior Platform Engineer",
    pages: "2 pages",
    date: "Today",
    fit: 84,
  },
  {
    name: "Cover_Nordpeak.pdf",
    kind: "Cover letter",
    co: "Nordpeak Systems · Senior Platform Engineer",
    pages: "1 page",
    date: "Today",
    fit: 84,
  },
  {
    name: "Resume_Helio.pdf",
    kind: "Tailored resume",
    co: "Helio Analytics · Senior Software Engineer",
    pages: "2 pages",
    date: "Yesterday",
    fit: 76,
  },
  {
    name: "Cover_Helio.pdf",
    kind: "Cover letter",
    co: "Helio Analytics · Senior Software Engineer",
    pages: "1 page",
    date: "Yesterday",
    fit: 76,
  },
  {
    name: "Alex_Mercer_master.pdf",
    kind: "Master resume",
    co: "Your uploaded original — every application starts here",
    pages: "3 pages",
    date: "Jun 2",
    fit: null,
  },
];

type Filter = "all" | "strong" | "ready" | "michael";
type Sort = "date" | "fit";

const FILTERS: [Filter, string][] = [
  ["all", "All"],
  ["strong", "Strong fits"],
  ["ready", "Ready"],
  ["michael", "With Michael"],
];

function FitCell({ fit, tier }: { fit: number | null; tier: Tier | null }) {
  if (fit == null)
    return <span className="tm-small text-[12.5px]">scoring…</span>;
  const cls =
    tier === "strong" || tier === "good"
      ? "is-mint"
      : tier === "weak"
        ? "is-weak"
        : "";
  return (
    <div className="tmD-fit">
      <div className="tmD-fit-track">
        <div className={"tmD-fit-bar " + cls} style={{ width: fit + "%" }} />
      </div>
      <output>{fit}</output>
    </div>
  );
}

function RunningPipe({ stage }: { stage: number }) {
  return (
    <div className="tmD-pipe">
      {PIPE_STAGES.slice(0, 5).map((s, i) => (
        <i key={s} className={i < stage ? "done" : i === stage ? "now" : ""}>
          {i < stage ? "✓ " : ""}
          {s}
        </i>
      ))}
    </div>
  );
}

function Drawer({ app, onClose }: { app: App; onClose: () => void }) {
  const st = STATUS[app.status];
  const fit = app.fit;
  return (
    <div className="tm-card tmD-drawer">
      <div className="tmD-drawer-head">
        <div>
          <b>{app.role}</b>
          <span>
            {app.co} · {app.date}
          </span>
        </div>
        <span className="tmD-drawer-x" onClick={onClose}>
          <Plus size={18} className="rotate-45" />
        </span>
      </div>
      <div className="tmD-status">
        <span className={"tmD-status-dot " + st.dot} /> {st.label}
      </div>

      {fit != null && (
        <>
          <p className="tmD-drawer-sec">Fit breakdown</p>
          <div className="tm-fit">
            {SCORES.map((s) => (
              <div key={s.l} className="tm-fit-row">
                <label>{s.l}</label>
                <div className="tm-fit-track">
                  <div
                    className="tm-fit-bar"
                    style={{ width: Math.max(20, s.v - (84 - fit)) + "%" }}
                  />
                </div>
                <output>{Math.max(20, s.v - (84 - fit))}</output>
              </div>
            ))}
          </div>
        </>
      )}

      {app.status === "ready" && (
        <>
          <p className="tmD-drawer-sec">Agent notes (top fixes)</p>
          {AGENTS_FULL.map((a) => (
            <p key={a.name} className="tmB-rq-item text-[12.5px]">
              <span className="tm-pill">{a.name}</span>
              {a.notes[0].txt}
            </p>
          ))}
          <p className="tmD-drawer-sec">Files</p>
          <div className="tmD-files">
            <span className="tmB-ev-file">
              <FileText size={15} /> <span>Resume_{app.co.split(" ")[0]}.pdf</span>{" "}
              <span className="ok">
                <Check size={11} /> 2 pages
              </span>
            </span>
            <span className="tmB-ev-file">
              <FileText size={15} /> <span>Cover_{app.co.split(" ")[0]}.pdf</span>{" "}
              <span className="ok">
                <Check size={11} /> 1 page
              </span>
            </span>
          </div>
          <span className="tm-btn tm-btn--primary justify-center">
            <Download size={15} /> Download both
          </span>
        </>
      )}

      {app.status === "scored" && (
        <>
          <p className="tmD-drawer-sec">Next step</p>
          <p className="tm-small">
            {app.tier === "weak"
              ? "Weak fit — the score suggests skipping this one and saving your credit for a stronger match."
              : "Scored without spending a credit. Run the full tailoring when you’re ready."}
          </p>
          <span
            className={
              "tm-btn justify-center " +
              (app.tier === "weak" ? "tm-btn--outline" : "tm-btn--primary")
            }
          >
            Tailor my resume — 1 credit
          </span>
        </>
      )}

      {app.status !== "scored" && (
        <div
          className={
            "tmD-michael" + (app.michael === "reviewing" ? " is-active" : "")
          }
        >
          <Image src="/michael.png" alt="" width={36} height={36} />
          <div className="flex-1">
            <b>
              {app.michael === "reviewing"
                ? "Michael is reviewing this one"
                : "Add Michael’s expert review"}
            </b>
            <span>
              {app.michael === "reviewing"
                ? "In queue since yesterday · returns in ~36h"
                : "Line-by-line pass · 48h turnaround"}
            </span>
          </div>
          {app.michael === "none" && (
            <span className="tm-pill tm-pill--mint">+$49</span>
          )}
          {app.michael === "reviewing" && (
            <span className="tm-pill tm-pill--mint">
              <Check size={12} /> added
            </span>
          )}
        </div>
      )}
    </div>
  );
}

function DocumentsView() {
  return (
    <div className="tmD-docs">
      {DOCS.map((d) => (
        <div key={d.name} className="tm-card tmD-doc">
          <span className="tmD-doc-thumb">
            <FileText size={22} strokeWidth={1.5} />
          </span>
          <span className="tmD-doc-body">
            <b>{d.name}</b>
            <span>
              {d.kind} · {d.pages} · {d.date}
            </span>
            <span className="tmD-doc-co">{d.co}</span>
          </span>
          <span className="tmD-doc-side">
            {d.fit != null ? (
              <span className="tm-pill tm-pill--mint">{d.fit} fit</span>
            ) : (
              <span className="tm-pill tm-pill--gray">original</span>
            )}
            <span className="tm-btn tm-btn--outline tm-btn--sm">
              <Download size={13} /> Download
            </span>
          </span>
        </div>
      ))}
    </div>
  );
}

export default function DashboardClient() {
  const [filter, setFilter] = useState<Filter>("all");
  const [sort, setSort] = useState<Sort>("date");
  const [view, setView] = useState<"apps" | "docs">("apps");
  const [openId, setOpenId] = useState<string | null>("nordpeak");
  const [runStage, setRunStage] = useState(1);
  const session = useDemoSession();

  // simulated live run
  useEffect(() => {
    const id = setInterval(
      () => setRunStage((s) => (s >= 4 ? 1 : s + 1)),
      2200,
    );
    return () => clearInterval(id);
  }, []);

  if (!session) {
    return (
      <section className="tm-sec">
        <div className="tm-wrap">
          <div className="tm-card tmD-empty mt-[12px]">
            <Lock
              size={30}
              strokeWidth={1.5}
              className="text-[var(--tm-blue-600)]"
            />
            <h2>Sign in to see your applications</h2>
            <p>
              Your tailored resumes, cover letters, and agent feedback live
              here — sign in to pick up where you left off.
            </p>
            <Link
              className="tm-btn tm-btn--primary tm-btn--lg"
              href={ROUTES.signIn}
            >
              Sign in
            </Link>
          </div>
        </div>
      </section>
    );
  }

  const filtered = APPS.filter((a) => {
    if (filter === "all") return true;
    if (filter === "strong") return a.tier === "strong" || a.tier === "good";
    if (filter === "ready") return a.status === "ready";
    if (filter === "michael") return a.michael !== "none";
    return true;
  });
  const sorted = [...filtered].sort((a, b) =>
    sort === "fit" ? (b.fit ?? 0) - (a.fit ?? 0) : 0,
  );
  const openApp = APPS.find(
    (a) => a.id === openId && sorted.some((s) => s.id === a.id),
  );

  return (
    <section className="tm-sec">
      <div className="tm-wrap">
        <div className="tmD-head">
          <div>
            <h1>Your applications</h1>
            <p className="tm-small mt-[4px]">
              Signed in as {session.name} · {session.email}
            </p>
          </div>
          <div className="tmD-head-right">
            <span className="tmD-credits">
              <b>7 credits</b> · <Link href={ROUTES.buyCredits}>buy more</Link>
            </span>
            <Link className="tm-btn tm-btn--primary" href={ROUTES.audit}>
              <Plus size={15} /> New application
            </Link>
            <Link className="tm-btn tm-btn--outline" href={ROUTES.settings}>
              Settings
            </Link>
          </div>
        </div>

        <div className="tmD-tabs">
          <span
            className={"tmD-tab" + (view === "apps" ? " is-on" : "")}
            onClick={() => setView("apps")}
          >
            Applications <i>{APPS.length}</i>
          </span>
          <span
            className={"tmD-tab" + (view === "docs" ? " is-on" : "")}
            onClick={() => setView("docs")}
          >
            Documents <i>{DOCS.length}</i>
          </span>
        </div>

        {view === "docs" ? (
          <DocumentsView />
        ) : (
          <>
            <div className="tmD-filters">
              {FILTERS.map(([k, l]) => (
                <span
                  key={k}
                  className={"tmD-chip" + (filter === k ? " is-on" : "")}
                  onClick={() => setFilter(k)}
                >
                  {l}
                </span>
              ))}
              <span className="tmD-sort">
                sort by
                <span
                  className={sort === "date" ? "is-on" : ""}
                  onClick={() => setSort("date")}
                >
                  date
                </span>
                <span
                  className={sort === "fit" ? "is-on" : ""}
                  onClick={() => setSort("fit")}
                >
                  fit
                </span>
              </span>
            </div>

            <div
              className={
                "tmD-layout mt-[4px]" + (openApp ? " has-drawer" : "")
              }
            >
              <div className="tmD-list">
                {sorted.map((a) => {
                  const st = STATUS[a.status];
                  return (
                    <div
                      key={a.id}
                      className={
                        "tm-card tmD-row" + (openId === a.id ? " is-open" : "")
                      }
                      onClick={() => setOpenId(a.id)}
                    >
                      <span className="tmD-row-co">
                        <b>{a.role}</b>
                        <span>{a.co}</span>
                      </span>
                      <FitCell fit={a.fit} tier={a.tier} />
                      {a.status === "running" ? (
                        <RunningPipe stage={runStage} />
                      ) : (
                        <span className="tmD-status">
                          <span className={"tmD-status-dot " + st.dot} />{" "}
                          {st.label}
                        </span>
                      )}
                      <span className="tmD-row-date">{a.date}</span>
                    </div>
                  );
                })}
                {sorted.length === 0 && (
                  <div className="tm-card tmD-empty">
                    <p>Nothing matches this filter.</p>
                  </div>
                )}
              </div>
              {openApp && (
                <Drawer app={openApp} onClose={() => setOpenId(null)} />
              )}
            </div>
          </>
        )}
      </div>
    </section>
  );
}
