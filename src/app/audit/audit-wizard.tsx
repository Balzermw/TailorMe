"use client";

// Free audit wizard — a real 3-step flow.
// Step 1: upload a resume (real PDF/Word/text parsing) or use the sample.
// Step 2: paste a posting → real fit scoring (Anthropic) or simulated.
// Step 3: results. Signed-out → watermarked preview + account gate.
//         Signed-in → run the full tailored application (spends 1 credit),
//         showing the real tailored bullets, agent notes, and a PDF download.

import { Fragment, useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  Briefcase,
  Check,
  Download,
  FileText,
  List,
  PenLine,
  Plus,
  Sparkles,
  TrendingUp,
  Upload,
  User,
} from "lucide-react";
import { AGENTS_FULL, ROUTES, SCORES } from "@/components/landing/data";
import type { ApplyResult, ResumeStats } from "@/lib/types";
import { pdfHref } from "@/lib/apply/render";
import { useSession } from "@/lib/auth";
import {
  clearSavedResume,
  loadSavedResume,
  saveResume,
  type SavedResume,
} from "@/lib/resume";

// Per-dimension demo evidence (fallback when Anthropic isn't configured).
const FIT_WHY: { plus: string[]; minus: string[] }[] = [
  {
    plus: [
      "Node.js at scale — your checkout-migration bullet matches the posting’s core requirement",
      "Kubernetes — you own deployment standards; named as required",
      "Distributed systems — strong overlap with the platform team’s stack",
    ],
    minus: [
      "Observability appears 3× in the posting but 0× in your resume — tailoring will surface your Datadog work",
    ],
  },
  {
    plus: [
      "7 years senior-level vs 5+ required",
      "Migration ownership maps directly to the role’s “own our platform evolution” mandate",
    ],
    minus: [
      "No formal platform-team title — your platform work is buried under a generic SWE heading",
    ],
  },
  {
    plus: [
      "Mentoring 6 engineers matches the posting’s “grow the team” emphasis",
      "Code-review ownership signals the collaboration they ask for",
    ],
    minus: [
      "Little evidence of cross-team work in your current bullets — likely present, just unwritten",
    ],
  },
  {
    plus: [
      "Natural next step: your last 3 years trend toward platform and infrastructure work",
      "The role’s scope matches the trajectory your bullets already show",
    ],
    minus: [],
  },
];

interface FitView {
  header: string;
  overall: number;
  verdictPill: string;
  summary: string;
  locationPass: boolean;
  locationNote: string;
  dims: { label: string; score: number; plus: string[]; gaps: string[] }[];
}

const DEMO_VIEW: FitView = {
  header: "Senior Platform Engineer — Nordpeak Systems",
  overall: 84,
  verdictPill: "84 — strong fit",
  summary:
    "Why 84 — strong fit: your platform work lines up with 4 of 5 dimensions. The weakest one — culture fit — isn’t missing experience, it’s missing evidence in your bullets. That’s exactly what tailoring surfaces. Tap any dimension to see what we found.",
  locationPass: true,
  locationNote: "posting allows Remote EU — your profile lists Copenhagen",
  dims: SCORES.map((s, i) => ({
    label: s.l,
    score: s.v,
    plus: FIT_WHY[i].plus,
    gaps: FIT_WHY[i].minus,
  })),
};

function toView(result: ApplyResult): FitView {
  const fit = result.fit;
  return {
    header: `${result.role} — ${result.company}`,
    overall: fit.overall,
    verdictPill: `${fit.overall} — ${fit.verdict}`,
    summary: fit.summary,
    locationPass: fit.locationPass,
    locationNote: fit.locationNote,
    dims: fit.dimensions.map((d) => ({
      label: d.label,
      score: d.score,
      plus: d.matched,
      gaps: d.gaps,
    })),
  };
}

const STEP_LABELS = ["Your resume", "The job", "Agent audit"];

function Stepper({ step }: { step: number }) {
  return (
    <div className="tmF-stepper">
      {STEP_LABELS.map((l, i) => (
        <Fragment key={l}>
          {i > 0 && <span className="tmF-stepper-sep"></span>}
          <span
            className={
              "tmF-stepper-item" +
              (i === step ? " is-on" : "") +
              (i < step ? " is-done" : "")
            }
          >
            <span className="tmF-stepper-num">
              {i < step ? <Check size={12} /> : i + 1}
            </span>{" "}
            {l}
          </span>
        </Fragment>
      ))}
    </div>
  );
}

// ---------- Step 1: upload (real parsing) ----------
function StepUpload({
  onNext,
  onSample,
  onUploaded,
  onReset,
  stats,
  fromSample,
}: {
  onNext: () => void;
  onSample: () => void;
  onUploaded: (text: string, stats: ResumeStats) => void;
  onReset: () => void;
  stats: ResumeStats | null;
  fromSample: boolean;
}) {
  // Initialize from props so a resume already chosen in the parent (e.g. after
  // navigating back from the job step) re-shows its profile instead of being lost.
  const [phase, setPhase] = useState<"idle" | "parsing" | "done">(() =>
    !fromSample &&
    !!stats &&
    (stats.roles > 0 || stats.bullets > 0 || (stats.skills?.length ?? 0) > 0)
      ? "done"
      : "idle",
  );
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<SavedResume | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // "Upload once": offer a previously-saved resume (account in live mode,
  // localStorage in demo mode).
  useEffect(() => {
    let active = true;
    loadSavedResume().then((r) => {
      if (active && r && r.text) setSaved(r);
    });
    return () => {
      active = false;
    };
  }, []);

  // Sample path: no upload, show the known composite profile.
  const done = phase === "done" || (fromSample && phase !== "parsing");
  const showSample = fromSample && !stats;

  const handleFile = async (file: File) => {
    setError(null);
    setPhase("parsing");
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/parse-resume", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "parse failed");
      const s = data.stats as ResumeStats;
      onUploaded(data.text, s);
      setPhase("done");
      // Persist for next time — no-op if signed out in live mode.
      void saveResume({ name: s?.name || "My resume", text: data.text, stats: s });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn’t read that file.");
      setPhase("idle");
    }
  };

  const useSaved = () => {
    if (!saved) return;
    if (saved.stats) {
      onUploaded(saved.text, saved.stats);
      setPhase("done");
    } else {
      // No parsed snapshot stored — skip the empty profile panel and go straight
      // to the job step (resume text is fully present and usable).
      onUploaded(saved.text, {
        name: saved.name,
        roles: 0,
        bullets: 0,
        metricBullets: 0,
        skills: [],
      });
      onNext();
    }
  };

  const forgetSaved = () => {
    setSaved(null);
    void clearSavedResume();
  };

  const useSampleNow = () => {
    onSample();
    setPhase("parsing");
    setTimeout(() => setPhase("done"), 1300);
  };

  return (
    <div className="tm-card">
      {phase === "idle" && !done && (
        <div>
          {saved && (
            <div
              style={{
                border: "0.5px solid var(--tm-border)",
                borderRadius: "12px",
                padding: "16px 18px",
                marginBottom: "16px",
                background: "var(--tm-blue-50)",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                <span
                  style={{
                    display: "flex",
                    height: "40px",
                    width: "40px",
                    flex: "none",
                    alignItems: "center",
                    justifyContent: "center",
                    borderRadius: "50%",
                    background: "#fff",
                    color: "var(--tm-blue-800)",
                  }}
                  aria-hidden="true"
                >
                  <FileText size={18} />
                </span>
                <div style={{ minWidth: 0 }}>
                  <b>{saved.name}</b>
                  <span
                    className="tm-small"
                    style={{ display: "block", fontSize: "12.5px" }}
                  >
                    your saved resume — ready to reuse
                  </span>
                </div>
                <span className="tm-pill tm-pill--mint" style={{ marginLeft: "auto" }}>
                  <Check size={12} /> saved
                </span>
              </div>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "14px",
                  marginTop: "14px",
                }}
              >
                <button
                  type="button"
                  className="tm-btn tm-btn--primary"
                  onClick={useSaved}
                >
                  Use this resume <ArrowRight size={15} />
                </button>
                <button
                  type="button"
                  onClick={forgetSaved}
                  className="tm-small"
                  style={{
                    color: "var(--tm-zinc)",
                    textDecoration: "underline",
                    cursor: "pointer",
                    background: "none",
                    border: "none",
                  }}
                >
                  forget it
                </button>
              </div>
              <p className="tmF-or">or upload a different one</p>
            </div>
          )}
          <input
            ref={fileRef}
            type="file"
            accept=".pdf,.doc,.docx,.txt,.md"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void handleFile(f);
            }}
          />
          <button
            type="button"
            className="tmF-drop w-full"
            onClick={() => fileRef.current?.click()}
          >
            <Upload size={26} strokeWidth={1.6} />
            <b>Upload your resume</b>
            <span>PDF, Word, or text · parsed once, encrypted at rest</span>
          </button>
          {error && (
            <p
              className="tm-small text-center mt-[10px]"
              style={{ color: "#b3261e" }}
            >
              {error}
            </p>
          )}
          <p className="tmF-or">or</p>
          <button
            type="button"
            className="tm-btn tm-btn--outline w-full justify-center"
            onClick={useSampleNow}
          >
            Try with the sample resume (Alex M.)
          </button>
        </div>
      )}
      {phase === "parsing" && (
        <div className="tmF-parse">
          <p className="tmF-parse-line">
            <Check size={14} /> Reading your resume…
          </p>
          <p className="tmF-parse-line">
            <Check size={14} /> Extracting roles, dates, and skills
          </p>
          <p className="tmF-parse-line">
            <Check size={14} /> Finding the achievements buried in your bullets
          </p>
          <p className="tmF-parse-line">
            <Check size={14} /> Profile ready
          </p>
        </div>
      )}
      {done && (
        <div className="tmF-profile2">
          <div className="tmF-profile2-id">
            <div
              className="flex h-[64px] w-[64px] flex-none items-center justify-center rounded-full bg-[var(--tm-blue-50)] text-[var(--tm-blue-800)]"
              aria-hidden="true"
            >
              <User size={26} strokeWidth={1.6} />
            </div>
            <div>
              <b>{showSample ? "Alex Mercer" : (stats?.name ?? "Your resume")}</b>
              <span className="tm-small mt-[2px] block">
                {showSample
                  ? "Senior Software Engineer · 7 yrs · sample profile"
                  : "parsed from your upload"}
              </span>
            </div>
            <span className="tm-pill tm-pill--mint ml-auto">
              <Check size={12} /> parsed
            </span>
          </div>
          <div className="tmF-profile2-cols">
            <div className="tmF-p2-group">
              <p className="tmF-p2-label">What we extracted</p>
              <div className="tmF-p2-rows">
                <span className="tmF-p2-row">
                  <Briefcase size={15} />{" "}
                  <span>
                    <b>{showSample ? 2 : (stats?.roles ?? 0)}</b> role
                    {(showSample ? 2 : (stats?.roles ?? 0)) === 1 ? "" : "s"}
                  </span>
                </span>
                <span className="tmF-p2-row">
                  <List size={15} />{" "}
                  <span>
                    <b>{showSample ? 14 : (stats?.bullets ?? 0)}</b> experience
                    bullets
                  </span>
                </span>
                <span className="tmF-p2-row">
                  <TrendingUp size={15} />{" "}
                  <span>
                    <b>{showSample ? 3 : (stats?.metricBullets ?? 0)}</b> bullets
                    with metrics
                  </span>
                </span>
              </div>
            </div>
            <div className="tmF-p2-group">
              <p className="tmF-p2-label">
                Skills found{" "}
                <span className="tmF-p2-count">
                  {showSample ? 11 : (stats?.skills?.length ?? 0)}
                </span>
              </p>
              <div className="tmF-chips">
                {(showSample
                  ? ["React", "Node.js", "Kubernetes", "PostgreSQL", "Mentoring"]
                  : (stats?.skills ?? []).slice(0, 5)
                ).map((s) => (
                  <span key={s} className="tm-pill tm-pill--gray">
                    {s}
                  </span>
                ))}
                {(() => {
                  const total = showSample ? 11 : (stats?.skills?.length ?? 0);
                  return total > 5 ? (
                    <span className="tm-pill tm-pill--line">
                      +{total - 5} more
                    </span>
                  ) : null;
                })()}
              </div>
            </div>
          </div>
          <div
            className="tmF-profile2-foot"
            style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "10px" }}
          >
            <button
              type="button"
              className="tm-btn tm-btn--primary"
              onClick={onNext}
            >
              Next — pick the job <ArrowRight size={15} />
            </button>
            <button
              type="button"
              onClick={() => {
                onReset();
                setPhase("idle");
              }}
              className="tm-small"
              style={{
                color: "var(--tm-zinc)",
                textDecoration: "underline",
                cursor: "pointer",
                background: "none",
                border: "none",
              }}
            >
              use a different resume
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------- Step 2: posting + fit score ----------
function StepJob({
  posting,
  setPosting,
  useSample,
  resumeText,
  onNext,
}: {
  posting: string;
  setPosting: (v: string) => void;
  useSample: boolean;
  resumeText: string;
  onNext: () => void;
}) {
  const [phase, setPhase] = useState<"idle" | "scoring" | "done">("idle");
  const [view, setView] = useState<FitView>(DEMO_VIEW);
  const [w, setW] = useState<number[]>([]);
  const [why, setWhy] = useState(0);
  const [note, setNote] = useState<string | null>(null);
  const [fetching, setFetching] = useState(false);
  const [fetchErr, setFetchErr] = useState<string | null>(null);
  const [fetchNote, setFetchNote] = useState<string | null>(null);
  const [demoScore, setDemoScore] = useState(false);

  const score = async () => {
    if (phase !== "idle" || fetching) return;
    setFetchErr(null);
    setDemoScore(false);
    let postingForScore = posting.trim();

    // If they pasted a link, pull the posting text server-side first (SSRF-safe).
    // Gated only on the input being a URL — independent of which resume they use.
    if (/^https?:\/\//i.test(postingForScore)) {
      setFetching(true);
      setFetchNote(null);
      try {
        const r = await fetch("/api/fetch-posting", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url: postingForScore }),
        });
        const d = await r.json();
        if (r.ok && d.text) {
          postingForScore = d.text as string;
          setPosting(postingForScore); // show what we pulled; carries into step 3
          setFetchNote(
            d.truncated
              ? "Pulled from the link — we trimmed a long page to its most relevant part."
              : "Pulled the posting from that link.",
          );
        } else {
          setFetchErr(d.error || "Couldn’t read that link. Paste the posting text instead.");
          setFetching(false);
          return;
        }
      } catch {
        setFetchErr("Couldn’t read that link. Paste the posting text instead.");
        setFetching(false);
        return;
      }
      setFetching(false);
    }

    setPhase("scoring");
    let v = DEMO_VIEW;
    let msg: string | null = null;
    try {
      const res = await fetch("/api/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "score",
          useSample,
          resumeText,
          postingText: postingForScore,
        }),
      });
      const data = await res.json();
      if (data.result) {
        v = toView(data.result as ApplyResult);
      } else if (res.status === 429 || res.status === 413) {
        // Free limit reached or input too large → show the sample, nudge signup.
        msg = data.error as string;
      } else if (data.demo) {
        // No provider configured → DEMO_VIEW is shown; flag it as a sample.
        setDemoScore(true);
      }
      // other errors → silent simulated fallback
    } catch {
      /* fall back to the simulated result */
    }
    setNote(msg);
    setView(v);
    setWhy(0);
    setW(v.dims.map(() => 0));
    setTimeout(() => setW(v.dims.map((d) => d.score)), 250);
    setTimeout(() => setPhase("done"), 1100);
  };

  const ci = view.summary.indexOf(":");
  const summaryLead = ci >= 0 ? view.summary.slice(0, ci + 1) : "";
  const summaryRest = ci >= 0 ? view.summary.slice(ci + 1) : view.summary;

  const sample =
    "Senior Platform Engineer — Nordpeak Systems (Remote, EU). Own the evolution of our backend platform: lead distributed Node.js services handling millions of daily transactions, set Kubernetes deployment standards across teams, and build observability into everything we ship. Requirements: 5+ years backend at scale; distributed systems and Node.js in production; strong Kubernetes and cloud (AWS/GCP); a track record of reliability and performance wins; mentoring and technical direction. Nice to have: Datadog/Prometheus; owning a platform other teams build on.";
  return (
    <div className="tm-card">
      <label
        className="mb-[8px] block text-[13px] font-medium"
        htmlFor="tmF-job-input"
      >
        Paste a job URL or the posting text
      </label>
      <textarea
        id="tmF-job-input"
        className="tmF-ta"
        value={posting}
        placeholder="https://…  or paste the full posting"
        onChange={(e) => {
          setPosting(e.target.value);
          setFetchErr(null); // a prior link error no longer applies once they edit
          // Editing after a score invalidates it — return to idle so the user
          // re-scores the text that will actually be tailored.
          if (phase !== "idle") {
            setPhase("idle");
            setNote(null);
            setFetchNote(null);
            setDemoScore(false);
          }
        }}
      ></textarea>
      {fetchNote && (
        <p
          className="tm-small mt-[8px]"
          style={{ color: "var(--tm-mint-600)", fontSize: "12px" }}
        >
          <Check size={12} style={{ verticalAlign: "-2px" }} /> {fetchNote}
        </p>
      )}
      {phase === "idle" && (
        <Fragment>
          <p className="tm-small mt-[8px]" style={{ fontSize: "12px" }}>
            Paste a link and we’ll pull the posting for you — or paste the text.
          </p>
          {fetchErr && (
            <p className="tm-small mt-[8px]" style={{ color: "#b3261e" }}>
              {fetchErr}
            </p>
          )}
          <div className="tmF-actions" style={{ justifyContent: "space-between" }}>
            <button
              type="button"
              className="tm-btn tm-btn--ghost"
              onClick={() => setPosting(sample)}
            >
              Use the sample posting
            </button>
            <button
              type="button"
              className="tm-btn tm-btn--primary"
              style={{
                opacity: posting && !fetching ? 1 : 0.45,
                pointerEvents: posting && !fetching ? "auto" : "none",
              }}
              onClick={() => void score()}
            >
              {fetching ? (
                "Reading the posting…"
              ) : (
                <Fragment>
                  Score my fit <ArrowRight size={15} />
                </Fragment>
              )}
            </button>
          </div>
        </Fragment>
      )}
      {phase !== "idle" && (
        <div className="mt-[24px]">
          <div className="tm-fit tmF-fit">
            <div className="tm-fit-head">
              <h3>{view.header}</h3>
              {phase === "done" && (
                <span className="tm-pill tm-pill--mint">{view.verdictPill}</span>
              )}
            </div>
            {view.dims.map((d, i) => (
              <div key={d.label}>
                <div
                  className={
                    "tm-fit-row tmF-why-row" +
                    (phase === "done" ? " is-clickable" : "")
                  }
                  onClick={() => phase === "done" && setWhy(why === i ? -1 : i)}
                >
                  <label>{d.label}</label>
                  <div className="tm-fit-track">
                    <div
                      className="tm-fit-bar"
                      style={{ width: (w[i] ?? 0) + "%" }}
                    ></div>
                  </div>
                  <output>{phase === "done" ? d.score : ""}</output>
                  {phase === "done" && (
                    <span
                      className={"tmF-why-toggle" + (why === i ? " is-open" : "")}
                    >
                      <Plus size={13} />
                    </span>
                  )}
                </div>
                {phase === "done" && why === i && (
                  <div className="tmF-why">
                    {d.plus.map((p, pi) => (
                      <p key={`p-${pi}`} className="tmF-why-line is-plus">
                        <Check size={12} /> {p}
                      </p>
                    ))}
                    {d.gaps.map((m, mi) => (
                      <p key={`g-${mi}`} className="tmF-why-line is-minus">
                        <Plus size={12} style={{ transform: "rotate(45deg)" }} />{" "}
                        {m}
                      </p>
                    ))}
                  </div>
                )}
              </div>
            ))}
            <div className="tm-fit-pass">
              <label>Location & logistics</label>
              {phase === "done" ? (
                <span
                  className="tm-small"
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "8px",
                    fontSize: "12.5px",
                  }}
                >
                  <span
                    className={
                      "tm-pill " +
                      (view.locationPass ? "tm-pill--mint" : "tm-pill--gray")
                    }
                  >
                    <Check size={12} /> {view.locationPass ? "pass" : "check"}
                  </span>{" "}
                  {view.locationNote}
                </span>
              ) : (
                <span className="tm-small">checking…</span>
              )}
            </div>
          </div>
          {phase === "done" && (
            <Fragment>
              {note && (
                <p
                  className="tmS-free mt-[16px]"
                  style={{ display: "flex", gap: "10px", alignItems: "center" }}
                >
                  {note} This is a sample result —{" "}
                  <Link
                    href={ROUTES.signIn}
                    style={{ color: "var(--tm-mint-600)", textDecoration: "underline" }}
                  >
                    create a free account
                  </Link>{" "}
                  to run your own.
                </p>
              )}
              {demoScore && (
                <p
                  className="tmS-free mt-[16px]"
                  style={{ display: "flex", gap: "10px", alignItems: "center" }}
                >
                  Demo mode — this is a sample result, not scored from your
                  resume. Add a provider key to score real resumes.
                </p>
              )}
              <div className="tmF-verdict">
                <b>{summaryLead}</b>
                {summaryRest}
              </div>
              <div className="tmF-actions">
                <button
                  type="button"
                  className="tm-btn tm-btn--primary"
                  onClick={onNext}
                >
                  Run my free audit <ArrowRight size={15} />
                </button>
              </div>
            </Fragment>
          )}
        </div>
      )}
    </div>
  );
}

// ---------- Step 3: results (signed-out gate OR signed-in full run) ----------
function MichaelPitch() {
  return (
    <div className="tm-card tmF-michael">
      <Image
        src="/michael.png"
        alt="Michael, head of Res.Me"
        width={72}
        height={72}
      />
      <div className="tmF-michael-body">
        <span className="tmF-michael-eyebrow">
          <PenLine size={13} /> Optional human pass
        </span>
        <h3>Want real human eyes on it? That’s Michael.</h3>
        <p>
          The agents catch what a parser and a skim-read see. Michael — head of
          Res.Me, Certified Professional Resume Writer, 650+ resumes written —
          reads it like the hiring manager: he goes line by line through your
          final draft and adds positioning notes for this specific role. Back in
          your inbox within 48 hours.
        </p>
        <div className="tmF-michael-foot">
          <span className="tm-pill tm-pill--mint">+$49 per application</span>
          <span className="tm-small" style={{ fontSize: "12.5px" }}>
            Add it at checkout — or{" "}
            <Link
              href={ROUTES.coaching}
              style={{ color: "var(--tm-blue-600)", textDecoration: "none" }}
            >
              meet Michael first
            </Link>
          </span>
        </div>
      </div>
    </div>
  );
}

function StepResults({
  useSample,
  resumeText,
  posting,
}: {
  useSample: boolean;
  resumeText: string;
  posting: string;
}) {
  const router = useRouter();
  const { user } = useSession();
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [full, setFull] = useState<{
    result: ApplyResult;
    applicationId: string | null;
  } | null>(null);
  const [demoFull, setDemoFull] = useState(false);

  const runFull = async () => {
    if (running) return;
    setRunning(true);
    setError(null);
    try {
      const res = await fetch("/api/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "full",
          useSample,
          resumeText,
          postingText: posting,
        }),
      });
      if (res.status === 401) {
        router.push(ROUTES.signIn);
        return;
      }
      const data = await res.json();
      if (res.status === 402 || data.needCredits) {
        setError(data.error || "You’re out of credits.");
        return;
      }
      if (data.result) {
        setFull({ result: data.result, applicationId: data.applicationId ?? null });
      } else if (data.demo) {
        setDemoFull(true); // demo mode — no real documents generated
      } else {
        // 429 (rate limited), 413 (too large), or 5xx → show the message
        setError(data.error || "Something went wrong. Please try again.");
      }
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setRunning(false);
    }
  };

  // ----- real tailored result -----
  if (full) {
    const r = full.result;
    return (
      <div className="flex flex-col gap-[20px]">
        <div className="tm-card tmF-gate" style={{ padding: "30px" }}>
          <span className="tm-pill tm-pill--mint">
            <Check size={12} /> tailored & reviewed — {r.fit.overall} fit
          </span>
          <h3>Your application for {r.company} is ready</h3>
          <p>
            A tailored resume and cover letter for {r.role}, reviewed line by
            line. Download it as a PDF or pick it up anytime in your dashboard.
          </p>
          <div
            style={{ display: "flex", gap: "12px", flexWrap: "wrap", justifyContent: "center" }}
          >
            {full.applicationId && (
              <Link
                className="tm-btn tm-btn--primary tm-btn--lg"
                href={pdfHref(full.applicationId)}
              >
                <Download size={16} /> Download PDF
              </Link>
            )}
            <Link className="tm-btn tm-btn--outline tm-btn--lg" href={ROUTES.dashboard}>
              <FileText size={16} /> View in dashboard
            </Link>
          </div>
        </div>
        {r.bullets.length > 0 && (
          <div
            className="tm-card"
            style={{ padding: "22px 24px", display: "flex", flexDirection: "column", gap: "14px" }}
          >
            <span className="tmB-ev-head">
              <Sparkles size={14} /> What changed
            </span>
            {r.bullets.slice(0, 3).map((b, i) => (
              <div key={i} className="tmB-tl-rw">
                <p className="tmB-tl-before">{b.before}</p>
                <p className="tmB-tl-after">{b.after}</p>
              </div>
            ))}
          </div>
        )}
        {r.agentNotes.length > 0 && (
          <div
            className="tm-card"
            style={{ padding: "22px 24px", display: "flex", flexDirection: "column", gap: "12px" }}
          >
            <span className="tmB-ev-head">
              <Sparkles size={14} /> Agent review
            </span>
            {r.agentNotes.slice(0, 6).map((n, i) => (
              <p key={i} className="tmB-rq-item">
                <span className="tm-pill">{n.agent}</span>
                {n.text}
              </p>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-[20px]">
      <div
        className="tm-card tmF-wm tmB-paper--doc tmB-paper"
        style={{ border: "0.5px solid var(--tm-border)" }}
      >
        <div className="tmB-pdoc-head">
          <span className="tmB-pdoc-avatar">AM</span>
          <p className="tmB-pdoc-name">Alex Mercer</p>
          <p className="tmB-pdoc-contact">
            Senior Platform Engineer · Copenhagen · alex.m@email.com
          </p>
        </div>
        <div className="tmB-pdoc-rule"></div>
        <p className="tmB-pdoc-sec">Experience</p>
        <p className="tmB-pdoc-bullet">
          Led migration of checkout to a{" "}
          <mark className="tm-k">distributed Node.js service</mark>, cutting p95
          latency <mark className="tm-m">38%</mark> across 2.4M daily
          transactions.
        </p>
        <p className="tmB-pdoc-bullet">
          Mentored <mark className="tm-m">6 engineers</mark> through promotion
          cycles while owning <mark className="tm-k">Kubernetes</mark> deployment
          standards.
        </p>
      </div>
      <div
        className="tm-card"
        style={{
          padding: "22px 24px",
          display: "flex",
          flexDirection: "column",
          gap: "12px",
        }}
      >
        <span className="tmB-ev-head">
          <Sparkles size={14} /> Reviewed by 3 trained specialist agents
        </span>
        <p className="tm-small" style={{ fontSize: "12.5px", marginTop: "-4px" }}>
          Each agent reads your draft as a different gatekeeper — the ATS parser,
          the recruiter, the hiring manager — and returns concrete fixes, not a
          score.
        </p>
        {AGENTS_FULL.map((a) => (
          <p key={a.name} className="tmB-rq-item">
            <span className="tm-pill">{a.name}</span>
            {a.notes[0].txt}
          </p>
        ))}
      </div>
      <MichaelPitch />

      {error && (
        <p className="tm-small text-center" style={{ color: "#b3261e" }}>
          {error}{" "}
          {error.includes("credits") && (
            <Link
              href={ROUTES.buyCredits}
              style={{ color: "var(--tm-blue-600)" }}
            >
              Buy credits
            </Link>
          )}
        </p>
      )}

      {demoFull && (
        <p className="tmS-free" style={{ justifyContent: "center" }}>
          Demo mode — connect Anthropic to generate the real tailored documents.
        </p>
      )}

      {user ? (
        <div className="tm-card tmF-gate" style={{ padding: "30px" }}>
          <span className="tm-pill tm-pill--mint">
            <Check size={12} /> signed in as {user.name}
          </span>
          <h3>Run the full tailored application</h3>
          <p>
            We’ll rewrite every bullet for this posting, run the three-agent
            review, and produce a compiled resume + cover letter. Uses 1 credit.
          </p>
          <button
            type="button"
            className="tm-btn tm-btn--primary tm-btn--lg"
            disabled={running}
            onClick={() => void runFull()}
          >
            <Sparkles size={16} />{" "}
            {running ? "Tailoring your application…" : "Tailor my application — 1 credit"}
          </button>
          <p className="tm-small" style={{ fontSize: "12px" }}>
            Your first application is free · credits never expire
          </p>
        </div>
      ) : (
        <div className="tm-card tmF-gate" style={{ padding: "30px" }}>
          <span className="tm-pill tm-pill--mint">
            <Check size={12} /> your audit is ready
          </span>
          <h3>Create a free account to download it</h3>
          <p>
            The clean PDF, the cover letter, and the full line-by-line feedback
            report. Your first application is free — no card required.
          </p>
          <Link
            className="tm-btn tm-btn--primary tm-btn--lg"
            href={ROUTES.signIn}
          >
            <Sparkles size={16} /> Create free account
          </Link>
          <p className="tm-small" style={{ fontSize: "12px" }}>
            Encrypted at rest · delete everything in one click
          </p>
        </div>
      )}
    </div>
  );
}

export default function AuditWizard() {
  const [step, setStep] = useState(0);
  const [resumeText, setResumeText] = useState("");
  const [useSample, setUseSample] = useState(false);
  const [stats, setStats] = useState<ResumeStats | null>(null);
  const [posting, setPosting] = useState("");

  return (
    <Fragment>
      <section className="tm-sec tmF-head" style={{ paddingBottom: 0 }}>
        <span className="tm-pill">Free agentic AI audit</span>
        <h1 className="tm-h1">See what tailoring does to your resume</h1>
        <p className="tm-body">
          Three steps, about two minutes. Your draft is reviewed by three
          specialist AI agents — trained on ATS parsing, impact, and role-fit —
          each returning line-level fixes. First application free, no card
          required.
        </p>
        <Stepper step={step} />
      </section>
      <section className="tm-sec" style={{ paddingTop: 0 }}>
        <div className="tmF-panel">
          {step === 0 && (
            <StepUpload
              stats={stats}
              fromSample={useSample}
              onSample={() => {
                setUseSample(true);
                setStats(null);
                setResumeText("");
              }}
              onUploaded={(text, s) => {
                setUseSample(false);
                setResumeText(text);
                setStats(s);
              }}
              onReset={() => {
                setUseSample(false);
                setStats(null);
                setResumeText("");
              }}
              onNext={() => setStep(1)}
            />
          )}
          {step === 1 && (
            <StepJob
              posting={posting}
              setPosting={setPosting}
              useSample={useSample}
              resumeText={resumeText}
              onNext={() => setStep(2)}
            />
          )}
          {step === 2 && (
            <StepResults
              useSample={useSample}
              resumeText={resumeText}
              posting={posting}
            />
          )}
          {step > 0 && step < 2 && (
            <p
              className="tm-small mt-[16px] cursor-pointer text-center"
              onClick={() => setStep(step - 1)}
            >
              ← back
            </p>
          )}
        </div>
      </section>
    </Fragment>
  );
}
