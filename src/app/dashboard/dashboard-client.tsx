"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  Check,
  ChevronRight,
  Download,
  FileText,
  Lock,
  MoreHorizontal,
  Plus,
  Settings,
  X,
} from "lucide-react";
import { AGENTS_FULL, ROUTES, SCORES } from "@/components/landing/data";
import { useDemoSession } from "@/lib/use-session";

const STAGE_LABELS = ["Parse", "Fit", "Draft", "Review"];

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
  { id: "nordpeak", co: "Nordpeak Systems", role: "Senior Platform Engineer", fit: 84, tier: "strong", status: "ready", date: "Today", michael: "none" },
  { id: "lumengrid", co: "Lumen Grid", role: "Staff Backend Engineer", fit: null, tier: null, status: "running", date: "Today", michael: "none" },
  { id: "helio", co: "Helio Analytics", role: "Senior Software Engineer", fit: 76, tier: "good", status: "michael", date: "Yesterday", michael: "reviewing" },
  { id: "brightcart", co: "Brightcart", role: "Engineering Manager", fit: 58, tier: "moderate", status: "scored", date: "Jun 8", michael: "none" },
  { id: "vantora", co: "Vantora", role: "Senior Frontend Engineer", fit: 41, tier: "weak", status: "scored", date: "Jun 6", michael: "none" },
];

const STATUS_LABEL: Record<Status, string> = {
  ready: "Reviewed — ready to download",
  running: "Running",
  michael: "Michael reviewing — returns in ~36h",
  scored: "Scored only — no credit spent",
};

type Doc = {
  kind: string;
  role: string | null;
  company: string;
  name: string;
  pages: string;
  date: string;
  fit: number | null;
  href: string;
};

// Sample artifacts bundled in /public/samples so demo downloads open something real.
const DOCS: Doc[] = [
  { kind: "Tailored resume", role: "Senior Platform Engineer", company: "Nordpeak Systems", name: "Resume_Nordpeak.pdf", pages: "2 pages", date: "Today", fit: 84, href: "/samples/resume-after.png" },
  { kind: "Cover letter", role: "Senior Platform Engineer", company: "Nordpeak Systems", name: "Cover_Nordpeak.pdf", pages: "1 page", date: "Today", fit: 84, href: "/samples/cover-letter.png" },
  { kind: "Tailored resume", role: "Senior Software Engineer", company: "Helio Analytics", name: "Resume_Helio.pdf", pages: "2 pages", date: "Yesterday", fit: 76, href: "/samples/resume-after.png" },
  { kind: "Cover letter", role: "Senior Software Engineer", company: "Helio Analytics", name: "Cover_Helio.pdf", pages: "1 page", date: "Yesterday", fit: 76, href: "/samples/cover-letter.png" },
  { kind: "Master resume", role: null, company: "Your uploaded original", name: "Alex_Mercer_master.pdf", pages: "3 pages", date: "Jun 2", fit: null, href: "/samples/resume-before.png" },
];

type Filter = "all" | "strong" | "ready" | "michael";
type Sort = "date" | "fit";

const FILTERS: [Filter, string][] = [
  ["all", "All"],
  ["strong", "Strong fits"],
  ["ready", "Ready"],
  ["michael", "With Michael"],
];

const STAGE_DONE: Record<Status, number> = {
  ready: 4,
  running: 1,
  michael: 4,
  scored: 2,
};

const RING_COLOR: Record<string, string> = {
  strong: "var(--tm-mint-500)",
  good: "#84cc16",
  moderate: "#f59e0b",
  weak: "#ef4444",
};

function initials(name: string) {
  return name.split(" ").map((w) => w[0] ?? "").join("").toUpperCase().slice(0, 2);
}

function ScoreRing({ fit, tier, running }: { fit: number | null; tier: Tier | null; running?: boolean }) {
  if (running) {
    return (
      <div className="tmD-scoring">
        <span>Scoring…</span>
        <span>In progress</span>
      </div>
    );
  }
  if (fit == null) return <span className="tmD-scoring"><span>—</span></span>;
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

function StageProgress({ status, runStage }: { status: Status; runStage: number }) {
  const done = status === "running" ? 0 : STAGE_DONE[status];
  const active = status === "running" ? Math.min(runStage, 3) : -1;
  return (
    <div className="tmD-stages">
      {STAGE_LABELS.map((s, i) => {
        const isDone = i < done;
        const isActive = i === active;
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

function Drawer({ app, onClose, onRequestReview }: { app: App; onClose: () => void; onRequestReview: () => void }) {
  return (
    <div className="tm-card tmD-drawer">
      <div className="tmD-drawer-head">
        <div>
          <b>{app.role}</b>
          <span>{app.co} · {app.date}</span>
        </div>
        <button type="button" className="tmD-drawer-x" onClick={onClose} aria-label="Close">
          <X size={16} />
        </button>
      </div>

      <p className="tmD-status-label">{STATUS_LABEL[app.status]}</p>

      {app.fit != null && (
        <>
          <p className="tmD-drawer-sec">Fit breakdown</p>
          <div className="tm-fit">
            {SCORES.map((s) => {
              const v = Math.max(20, s.v - (84 - app.fit!));
              return (
                <div key={s.l} className="tm-fit-row">
                  <label>{s.l}</label>
                  <div className="tm-fit-track"><div className="tm-fit-bar" style={{ width: v + "%" }} /></div>
                  <output>{v}</output>
                </div>
              );
            })}
          </div>
        </>
      )}

      {app.status === "ready" && (
        <>
          <p className="tmD-drawer-sec">Top agent fixes</p>
          {AGENTS_FULL.map((a) => (
            <p key={a.name} className="tmB-rq-item" style={{ fontSize: "12.5px" }}>
              <span className="tm-pill">{a.name}</span>{a.notes[0].txt}
            </p>
          ))}
          <p className="tmD-drawer-sec">Files</p>
          <div className="tmD-files">
            <a className="tmB-ev-file" href="/samples/resume-after.png" target="_blank" rel="noopener noreferrer">
              <FileText size={15} /> Resume_{app.co.split(" ")[0]}.pdf{" "}
              <span className="ok"><Check size={11} /> 2 pages</span>
            </a>
            <a className="tmB-ev-file" href="/samples/cover-letter.png" target="_blank" rel="noopener noreferrer">
              <FileText size={15} /> Cover_{app.co.split(" ")[0]}.pdf{" "}
              <span className="ok"><Check size={11} /> 1 page</span>
            </a>
          </div>
          <a className="tm-btn tm-btn--primary justify-center w-full" href="/samples/resume-after.png" target="_blank" rel="noopener noreferrer">
            <Download size={15} /> Download both
          </a>
        </>
      )}

      {app.status === "scored" && (
        <>
          <p className="tmD-drawer-sec">Next step</p>
          <p className="tm-small" style={{ color: "var(--tm-zinc)", lineHeight: 1.55 }}>
            {app.tier === "weak"
              ? "Weak fit — the score suggests skipping this one and saving your credit for a stronger match."
              : "Scored without spending a credit. Run the full tailoring when you're ready."}
          </p>
          <Link
            href={ROUTES.audit}
            className={"tm-btn justify-center w-full mt-[4px] " + (app.tier === "weak" ? "tm-btn--outline" : "tm-btn--primary")}
          >
            Tailor my resume — 1 credit
          </Link>
        </>
      )}

      {app.status !== "scored" &&
        (app.michael === "reviewing" ? (
          <div className="tmD-michael is-active">
            <Image src="/michael.png" alt="" width={36} height={36} />
            <div className="flex-1">
              <b>Michael is reviewing this one</b>
              <span>In queue · returns in ~48h</span>
            </div>
            <span className="tm-pill tm-pill--mint"><Check size={12} /> added</span>
          </div>
        ) : (
          <button type="button" className="tmD-michael tmD-michael--btn" onClick={onRequestReview}>
            <Image src="/michael.png" alt="" width={36} height={36} />
            <div className="flex-1">
              <b>Add Michael&apos;s expert review</b>
              <span>Line-by-line pass · 48h turnaround</span>
            </div>
            <span className="tm-pill tm-pill--mint">+$49</span>
          </button>
        ))}
    </div>
  );
}

function DocumentsView() {
  return (
    <div className="tmD-docs">
      {DOCS.map((d) => (
        <div key={d.name} className="tm-card tmD-doc">
          <span className="tmD-doc-thumb"><FileText size={22} strokeWidth={1.5} /></span>
          <span className="tmD-doc-body">
            <b>{d.role ? `${d.role} · ${d.company}` : "Master resume"}</b>
            <span>{d.kind} · {d.pages} · {d.date}</span>
            <span className="tmD-doc-file"><FileText size={12} /> {d.name}</span>
          </span>
          <span className="tmD-doc-side">
            {d.fit != null ? <span className="tm-pill tm-pill--mint">{d.fit} fit</span> : <span className="tm-pill">original</span>}
            <a className="tm-btn tm-btn--outline tm-btn--sm" href={d.href} target="_blank" rel="noopener noreferrer">
              <Download size={13} /> Download
            </a>
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
  // Per-application Michael overrides — clicking "Add Michael's review" in the
  // demo optimistically flips an app to "reviewing" (the live dashboard does the
  // real Stripe round-trip instead).
  const [michael, setMichael] = useState<Record<string, MichaelState>>({});
  const session = useDemoSession();

  useEffect(() => {
    const id = setInterval(() => setRunStage((s) => (s >= 3 ? 1 : s + 1)), 2200);
    return () => clearInterval(id);
  }, []);

  if (!session) {
    return (
      <section className="tm-sec">
        <div className="tm-wrap">
          <div className="tm-card tmD-empty mt-[12px]">
            <Lock size={30} strokeWidth={1.5} className="text-[var(--tm-blue-600)]" />
            <h2>Sign in to see your applications</h2>
            <p>Your tailored resumes, cover letters, and agent feedback live here — sign in to pick up where you left off.</p>
            <Link className="tm-btn tm-btn--primary tm-btn--lg" href={ROUTES.signIn}>Sign in</Link>
          </div>
        </div>
      </section>
    );
  }

  const apps = APPS.map((a) => ({ ...a, michael: michael[a.id] ?? a.michael }));
  const filtered = apps.filter((a) => {
    if (filter === "all") return true;
    if (filter === "strong") return a.tier === "strong" || a.tier === "good";
    if (filter === "ready") return a.status === "ready";
    if (filter === "michael") return a.michael !== "none";
    return true;
  });
  const sorted = [...filtered].sort((a, b) => sort === "fit" ? (b.fit ?? 0) - (a.fit ?? 0) : 0);
  const openApp = apps.find((a) => a.id === openId && sorted.some((s) => s.id === a.id));

  return (
    <section className="tm-sec">
      <div className="tm-wrap">
        {/* Header */}
        <div className="tmD-head">
          <h1>Your applications</h1>
          <div className="tmD-head-right">
            <span className="tmD-credits">
              <b>7 credits</b> · <Link href={ROUTES.buyCredits}>buy more</Link>
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
          <span className="tmD-user-avatar">{initials(session.name)}</span>
          <div>
            <b>{session.name}</b>
            <span>{session.email}</span>
          </div>
        </div>

        {/* Tabs */}
        <div className="tmD-tabs">
          <span className={"tmD-tab" + (view === "apps" ? " is-on" : "")} onClick={() => setView("apps")}>
            Applications <i>{APPS.length}</i>
          </span>
          <span className={"tmD-tab" + (view === "docs" ? " is-on" : "")} onClick={() => setView("docs")}>
            Documents <i>{DOCS.length}</i>
          </span>
        </div>

        {view === "docs" ? (
          <DocumentsView />
        ) : (
          <>
            {/* Filters + Sort */}
            <div className="tmD-filters">
              {FILTERS.map(([k, l]) => (
                <span key={k} className={"tmD-chip" + (filter === k ? " is-on" : "")} onClick={() => setFilter(k)}>{l}</span>
              ))}
              <span className="tmD-sort">
                sort by
                <span className={sort === "date" ? "is-on" : ""} onClick={() => setSort("date")}>date</span>
                <span className={sort === "fit" ? "is-on" : ""} onClick={() => setSort("fit")}>fit</span>
              </span>
            </div>

            <div className="tmD-layout mt-[4px]">
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

                {/* Rows */}
                <div className="tmD-list">
                  {sorted.map((a) => (
                    <div
                      key={a.id}
                      className={"tm-card tmD-row" + (openId === a.id ? " is-open" : "")}
                      onClick={() => setOpenId(openId === a.id ? null : a.id)}
                    >
                      <ChevronRight size={15} className="tmD-chevron" />
                      <div className="tmD-row-co">
                        <b>{a.role}</b>
                        <span>{a.co}</span>
                      </div>
                      <ScoreRing fit={a.fit} tier={a.tier} running={a.status === "running"} />
                      <StageProgress status={a.status} runStage={runStage} />
                      <span className="tmD-row-date">{a.date}</span>
                      <MoreHorizontal size={15} className="tmD-row-menu" />
                    </div>
                  ))}
                  {sorted.length === 0 && (
                    <div className="tm-card tmD-empty"><p>Nothing matches this filter.</p></div>
                  )}
                </div>
              </div>

              {openApp ? (
                <Drawer
                  app={openApp}
                  onClose={() => setOpenId(null)}
                  onRequestReview={() => setMichael((m) => ({ ...m, [openApp.id]: "reviewing" }))}
                />
              ) : (
                <div className="tmD-drawer-empty">
                  <FileText size={26} strokeWidth={1.5} />
                  <p>Select an application to see its fit breakdown and files.</p>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </section>
  );
}
