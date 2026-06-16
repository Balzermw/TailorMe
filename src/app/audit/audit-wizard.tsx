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
  AlertTriangle,
  ArrowRight,
  Briefcase,
  Calendar,
  Check,
  ChevronDown,
  Download,
  FileText,
  List,
  PenLine,
  Plus,
  Quote,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  Upload,
  User,
} from "lucide-react";
import { ROUTES, SCORES } from "@/components/landing/data";
import type {
  ApplyResult,
  AuditAgent,
  ProofPoint,
  ResumeStats,
  RoleContext,
} from "@/lib/types";
import { pdfHref, texHref } from "@/lib/apply/render";
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
  verdict: string; // clean verdict tier, e.g. "Strong fit"
  verdictPill: string;
  summary: string;
  locationPass: boolean;
  locationNote: string;
  dims: { label: string; score: number; plus: string[]; gaps: string[]; why?: string }[];
  keywords: { term: string; inResume: boolean }[];
  recommendReview?: boolean;
}

// Per-dimension "why this score" lines for the demo fit view.
const DEMO_WHY = [
  "Your platform stack overlaps the posting’s core requirements on 4 of 5 hard skills; the one gap (observability) is evidence-missing, not experience-missing.",
  "Seven years senior with direct migration ownership maps cleanly onto the role’s “own our platform evolution” mandate.",
  "Mentoring and code-review ownership match the team-growth emphasis; cross-team collaboration is present but under-written.",
  "Your last three years trend toward platform and infrastructure work — the natural next step this role describes.",
];

const DEMO_VIEW: FitView = {
  header: "Senior Platform Engineer — Nordpeak Systems",
  overall: 84,
  verdict: "Strong fit",
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
    why: DEMO_WHY[i],
  })),
  keywords: [
    { term: "Distributed systems", inResume: true },
    { term: "Node.js at scale", inResume: true },
    { term: "Kubernetes", inResume: true },
    { term: "AWS/GCP", inResume: true },
    { term: "Mentoring", inResume: true },
    { term: "Observability", inResume: false },
    { term: "Reliability / SLOs", inResume: false },
  ],
  recommendReview: false,
};

function toView(result: ApplyResult): FitView {
  const fit = result.fit;
  const company = (result.company || "").trim();
  const hasCompany = company.length > 0 && !/^(unknown|n\/?a|none)$/i.test(company);
  return {
    header: hasCompany ? `${result.role} — ${company}` : result.role,
    overall: fit.overall,
    verdict: fit.verdict,
    verdictPill: `${fit.overall} — ${fit.verdict}`,
    summary: fit.summary,
    locationPass: fit.locationPass,
    locationNote: fit.locationNote,
    dims: fit.dimensions.map((d) => ({
      label: d.label,
      score: d.score,
      plus: d.matched,
      gaps: d.gaps,
      why: d.why,
    })),
    keywords: fit.keywords ?? [],
    recommendReview: fit.recommendReview,
  };
}

const STEP_LABELS = ["Your resume", "Job Score", "Agent audit"];

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

// Count a number up from 0 → target (easeOutCubic) when `run` flips true.
function useCountUp(target: number, run: boolean, ms = 700) {
  const [n, setN] = useState(0);
  useEffect(() => {
    if (!run || !target) return;
    let raf = 0;
    const start = performance.now();
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / ms);
      setN(Math.round(target * (1 - Math.pow(1 - p, 3))));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, run, ms]);
  return run ? n : 0;
}

// Per-dimension band → tag + colors. Frontend-owned (per the design's data
// contract): ≥85 "Strong" (mint) | ≥78 "Solid" (blue) | else "Focus area"
// (faded blue). Drives the bar color, the status pill, and the legend dots.
type Band = { tag: string; bar: string; pillBg: string; pillInk: string };
function band(score: number): Band {
  if (score >= 85)
    return { tag: "Strong", bar: "var(--tm-mint-600)", pillBg: "var(--tm-mint-50)", pillInk: "var(--tm-mint-600)" };
  if (score >= 78)
    return { tag: "Solid", bar: "var(--tm-blue-600)", pillBg: "var(--tm-blue-50)", pillInk: "var(--tm-blue-800)" };
  return { tag: "Focus area", bar: "#9db8ec", pillBg: "#eef2fb", pillInk: "var(--tm-zinc)" };
}

// Overall-score → hero headline + ring color. Uses the engine's overall tier so
// the headline matches the number beside it.
function heroHeadline(overall: number): string {
  if (overall >= 85) return "You’re a strong match for this role";
  if (overall >= 70) return "You’re a good match for this role";
  if (overall >= 55) return "You’re a moderate match for this role";
  return "This role is a stretch — here’s where to focus";
}
function ringColor(overall: number): string {
  return overall >= 85
    ? "var(--tm-mint-600)"
    : overall >= 70
      ? "var(--tm-blue-600)"
      : "#9db8ec";
}

// The score ring — the hero of the Job Score step. Animates the stroke + the
// number up from zero once `run` flips true.
function ScoreRing({ score, run }: { score: number; run: boolean }) {
  const n = useCountUp(score, run, 900);
  const R = 34;
  const C = 2 * Math.PI * R; // 213.6
  const offset = C * (1 - (run ? score : 0) / 100);
  return (
    <div style={{ position: "relative", width: "108px", height: "108px", flex: "none" }}>
      <svg width="108" height="108" viewBox="0 0 80 80" aria-hidden="true">
        <circle cx="40" cy="40" r={R} fill="none" stroke="rgba(24,24,27,0.10)" strokeWidth="6" />
        <circle
          cx="40"
          cy="40"
          r={R}
          fill="none"
          stroke={ringColor(score)}
          strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray={C}
          strokeDashoffset={offset}
          transform="rotate(-90 40 40)"
          style={{ transition: "stroke-dashoffset .9s cubic-bezier(.22,1,.36,1)" }}
        />
      </svg>
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <span style={{ fontSize: "30px", fontWeight: 700, color: "var(--tm-ink)", lineHeight: 1 }}>
          {n}
        </span>
        <span style={{ fontSize: "11px", color: "var(--tm-zinc)", marginTop: "1px" }}>/ 100</span>
      </div>
    </div>
  );
}

// Fade + slide a block in when `show` becomes true.
function Reveal({
  show,
  children,
  style,
}: {
  show: boolean;
  children: React.ReactNode;
  style?: React.CSSProperties;
}) {
  return (
    <div
      style={{
        opacity: show ? 1 : 0,
        transform: show ? "none" : "translateY(8px)",
        transition: "opacity .5s ease, transform .5s ease",
        ...style,
      }}
    >
      {children}
    </div>
  );
}

function StatCard({
  icon,
  value,
  label,
}: {
  icon: React.ReactNode;
  value: number;
  label: string;
}) {
  return (
    <div style={{ background: "var(--tm-blue-50)", borderRadius: "10px", padding: "12px 14px" }}>
      <span
        style={{ display: "flex", alignItems: "center", color: "var(--tm-blue-800)" }}
        aria-hidden="true"
      >
        {icon}
      </span>
      <div style={{ fontSize: "22px", fontWeight: 500, marginTop: "4px", color: "var(--tm-ink)" }}>
        {value}
      </div>
      <div className="tm-small" style={{ fontSize: "11.5px" }}>
        {label}
      </div>
    </div>
  );
}

// Collapsible "give me the why" drill-down. General info stays up top; the
// reasoning + fix open only when the user asks for it.
function DeepDive({
  label = "Why this matters & how we fix it",
  children,
}: {
  label?: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ marginTop: "10px" }}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: "6px",
          background: "none",
          border: "none",
          cursor: "pointer",
          padding: 0,
          font: "inherit",
          fontSize: "12.5px",
          fontWeight: 500,
          color: "var(--tm-blue-600)",
        }}
      >
        <ChevronDown
          size={14}
          style={{ transform: open ? "rotate(180deg)" : "none", transition: "transform .2s" }}
        />
        {open ? "Hide the details" : label}
      </button>
      {open && <div style={{ marginTop: "10px" }}>{children}</div>}
    </div>
  );
}

const SEV_COLOR: Record<ProofPoint["severity"], string> = {
  high: "#b3261e",
  medium: "#ba7517",
  low: "var(--tm-zinc)",
};

// Friendly labels for the faithfulness-verification corrections (trust signal).
const VERIFY_LABELS: Record<
  "fabricated" | "misattributed" | "skill-conflation" | "inflated-scope",
  string
> = {
  fabricated: "unsupported",
  misattributed: "misattributed",
  "skill-conflation": "skill mismatch",
  "inflated-scope": "overstated",
};

// A single proof point: headline + summary up front, the verbatim resume quote
// as proof it's real, and an optional deep-dive into why + the fix.
function ProofPointCard({ p }: { p: ProofPoint }) {
  return (
    <div
      style={{
        border: "0.5px solid var(--tm-border)",
        borderRadius: "12px",
        padding: "16px 18px",
        background: "#fff",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "9px" }}>
        <span
          style={{
            height: "8px",
            width: "8px",
            borderRadius: "50%",
            flex: "none",
            background: SEV_COLOR[p.severity],
          }}
          aria-hidden="true"
        />
        <b style={{ fontSize: "14px", color: "var(--tm-ink)" }}>{p.title}</b>
        <span
          className="tm-pill tm-pill--gray"
          style={{ marginLeft: "auto", fontSize: "10.5px", textTransform: "capitalize" }}
        >
          {p.severity}
        </span>
      </div>
      {p.summary && (
        <p className="tm-small" style={{ marginTop: "6px", fontSize: "13px", color: "var(--tm-ink)", lineHeight: 1.5 }}>
          {p.summary}
        </p>
      )}
      {p.quote && (
        <div
          style={{
            margin: "12px 0 0",
            padding: "10px 12px",
            borderLeft: "2.5px solid var(--tm-blue-600)",
            background: "var(--tm-blue-50)",
            borderRadius: "0 8px 8px 0",
          }}
        >
          <span
            style={{
              display: "flex",
              alignItems: "center",
              gap: "6px",
              color: "var(--tm-blue-800)",
              fontSize: "10.5px",
              fontWeight: 600,
              textTransform: "uppercase",
              letterSpacing: ".05em",
            }}
          >
            <Quote size={11} /> from your resume
          </span>
          <span
            style={{
              display: "block",
              marginTop: "5px",
              fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
              fontSize: "12px",
              lineHeight: 1.55,
              color: "var(--tm-ink)",
              whiteSpace: "pre-wrap",
            }}
          >
            {p.quote}
          </span>
        </div>
      )}
      <DeepDive>
        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          <div>
            <p
              style={{
                fontSize: "11px",
                fontWeight: 600,
                color: "var(--tm-zinc)",
                textTransform: "uppercase",
                letterSpacing: ".04em",
              }}
            >
              Why it matters
            </p>
            <p className="tm-small" style={{ marginTop: "3px", fontSize: "13px", color: "var(--tm-ink)", lineHeight: 1.5 }}>
              {p.why}
            </p>
          </div>
          {p.fix && (
            <div>
              <p
                style={{
                  fontSize: "11px",
                  fontWeight: 600,
                  color: "var(--tm-mint-600)",
                  textTransform: "uppercase",
                  letterSpacing: ".04em",
                }}
              >
                How we fix it
              </p>
              <p className="tm-small" style={{ marginTop: "3px", fontSize: "13px", color: "var(--tm-ink)", lineHeight: 1.5 }}>
                {p.fix}
              </p>
            </div>
          )}
        </div>
      </DeepDive>
    </div>
  );
}

// Sample profile (shown for the "Try with the sample resume" path).
const SAMPLE_PROFILE: ResumeStats = {
  name: "Alex Mercer",
  primaryRole: "Software Engineer",
  yearsExperience: 7,
  roles: 2,
  bullets: 14,
  metricBullets: 3,
  skills: [
    "React", "Node.js", "TypeScript", "Kubernetes", "PostgreSQL", "AWS",
    "Docker", "GraphQL", "Observability", "CI/CD", "Mentoring",
  ],
  sampleBullets: [
    { text: "Responsible for developing and maintaining features for the web app using React and Node.js.", hasMetric: false },
    { text: "Worked on bug fixes and performance improvements across the platform.", hasMetric: false },
    { text: "Led migration of checkout to a distributed Node.js service, cutting p95 latency 38%.", hasMetric: true },
    { text: "Mentored 6 engineers through promotion cycles.", hasMetric: true },
    { text: "Participated in code reviews and sprint planning.", hasMetric: false },
  ],
  weaknesses: [
    "Only 3 of 14 bullets quantify impact — recruiters skim for numbers.",
    "Strong platform work is buried under a generic “Software Engineer” heading.",
    "No summary tuned to the role you’re targeting.",
  ],
  proofPoints: [
    {
      title: "Impact is described, not quantified",
      summary:
        "Your strongest bullet states activity but no result — recruiters skim for numbers first.",
      quote:
        "Responsible for developing and maintaining features for the web app using React and Node.js.",
      why: "An ATS and a recruiter scanning for ~6 seconds both look for outcomes. “Responsible for…” reads as a job description, not an achievement, so a strong engineer looks average on paper.",
      fix: "We rewrite it around the result using numbers already in your history — e.g. the checkout migration that cut p95 latency 38% across 2.4M daily transactions.",
      severity: "high",
    },
    {
      title: "A generic title buries your platform work",
      summary: "Your headline is the first thing matched against the role — and it’s too broad.",
      quote: "Software Engineer",
      why: "The headline is the highest-weight keyword line on the page. A generic “Software Engineer” under-ranks you for the platform role you’re targeting.",
      fix: "We align the headline to the target role where your experience genuinely supports it, surfacing the platform work that’s currently hidden in your bullets.",
      severity: "medium",
    },
    {
      title: "No summary tuned to this role",
      summary: "There’s no 1–2 line summary telling this employer why you fit.",
      quote: "Participated in code reviews and sprint planning.",
      why: "Without a tailored summary the reader infers your fit from scattered bullets — and filler lines like this one spend space a positioning statement should own.",
      fix: "We add a tight, role-specific summary and cut low-signal lines so the top third of the page sells your strongest match.",
      severity: "medium",
    },
  ],
};

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
  // Both the sample path AND a real upload restore to "done" — the sample carries
  // no stats, so it must key off fromSample, not just stats.
  const [phase, setPhase] = useState<"idle" | "parsing" | "done">(() => {
    const hasStats =
      !!stats && (stats.roles > 0 || stats.bullets > 0 || (stats.skills?.length ?? 0) > 0);
    return fromSample || hasStats ? "done" : "idle";
  });
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<SavedResume | null>(null);
  // If we mount already-done (returned from a later step), show the profile fully
  // at once; only a fresh parse plays the staged reveal.
  const initialPhase = useRef(phase);
  const [reveal, setReveal] = useState(phase === "done" ? 5 : 0);
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
  const profile = showSample ? SAMPLE_PROFILE : stats;

  // Staged "filling in" reveal once parsing is done (role → bullets → counts →
  // skills → the case). Count-ups run at stage 3.
  const yearsN = useCountUp(profile?.yearsExperience ?? 0, reveal >= 3);
  const rolesN = useCountUp(profile?.roles ?? 0, reveal >= 3);
  const bulletsN = useCountUp(profile?.bullets ?? 0, reveal >= 3);
  const metricsN = useCountUp(profile?.metricBullets ?? 0, reveal >= 3);
  useEffect(() => {
    if (phase !== "done") return;
    // Returned from a later step → already revealed; don't replay the 3s stagger.
    if (initialPhase.current === "done") {
      setReveal(5);
      return;
    }
    const t = [120, 650, 1500, 2200, 2900].map((ms, i) =>
      setTimeout(() => setReveal(i + 1), ms),
    );
    return () => t.forEach(clearTimeout);
  }, [phase]);

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
      {done && profile && (
        <div className="tmF-profile2">
          <Reveal show={reveal >= 1}>
            <div className="tmF-profile2-id">
              <div
                className="flex h-[64px] w-[64px] flex-none items-center justify-center rounded-full bg-[var(--tm-blue-50)] text-[var(--tm-blue-800)]"
                aria-hidden="true"
              >
                <User size={26} strokeWidth={1.6} />
              </div>
              <div>
                <b>{profile.name || "Your resume"}</b>
                <span className="tm-small mt-[2px] block">
                  {profile.primaryRole
                    ? profile.primaryRole +
                      (profile.yearsExperience ? ` · ${profile.yearsExperience} yrs` : "") +
                      (showSample ? " · sample profile" : "")
                    : "parsed from your upload"}
                </span>
              </div>
              <span className="tm-pill tm-pill--mint ml-auto">
                <Check size={12} /> parsed
              </span>
            </div>
          </Reveal>

          {profile.sampleBullets && profile.sampleBullets.length > 0 && (
            <Reveal show={reveal >= 2} style={{ marginTop: "18px" }}>
              <p className="tmF-p2-label">Experience we found</p>
              <div style={{ display: "flex", flexDirection: "column", gap: "9px", marginTop: "8px" }}>
                {profile.sampleBullets.map((b, i) => (
                  <div
                    key={i}
                    style={{
                      display: "flex",
                      gap: "10px",
                      alignItems: "flex-start",
                      fontSize: "13px",
                      lineHeight: 1.45,
                      opacity: reveal >= 2 ? 1 : 0,
                      transform: reveal >= 2 ? "none" : "translateY(6px)",
                      transition: "opacity .45s ease, transform .45s ease",
                      transitionDelay: `${i * 180}ms`,
                    }}
                  >
                    <span
                      aria-hidden="true"
                      style={{
                        marginTop: "7px",
                        flex: "none",
                        height: "5px",
                        width: "5px",
                        borderRadius: "50%",
                        background: b.hasMetric ? "var(--tm-mint-600)" : "var(--tm-zinc)",
                      }}
                    />
                    <span style={{ color: "var(--tm-ink)" }}>
                      {b.text}
                      {b.hasMetric && (
                        <span
                          className="tm-pill tm-pill--mint"
                          style={{ marginLeft: "8px", fontSize: "10.5px", verticalAlign: "1px" }}
                        >
                          metric
                        </span>
                      )}
                    </span>
                  </div>
                ))}
              </div>
            </Reveal>
          )}

          <Reveal show={reveal >= 3} style={{ marginTop: "20px" }}>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(118px, 1fr))",
                gap: "10px",
              }}
            >
              <StatCard icon={<Calendar size={15} />} value={yearsN} label="years experience" />
              <StatCard icon={<Briefcase size={15} />} value={rolesN} label={rolesN === 1 ? "role" : "roles"} />
              <StatCard icon={<List size={15} />} value={bulletsN} label="experience bullets" />
              <StatCard icon={<TrendingUp size={15} />} value={metricsN} label="quantified" />
            </div>
          </Reveal>

          {profile.skills && profile.skills.length > 0 && (
            <Reveal show={reveal >= 4} style={{ marginTop: "20px" }}>
              <p className="tmF-p2-label">
                Skills found <span className="tmF-p2-count">{profile.skills.length}</span>
              </p>
              <div className="tmF-chips" style={{ marginTop: "6px" }}>
                {profile.skills.slice(0, 14).map((s, i) => (
                  <span
                    key={`${s}-${i}`}
                    className="tm-pill tm-pill--gray"
                    style={{
                      opacity: reveal >= 4 ? 1 : 0,
                      transform: reveal >= 4 ? "none" : "scale(.9)",
                      transition: "opacity .35s ease, transform .35s ease",
                      transitionDelay: `${i * 55}ms`,
                    }}
                  >
                    {s}
                  </span>
                ))}
                {profile.skills.length > 14 && (
                  <span className="tm-pill tm-pill--line">+{profile.skills.length - 14} more</span>
                )}
              </div>
            </Reveal>
          )}

          {(profile.proofPoints?.length || profile.weaknesses?.length) ? (
            <Reveal show={reveal >= 5} style={{ marginTop: "20px" }}>
              <p
                className="tmF-p2-label"
                style={{ display: "flex", alignItems: "center", gap: "8px" }}
              >
                <AlertTriangle size={14} style={{ color: "#ba7517" }} /> What tailoring will
                fix
              </p>
              <p className="tm-small" style={{ marginTop: "4px", fontSize: "12.5px" }}>
                Each point quotes your actual resume — open one for the why and the fix.
              </p>
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "10px",
                  marginTop: "10px",
                }}
              >
                {profile.proofPoints && profile.proofPoints.length > 0
                  ? profile.proofPoints.map((p, i) => <ProofPointCard key={i} p={p} />)
                  : profile.weaknesses!.map((wk, i) => (
                      <div
                        key={i}
                        style={{
                          border: "0.5px solid var(--tm-border)",
                          borderRadius: "12px",
                          padding: "14px 16px",
                          fontSize: "13px",
                          lineHeight: 1.5,
                          color: "var(--tm-ink)",
                          display: "flex",
                          gap: "8px",
                        }}
                      >
                        <span style={{ color: "#ba7517", flex: "none" }}>•</span> {wk}
                      </div>
                    ))}
              </div>
            </Reveal>
          ) : null}

          <Reveal show={reveal >= 5} style={{ marginTop: "22px" }}>
            <div
              className="tmF-profile2-foot"
              style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "10px" }}
            >
              <button type="button" className="tm-btn tm-btn--primary" onClick={onNext}>
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
          </Reveal>
        </div>
      )}
    </div>
  );
}

// ---------- Step 2: posting + fit score ----------

// A readable label for the target the user actually entered (never a default).
// Returns a specific role title we can confidently show, or "" when the role is
// not yet known (a bare URL, or a posting whose first line isn't a clean title).
// Empty means "still gathering" — the loader shows that state rather than a
// misleading placeholder like "this role".
function deriveTargetLabel(input: string): string {
  const t = (input || "").trim();
  if (!t) return "";
  if (/^https?:\/\//i.test(t)) return ""; // a URL — role unknown until research returns
  const firstLine = t.split(/\r?\n/)[0].trim();
  // Short, single-line input → treat the whole thing as a role title.
  if (t.length <= 90 && !/[.]\s/.test(t)) {
    return firstLine.split(/\s+[—–-]\s+/)[0].trim() || firstLine;
  }
  // Full posting → use the first line only if it reads like a title, else unknown.
  return firstLine.length >= 3 && firstLine.length <= 70 ? firstLine : "";
}

const STATUS_MESSAGES = (target: string) => [
  "Reading your resume…",
  "Identifying your experience and skills…",
  target ? `Researching the ${target} role…` : "Researching the role from the posting…",
  target ? `Comparing your resume to ${target}…` : "Comparing your resume to the role…",
  "Checking for missing keywords and experience gaps…",
  "Preparing your fit analysis…",
];

// "What this kind of role needs" — shown during loading from the fast role call.
function RolePreview({ ctx }: { ctx: RoleContext }) {
  return (
    <div
      style={{
        marginTop: "18px",
        border: "0.5px solid var(--tm-border)",
        borderRadius: "12px",
        padding: "16px 18px",
        background: "var(--tm-blue-50)",
      }}
    >
      <p className="tmF-p2-label" style={{ display: "flex", alignItems: "center", gap: "8px" }}>
        <Sparkles size={13} /> What a {ctx.role} typically needs
        {ctx.seniority && (
          <span className="tm-pill tm-pill--gray" style={{ marginLeft: "auto", fontSize: "10.5px" }}>
            {ctx.seniority}
          </span>
        )}
      </p>
      <p className="tm-small" style={{ marginTop: "4px", fontSize: "12px" }}>
        General context for this kind of role — we’re comparing your resume against it now.
      </p>
      {ctx.responsibilities.length > 0 && (
        <ul style={{ marginTop: "10px", display: "flex", flexDirection: "column", gap: "5px" }}>
          {ctx.responsibilities.slice(0, 4).map((r, i) => (
            <li
              key={i}
              style={{ fontSize: "12.5px", lineHeight: 1.45, color: "var(--tm-ink)", display: "flex", gap: "8px" }}
            >
              <span style={{ color: "var(--tm-blue-600)", flex: "none" }}>•</span> {r}
            </li>
          ))}
        </ul>
      )}
      {ctx.typicalSkills.length > 0 && (
        <div className="tmF-chips" style={{ marginTop: "10px" }}>
          {ctx.typicalSkills.slice(0, 10).map((s, i) => (
            <span key={`${s}-${i}`} className="tm-pill tm-pill--gray">
              {s}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

// The parsing/loading screen: status animation + the user's real target + the
// fast role-context preview. Never shows a default company/role.
function ScoringLoader({
  displayTarget,
  roleCtx,
  statusIdx,
}: {
  displayTarget: string;
  roleCtx: RoleContext | null;
  statusIdx: number;
}) {
  const steps = STATUS_MESSAGES(displayTarget);
  return (
    <div className="tm-card tmF-anim" style={{ marginTop: "24px", padding: "24px" }}>
      <style>{`@keyframes tmspin{to{transform:rotate(360deg)}}@keyframes tmpulse{0%,100%{opacity:.45}50%{opacity:1}}`}</style>
      <div style={{ display: "flex", alignItems: "center", gap: "13px" }}>
        <span
          aria-hidden="true"
          style={{
            height: "26px",
            width: "26px",
            flex: "none",
            borderRadius: "50%",
            border: "2.5px solid var(--tm-blue-50)",
            borderTopColor: "var(--tm-blue-600)",
            animation: "tmspin .8s linear infinite",
          }}
        />
        <div>
          <b style={{ fontSize: "15px", color: "var(--tm-ink)" }}>
            {displayTarget ? `Analyzing your fit for ${displayTarget}` : "Analyzing your fit"}
          </b>
          <p className="tm-small" style={{ fontSize: "12.5px", marginTop: "1px" }}>
            {displayTarget
              ? "Hang tight — this takes a few seconds."
              : "Reading the posting to identify the role…"}
          </p>
        </div>
      </div>
      <div style={{ marginTop: "18px", display: "flex", flexDirection: "column", gap: "9px" }}>
        {steps.map((s, i) => {
          const done = i < statusIdx;
          const active = i === statusIdx;
          return (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <span
                aria-hidden="true"
                style={{
                  height: "16px",
                  width: "16px",
                  flex: "none",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: done ? "var(--tm-mint-600)" : "var(--tm-blue-600)",
                }}
              >
                {done ? (
                  <Check size={14} />
                ) : active ? (
                  <span
                    style={{
                      height: "11px",
                      width: "11px",
                      borderRadius: "50%",
                      border: "2px solid var(--tm-blue-50)",
                      borderTopColor: "var(--tm-blue-600)",
                      animation: "tmspin .7s linear infinite",
                    }}
                  />
                ) : (
                  <span style={{ height: "5px", width: "5px", borderRadius: "50%", background: "var(--tm-border)" }} />
                )}
              </span>
              <span
                style={{
                  fontSize: "13px",
                  color: done ? "var(--tm-zinc)" : active ? "var(--tm-ink)" : "var(--tm-zinc)",
                  fontWeight: active ? 500 : 400,
                  opacity: i > statusIdx ? 0.6 : 1,
                  animation: active ? "tmpulse 1.4s ease-in-out infinite" : "none",
                }}
              >
                {s}
              </span>
            </div>
          );
        })}
      </div>
      {roleCtx ? (
        <RolePreview ctx={roleCtx} />
      ) : (
        <p className="tm-small" style={{ marginTop: "16px", fontSize: "12px", animation: "tmpulse 1.4s ease-in-out infinite" }}>
          Researching what this role generally requires…
        </p>
      )}
    </div>
  );
}

// Honest, conversion-friendly nudge toward a manual expert review on weak fit.
function ManualReviewCTA({ overall }: { overall: number }) {
  const line =
    overall >= 60
      ? "Your resume shows relevant experience, but there are notable gaps for this role."
      : overall >= 45
        ? "This role may be a stretch based on your current resume — the gaps below are real, but fixable."
        : "Based on this resume, this role looks like a significant stretch right now.";
  return (
    <div
      style={{
        marginTop: "16px",
        border: "0.5px solid rgba(67,115,219,.3)",
        background: "var(--tm-blue-50)",
        borderRadius: "12px",
        padding: "16px 18px",
      }}
    >
      <p style={{ fontSize: "13.5px", fontWeight: 500, color: "var(--tm-ink)", lineHeight: 1.5 }}>
        {line}
      </p>
      <p className="tm-small" style={{ marginTop: "6px", fontSize: "12.5px", lineHeight: 1.5 }}>
        A manual review by a Res.Me expert can reposition your background more effectively for
        this kind of role — or tell you honestly which targets fit best. We won’t overpromise.
      </p>
      <Link
        href={ROUTES.coaching}
        className="tm-btn tm-btn--outline"
        style={{ marginTop: "12px" }}
      >
        <PenLine size={15} /> Get an expert review
      </Link>
    </div>
  );
}

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
  const [shown, setShown] = useState(false); // triggers the ring + bar fill animation
  const [why, setWhy] = useState(-1); // index of the expanded dimension (-1 = none)
  const [note, setNote] = useState<string | null>(null);
  const [fetching, setFetching] = useState(false);
  const [fetchErr, setFetchErr] = useState<string | null>(null);
  const [fetchNote, setFetchNote] = useState<string | null>(null);
  const [wasUrl, setWasUrl] = useState(false); // posting came from a pasted link
  const [demoScore, setDemoScore] = useState(false);
  const [roleCtx, setRoleCtx] = useState<RoleContext | null>(null);
  const [targetLabel, setTargetLabel] = useState("");
  const [statusIdx, setStatusIdx] = useState(0);

  // Advance the loading status messages while scoring (stops at the last step).
  useEffect(() => {
    if (phase !== "scoring") return;
    const id = setInterval(() => {
      setStatusIdx((i) => Math.min(i + 1, STATUS_MESSAGES("").length - 1));
    }, 1100);
    return () => clearInterval(id);
  }, [phase]);

  // score() schedules trailing timers and awaits network calls. If the user
  // edits the posting (which resets to idle) or navigates away mid-score, those
  // must be cancelled — otherwise a stale timer yanks the wizard back to the old
  // fit view, or state writes land on an unmounted component. scoreRun bumps to
  // invalidate any in-flight score(); scoreTimers holds the pending timeouts.
  const scoreTimers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const scoreRun = useRef(0);
  const cancelScore = () => {
    scoreRun.current += 1;
    scoreTimers.current.forEach(clearTimeout);
    scoreTimers.current = [];
  };
  useEffect(
    () => () => {
      scoreRun.current += 1;
      scoreTimers.current.forEach(clearTimeout);
      scoreTimers.current = [];
    },
    [],
  );

  // When the score lands, ease up to the result so the score hero is in view
  // (rather than leaving the user parked where the loader was). Smooth via the
  // global html{scroll-behavior:smooth}.
  const resultRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (phase === "done") {
      resultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [phase]);

  // Once the role-research returns, prefer its normalized title for the label.
  const displayTarget = roleCtx?.role || targetLabel;

  const score = async () => {
    if (phase !== "idle" || fetching) return;
    const myRun = ++scoreRun.current;
    setFetchErr(null);
    setDemoScore(false);
    let postingForScore = posting.trim();
    const fromUrl = /^https?:\/\//i.test(postingForScore);
    setWasUrl(fromUrl);

    // If they pasted a link, pull the posting text server-side first (SSRF-safe).
    // Gated only on the input being a URL — independent of which resume they use.
    if (fromUrl) {
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

    // Reflect the user's actual target on the loading screen + research it fast.
    setRoleCtx(null);
    setStatusIdx(0);
    setTargetLabel(deriveTargetLabel(postingForScore));
    setPhase("scoring");

    // Fire the lightweight role-research in the background — it returns before
    // the full score and fills the "what this role needs" preview.
    void fetch("/api/role-context", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ target: postingForScore }),
    })
      .then((r) => r.json())
      .then((d) => {
        if (scoreRun.current === myRun && d && d.context) setRoleCtx(d.context as RoleContext);
      })
      .catch(() => {});

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
    // A reset (posting edited) or unmount during the awaits above bumps scoreRun;
    // bail before writing stale state or scheduling timers for an abandoned score.
    if (scoreRun.current !== myRun) return;
    setNote(msg);
    setView(v);
    setWhy(-1);
    setShown(false);
    setPhase("done");
    // Let the done view mount at zero, then flip `shown` to animate the ring
    // stroke + the dimension bars filling to their scores.
    scoreTimers.current.push(setTimeout(() => setShown(true), 80));
  };

  // Hero summary: drop a "Why 84 — strong fit:" lead the model sometimes prefixes
  // (the verdict pill already states the tier), keeping the clean prose.
  const ci = view.summary.indexOf(":");
  const summaryRest = (ci >= 0 ? view.summary.slice(ci + 1) : view.summary).trim();
  // Strengths lead, the one focus area lands last (design: rank by score desc).
  const ranked = [...view.dims].sort((a, b) => b.score - a.score);

  // Editing the posting (or "Change") invalidates a score — return to idle so the
  // user re-scores the text that will actually be tailored, cancelling any pending
  // timers / in-flight call so a stale result can't snap back.
  const resetToIdle = () => {
    cancelScore();
    setPhase("idle");
    setShown(false);
    setWhy(-1);
    setNote(null);
    setFetchNote(null);
    setDemoScore(false);
  };

  const sample =
    "Senior Platform Engineer — Nordpeak Systems (Remote, EU). Own the evolution of our backend platform: lead distributed Node.js services handling millions of daily transactions, set Kubernetes deployment standards across teams, and build observability into everything we ship. Requirements: 5+ years backend at scale; distributed systems and Node.js in production; strong Kubernetes and cloud (AWS/GCP); a track record of reliability and performance wins; mentoring and technical direction. Nice to have: Datadog/Prometheus; owning a platform other teams build on.";

  // ----- idle / scoring: the posting input + loading screen -----
  if (phase !== "done") {
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
        {phase === "scoring" && (
          <ScoringLoader
            displayTarget={displayTarget}
            roleCtx={roleCtx}
            statusIdx={statusIdx}
          />
        )}
      </div>
    );
  }
  // ----- done: the Job Score (the score is the hero) -----
  return (
    <div ref={resultRef} className="tmF-anim" style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
      {/* posting context bar */}
      <div
        className="tm-card"
        style={{ display: "flex", alignItems: "center", gap: "14px", padding: "16px 18px" }}
      >
        <span
          aria-hidden="true"
          style={{
            display: "flex",
            height: "38px",
            width: "38px",
            flex: "none",
            alignItems: "center",
            justifyContent: "center",
            borderRadius: "10px",
            background: "var(--tm-blue-50)",
            color: "var(--tm-blue-800)",
          }}
        >
          <Briefcase size={18} />
        </span>
        <div style={{ minWidth: 0, flex: 1 }}>
          <b
            style={{
              fontSize: "14px",
              color: "var(--tm-ink)",
              display: "block",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {view.header}
          </b>
          <span className="tm-small" style={{ fontSize: "12px" }}>
            {wasUrl ? "Parsed from a job link" : "From the posting you pasted"}
          </span>
        </div>
        <button
          type="button"
          onClick={resetToIdle}
          className="tm-small"
          style={{
            flex: "none",
            color: "var(--tm-blue-600)",
            fontWeight: 500,
            background: "none",
            border: "none",
            cursor: "pointer",
            fontSize: "13px",
          }}
        >
          Change
        </button>
      </div>

      {/* score hero — the score is the hero */}
      <div
        className="tm-card"
        style={{
          background: "var(--tm-mint-50)",
          border: "0.5px solid rgba(33,146,107,.22)",
          display: "flex",
          alignItems: "center",
          gap: "24px",
          flexWrap: "wrap",
          padding: "24px 26px",
        }}
      >
        <ScoreRing score={view.overall} run={shown} />
        <div style={{ flex: "1 1 260px", minWidth: 0 }}>
          <span className="tm-pill tm-pill--mint">
            <Check size={12} /> {view.verdict}
          </span>
          <h3
            style={{
              fontSize: "21px",
              fontWeight: 600,
              color: "var(--tm-ink)",
              margin: "10px 0 0",
              lineHeight: 1.25,
            }}
          >
            {heroHeadline(view.overall)}
          </h3>
          {summaryRest && (
            <p
              className="tm-small"
              style={{ marginTop: "8px", fontSize: "13px", lineHeight: 1.55 }}
            >
              {summaryRest}
            </p>
          )}
        </div>
      </div>

      {/* dimensions — ranked strongest → focus, expand for evidence */}
      <div className="tm-card" style={{ padding: "20px 22px" }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: "8px",
          }}
        >
          <span className="tmF-p2-label">Across the {ranked.length} dimensions</span>
          <span
            className="tm-small"
            style={{ display: "inline-flex", alignItems: "center", gap: "12px", fontSize: "11.5px" }}
          >
            {[
              { c: "var(--tm-mint-600)", l: "strong" },
              { c: "var(--tm-blue-600)", l: "solid" },
              { c: "#9db8ec", l: "focus" },
            ].map((x) => (
              <span key={x.l} style={{ display: "inline-flex", alignItems: "center", gap: "5px" }}>
                <span style={{ height: "8px", width: "8px", borderRadius: "50%", background: x.c }} />
                {x.l}
              </span>
            ))}
          </span>
        </div>

        <div style={{ marginTop: "8px" }}>
          {ranked.map((d, i) => {
            const b = band(d.score);
            const open = why === i;
            return (
              <div
                key={`${i}-${d.label}`}
                style={{ borderTop: i ? "0.5px solid var(--tm-border)" : "none" }}
              >
                <div
                  onClick={() => setWhy(open ? -1 : i)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "12px",
                    padding: "13px 0",
                    cursor: "pointer",
                  }}
                >
                  <label
                    style={{
                      flex: "0 0 128px",
                      fontSize: "13px",
                      fontWeight: 500,
                      color: "var(--tm-ink)",
                      cursor: "pointer",
                    }}
                  >
                    {d.label}
                  </label>
                  <div
                    style={{
                      flex: "1 1 60px",
                      height: "8px",
                      borderRadius: "999px",
                      background: "rgba(24,24,27,0.08)",
                      overflow: "hidden",
                      minWidth: "48px",
                    }}
                  >
                    <div
                      style={{
                        height: "100%",
                        borderRadius: "999px",
                        background: b.bar,
                        width: shown ? `${d.score}%` : "0%",
                        transition: "width .9s cubic-bezier(.22,1,.36,1)",
                        transitionDelay: `${i * 70}ms`,
                      }}
                    />
                  </div>
                  <output
                    style={{
                      width: "26px",
                      textAlign: "right",
                      fontSize: "15px",
                      fontWeight: 600,
                      color: "var(--tm-ink)",
                      fontVariantNumeric: "tabular-nums",
                      flex: "none",
                    }}
                  >
                    {d.score}
                  </output>
                  <span
                    className="tm-pill"
                    style={{
                      flex: "none",
                      fontSize: "10.5px",
                      background: b.pillBg,
                      color: b.pillInk,
                      minWidth: "76px",
                      justifyContent: "center",
                    }}
                  >
                    {b.tag}
                  </span>
                  <span
                    aria-hidden="true"
                    style={{
                      flex: "none",
                      display: "flex",
                      color: "var(--tm-zinc)",
                      transform: open ? "rotate(45deg)" : "none",
                      transition: "transform .2s",
                    }}
                  >
                    <Plus size={15} />
                  </span>
                </div>
                {/* Smooth expand: animate the grid row 0fr→1fr + fade, so the
                    evidence eases open instead of snapping in. */}
                <div
                  style={{
                    display: "grid",
                    gridTemplateRows: open ? "1fr" : "0fr",
                    transition: "grid-template-rows .32s cubic-bezier(.22,1,.36,1)",
                  }}
                >
                  <div style={{ overflow: "hidden", minHeight: 0 }}>
                    <div
                      className="tmF-why"
                      style={{
                        paddingBottom: "12px",
                        opacity: open ? 1 : 0,
                        transition: "opacity .28s ease",
                      }}
                    >
                      {d.why && (
                        <p
                          className="tm-small"
                          style={{ marginBottom: "8px", fontSize: "12.5px", lineHeight: 1.5, color: "var(--tm-ink)" }}
                        >
                          {d.why}
                        </p>
                      )}
                      {d.plus.map((p, pi) => (
                        <p key={`p-${pi}`} className="tmF-why-line is-plus">
                          <Check size={12} /> {p}
                        </p>
                      ))}
                      {d.gaps.map((m, mi) => (
                        <p key={`g-${mi}`} className="tmF-why-line is-minus">
                          <Plus size={12} style={{ transform: "rotate(45deg)" }} /> {m}
                        </p>
                      ))}
                      {d.plus.length === 0 && d.gaps.length === 0 && !d.why && (
                        <p className="tm-small" style={{ fontSize: "12.5px" }}>
                          No detailed evidence for this dimension.
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}

          {/* location gate — a PASS/FAIL pill, never a bar */}
          <div
            style={{
              borderTop: "0.5px solid var(--tm-border)",
              paddingTop: "14px",
              marginTop: "2px",
              display: "flex",
              alignItems: "center",
              gap: "10px",
              flexWrap: "wrap",
            }}
          >
            <label style={{ flex: "0 0 128px", fontSize: "13px", fontWeight: 500, color: "var(--tm-ink)" }}>
              Location &amp; logistics
            </label>
            <span
              className={"tm-pill " + (view.locationPass ? "tm-pill--mint" : "tm-pill--gray")}
              style={{ flex: "none" }}
            >
              <Check size={12} /> {view.locationPass ? "Pass" : "Check"}
            </span>
            <span className="tm-small" style={{ fontSize: "12.5px", flex: "1 1 160px", minWidth: 0 }}>
              {view.locationNote}
            </span>
          </div>
        </div>
      </div>

      {note && (
        <p className="tmS-free" style={{ display: "flex", gap: "10px", alignItems: "center" }}>
          {note} This is a sample result —{" "}
          <Link href={ROUTES.signIn} style={{ color: "var(--tm-mint-600)", textDecoration: "underline" }}>
            create a free account
          </Link>{" "}
          to run your own.
        </p>
      )}
      {demoScore && (
        <p className="tmS-free" style={{ display: "flex", gap: "10px", alignItems: "center" }}>
          Demo mode — this is a sample result, not scored from your resume. Add a provider key to score
          real resumes.
        </p>
      )}
      {view.recommendReview && <ManualReviewCTA overall={view.overall} />}

      {/* footer */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "14px",
          flexWrap: "wrap",
        }}
      >
        <p className="tm-small" style={{ fontSize: "12.5px", margin: 0 }}>
          Open any dimension to see the evidence behind its score.
        </p>
        <button type="button" className="tm-btn tm-btn--primary" onClick={onNext}>
          Run my free audit <ArrowRight size={15} />
        </button>
      </div>
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

// ---------- step 3: the three review agents (Ada / Max / Remy) ----------
const ACCENT: Record<AuditAgent["accent"], { tint: string; ink: string; solid: string }> = {
  blue: { tint: "var(--tm-blue-50)", ink: "var(--tm-blue-800)", solid: "var(--tm-blue-600)" },
  mint: { tint: "#e9f8f1", ink: "#0f7a52", solid: "var(--tm-mint-600)" },
  navy: { tint: "#eef1f7", ink: "#2a4c99", solid: "#2a4c99" },
};

const RANK_STATUS: Record<
  NonNullable<AuditAgent["lines"]>[number]["status"],
  { label: string; color: string; bg: string; strike?: boolean }
> = {
  "kept-top": { label: "Kept · top", color: "#0f7a52", bg: "#e9f8f1" },
  kept: { label: "Kept", color: "#0f7a52", bg: "#e9f8f1" },
  trimmed: { label: "Trimmed", color: "#854f0b", bg: "#fdf3e7" },
  cut: { label: "Cut", color: "var(--tm-zinc)", bg: "var(--tm-blue-50)", strike: true },
};

function CoverageEvidence({ a }: { a: AuditAgent }) {
  const kws = a.keywords ?? [];
  return (
    <div>
      <p style={{ fontSize: "13px", color: "var(--tm-ink)" }}>
        <b>{a.matched}</b> / {a.total} keywords matched
      </p>
      <div className="tmF-chips" style={{ marginTop: "10px" }}>
        {kws.map((k, i) => (
          <span
            key={`${i}-${k.name}`}
            className={"tm-pill " + (k.matched ? "tm-pill--mint" : "tm-pill--gray")}
          >
            {k.matched ? (
              <Check size={11} />
            ) : (
              <Plus size={11} style={{ transform: "rotate(45deg)" }} />
            )}{" "}
            {k.name}
            <span style={{ marginLeft: "6px", opacity: 0.6, fontVariantNumeric: "tabular-nums" }}>
              {k.count}
            </span>
          </span>
        ))}
      </div>
    </div>
  );
}

function ImpactEvidence({ a }: { a: AuditAgent }) {
  return (
    <div>
      {(a.before || a.after) && (
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          {a.before && (
            <div
              style={{
                borderRadius: "10px",
                border: "0.5px solid var(--tm-border)",
                padding: "10px 12px",
                background: "#fff",
              }}
            >
              <span
                style={{ fontSize: "10px", fontWeight: 600, letterSpacing: ".06em", color: "var(--tm-zinc)" }}
              >
                BEFORE
              </span>
              <p style={{ marginTop: "3px", fontSize: "13px", color: "var(--tm-zinc)", lineHeight: 1.5 }}>
                {a.before}
              </p>
            </div>
          )}
          {a.after && (
            <div
              style={{
                borderRadius: "10px",
                border: "0.5px solid rgba(45,189,139,.4)",
                padding: "10px 12px",
                background: "#e9f8f1",
              }}
            >
              <span
                style={{ fontSize: "10px", fontWeight: 600, letterSpacing: ".06em", color: "#0f7a52" }}
              >
                AFTER
              </span>
              <p style={{ marginTop: "3px", fontSize: "13px", color: "var(--tm-ink)", lineHeight: 1.5 }}>
                {a.after}
              </p>
            </div>
          )}
        </div>
      )}
      {a.stats && a.stats.length > 0 && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(92px, 1fr))",
            gap: "8px",
            marginTop: "12px",
          }}
        >
          {a.stats.map((s, i) => (
            <div key={i} style={{ borderRadius: "10px", background: ACCENT[s.accent].tint, padding: "10px 12px" }}>
              <div style={{ fontSize: "18px", fontWeight: 600, color: ACCENT[s.accent].ink }}>
                {s.value}
              </div>
              <div className="tm-small" style={{ fontSize: "11px", marginTop: "2px" }}>
                {s.label}
              </div>
            </div>
          ))}
        </div>
      )}
      {!a.before && !a.after && !(a.stats && a.stats.length > 0) && (
        <p className="tm-small" style={{ fontSize: "12.5px", lineHeight: 1.5 }}>
          No quantified outcomes found in your resume yet — Max flags the lines that state
          activity without a result, so you know exactly where to add the numbers.
        </p>
      )}
    </div>
  );
}

function RankingEvidence({ a }: { a: AuditAgent }) {
  const lines = a.lines ?? [];
  if (lines.length === 0)
    return (
      <p className="tm-small" style={{ fontSize: "12.5px" }}>
        Line ranking wasn’t available for this run.
      </p>
    );
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "7px" }}>
      {lines.map((l) => {
        const st = RANK_STATUS[l.status];
        return (
          <div key={l.rank} style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <span
              style={{
                width: "16px",
                textAlign: "right",
                fontSize: "11px",
                color: "var(--tm-zinc)",
                fontVariantNumeric: "tabular-nums",
                flex: "none",
              }}
            >
              {l.rank}
            </span>
            <span
              style={{
                flex: 1,
                minWidth: 0,
                fontSize: "13px",
                color: l.status === "cut" ? "var(--tm-zinc)" : "var(--tm-ink)",
                textDecoration: st.strike ? "line-through" : "none",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {l.label}
            </span>
            <span
              style={{ fontSize: "12px", color: "var(--tm-zinc)", fontVariantNumeric: "tabular-nums", flex: "none" }}
            >
              {l.score}
              <span style={{ opacity: 0.5 }}>/100</span>
            </span>
            <span
              className="tm-pill"
              style={{ flex: "none", fontSize: "10.5px", color: st.color, background: st.bg }}
            >
              {st.label}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function AgentCard({ a }: { a: AuditAgent }) {
  const ac = ACCENT[a.accent];
  return (
    <div
      style={{
        border: "0.5px solid var(--tm-border)",
        borderRadius: "14px",
        background: "#fff",
        overflow: "hidden",
        display: "flex",
        flexWrap: "wrap",
      }}
    >
      <div
        style={{
          background: ac.tint,
          padding: "20px",
          flex: "1 1 180px",
          minWidth: "168px",
          maxWidth: "230px",
          borderRight: "0.5px solid var(--tm-border)",
        }}
      >
        <div
          style={{
            height: "44px",
            width: "44px",
            borderRadius: "50%",
            background: "#fff",
            border: "0.5px solid var(--tm-border)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: "17px",
            fontWeight: 600,
            color: ac.ink,
          }}
          aria-hidden="true"
        >
          {a.persona.charAt(0)}
        </div>
        <div style={{ marginTop: "12px" }}>
          <b style={{ fontSize: "15px", color: "var(--tm-ink)" }}>{a.persona}</b>
          <div style={{ fontSize: "12.5px", color: ac.ink, fontWeight: 500 }}>{a.archetype}</div>
        </div>
        <span
          className="tm-pill"
          style={{
            marginTop: "10px",
            fontSize: "10.5px",
            color: ac.ink,
            background: "#fff",
            border: "0.5px solid var(--tm-border)",
          }}
        >
          {a.specialty}
        </span>
        <p className="tm-small" style={{ marginTop: "12px", fontSize: "12px", lineHeight: 1.45, fontStyle: "italic" }}>
          {a.reads}
        </p>
      </div>
      <div style={{ padding: "20px", flex: "3 1 300px", minWidth: "240px" }}>
        <div style={{ display: "flex", alignItems: "flex-start", gap: "10px" }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <b style={{ fontSize: "14px", color: "var(--tm-ink)" }}>{a.title}</b>
            <p className="tm-small" style={{ fontSize: "12px", marginTop: "1px" }}>{a.subtitle}</p>
          </div>
          {a.chip && (
            <span className="tm-pill tm-pill--gray" style={{ flex: "none", fontSize: "10.5px" }}>
              {a.chip}
            </span>
          )}
        </div>
        <div style={{ marginTop: "14px" }}>
          {a.kind === "coverage" && <CoverageEvidence a={a} />}
          {a.kind === "impact" && <ImpactEvidence a={a} />}
          {a.kind === "ranking" && <RankingEvidence a={a} />}
        </div>
        <p className="tm-small" style={{ marginTop: "14px", fontSize: "12px", color: ac.ink }}>
          {a.footer}
        </p>
        <DeepDive label={`How ${a.persona} read it`}>
          <p className="tm-small" style={{ fontSize: "13px", lineHeight: 1.55, color: "var(--tm-ink)" }}>
            {a.detail}
          </p>
        </DeepDive>
      </div>
    </div>
  );
}

function AgentAudit({ agents, sample }: { agents: AuditAgent[]; sample?: boolean }) {
  if (!agents || agents.length === 0) return null;
  return (
    <div className="tm-card" style={{ padding: "22px 24px" }}>
      <span className="tmB-ev-head">
        <Sparkles size={14} /> Reviewed by three specialist agents
      </span>
      <p className="tm-small" style={{ fontSize: "12.5px", marginTop: "-2px" }}>
        Each reads your draft as a different gatekeeper — the ATS parser, the recruiter
        skimming for numbers, and the hiring manager{sample ? " (sample below)" : ""}. Open
        “How … read it” on any card for the reasoning.
      </p>
      <div style={{ display: "flex", flexDirection: "column", gap: "14px", marginTop: "16px" }}>
        {agents.map((a) => (
          <AgentCard key={a.id} a={a} />
        ))}
      </div>
    </div>
  );
}

// Demo agents for the signed-out preview (matches the design's worked example).
const DEMO_AGENTS: AuditAgent[] = [
  {
    id: "ats",
    persona: "Ada",
    archetype: "The Parser",
    specialty: "ATS & keywords",
    accent: "blue",
    reads: "Reads it the way the tracking system does",
    kind: "coverage",
    title: "Keyword coverage",
    subtitle: "exact strings the posting wants",
    footer: "2 missing — Ada shows the exact bullet to add them to.",
    detail:
      "Ada matches every keyword the posting screens for against your resume text, counting exact occurrences. The missing ones are the highest-risk gaps for an automated filter — tailoring adds them only where your experience backs them up.",
    matched: 6,
    total: 8,
    keywords: [
      { name: "Kubernetes", matched: true, count: "×2" },
      { name: "Observability", matched: false, count: "0×" },
      { name: "Node.js", matched: true, count: "×3" },
      { name: "Mentorship", matched: false, count: "0×" },
      { name: "Distributed systems", matched: true, count: "×1" },
      { name: "Terraform", matched: true, count: "×1" },
      { name: "CI/CD pipelines", matched: true, count: "×1" },
      { name: "PostgreSQL", matched: true, count: "×2" },
    ],
  },
  {
    id: "impact",
    persona: "Max",
    archetype: "The Quantifier",
    specialty: "Impact & metrics",
    accent: "mint",
    reads: "Reads every line looking for a number",
    kind: "impact",
    title: "Impact found",
    subtitle: "how many, how much, vs. what",
    footer: "4 vague lines → 4 quantified, defensible wins.",
    detail:
      "Max scans every line for a quantifiable outcome and rewrites activity into results — using only numbers already in your resume. It never invents a figure.",
    before: "Improved checkout performance and mentored the team.",
    after: "Cut p95 latency 38% across 2.4M daily txns; mentored 6 engineers.",
    stats: [
      { value: "38%", label: "lower p95 latency", accent: "blue" },
      { value: "2.4M", label: "daily transactions", accent: "mint" },
      { value: "6", label: "engineers mentored", accent: "blue" },
      { value: "52%", label: "faster deploys", accent: "mint" },
    ],
  },
  {
    id: "rolefit",
    persona: "Remy",
    archetype: "The Hiring Manager",
    specialty: "Role-fit",
    accent: "navy",
    reads: "Reads it the way the person hiring would",
    kind: "ranking",
    title: "Ranked for this role",
    subtitle: "every line scored against the posting · lowest cut to fit 2 pages",
    chip: "Hard limit · 2 pages",
    footer: "Cut by relevance to this role — not by age.",
    detail:
      "Remy scores every line 0–100 for relevance to THIS posting, keeps the strongest, and trims the lowest to hold two pages — by relevance, never by age.",
    lines: [
      { rank: 1, label: "Distributed systems", score: 96, status: "kept-top" },
      { rank: 2, label: "Kubernetes standards", score: 88, status: "kept" },
      { rank: 3, label: "Mentored 6 engineers", score: 79, status: "kept" },
      { rank: 4, label: "Frontend (React) work", score: 41, status: "trimmed" },
      { rank: 5, label: "2014 PHP role", score: 18, status: "cut" },
    ],
  },
];

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

  // The agent audit shown before any paid run is the user's REAL audit, computed
  // from their own resume + posting (mode "audit" — free, no credit, no documents).
  // Only the downloadable tailored resume + cover letter below are gated. Falls
  // back to a clearly-labeled sample if the audit can't run (demo mode without a
  // provider, rate-limited, or error).
  const [auditAgents, setAuditAgents] = useState<AuditAgent[] | null>(null);
  const [auditSample, setAuditSample] = useState(false);
  const [auditLoading, setAuditLoading] = useState(true);
  useEffect(() => {
    // `auditLoading` starts true; this fetch runs once for the step-3 mount (deps
    // are stable through the terminal step), so no synchronous reset is needed.
    let active = true;
    fetch("/api/apply", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode: "audit", useSample, resumeText, postingText: posting }),
    })
      .then((r) => r.json())
      .then((d) => {
        if (!active) return;
        if (d.result?.agents?.length) {
          setAuditAgents(d.result.agents as AuditAgent[]);
          setAuditSample(false);
        } else {
          setAuditAgents(DEMO_AGENTS); // demo / rate-limited / error → labeled sample
          setAuditSample(true);
        }
      })
      .catch(() => {
        if (!active) return;
        setAuditAgents(DEMO_AGENTS);
        setAuditSample(true);
      })
      .finally(() => {
        if (active) setAuditLoading(false);
      });
    return () => {
      active = false;
    };
  }, [useSample, resumeText, posting]);

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
            {full.applicationId && (
              <a
                className="tm-btn tm-btn--outline tm-btn--lg"
                href={texHref(full.applicationId)}
              >
                <FileText size={16} /> LaTeX (.tex)
              </a>
            )}
            <Link className="tm-btn tm-btn--outline tm-btn--lg" href={ROUTES.dashboard}>
              <FileText size={16} /> View in dashboard
            </Link>
          </div>
        </div>
        {r.verification &&
          r.verification.checked > 0 &&
          r.verification.status !== "unavailable" && (
          <div
            className="tm-card"
            style={{ padding: "22px 24px", display: "flex", flexDirection: "column", gap: "12px" }}
          >
            <span className="tmB-ev-head">
              <ShieldCheck size={14} /> Verified against your resume
            </span>
            {r.verification.status === "clean" ? (
              <p className="tm-small">
                We re-read all {r.verification.checked} lines of your experience and summary
                against your original — every claim traces back to something you actually
                wrote. Nothing in them was invented or inflated.
              </p>
            ) : (
              <Fragment>
                <p className="tm-small">
                  We re-read your experience and summary against your original and pulled
                  back {r.verification.corrections.length}{" "}
                  claim{r.verification.corrections.length === 1 ? "" : "s"} that weren’t fully
                  supported, so every line stays defensible in an interview:
                </p>
                {r.verification.corrections.map((c, i) => (
                  <p key={i} className="tmB-rq-item">
                    <span className="tm-pill">{VERIFY_LABELS[c.kind]}</span>
                    <span style={{ fontWeight: 600 }}>{c.claim}</span>
                    {c.note ? ` — ${c.note}` : ""}
                  </p>
                ))}
              </Fragment>
            )}
          </div>
        )}
        {r.agents && r.agents.length > 0 ? (
          <AgentAudit agents={r.agents} />
        ) : (
          <Fragment>
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
          </Fragment>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-[20px]">
      {auditLoading ? (
        <div
          className="tm-card"
          style={{ padding: "22px 24px", display: "flex", alignItems: "center", gap: "13px" }}
        >
          <style>{`@keyframes tmspin{to{transform:rotate(360deg)}}`}</style>
          <span
            aria-hidden="true"
            style={{
              height: "26px",
              width: "26px",
              flex: "none",
              borderRadius: "50%",
              border: "2.5px solid var(--tm-blue-50)",
              borderTopColor: "var(--tm-blue-600)",
              animation: "tmspin .8s linear infinite",
            }}
          />
          <div>
            <b style={{ fontSize: "15px", color: "var(--tm-ink)" }}>Running your agent audit…</b>
            <p className="tm-small" style={{ fontSize: "12.5px", marginTop: "1px" }}>
              Three specialist agents are reading your resume against this posting.
            </p>
          </div>
        </div>
      ) : (
        <AgentAudit agents={auditAgents ?? DEMO_AGENTS} sample={auditSample} />
      )}
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

  // On a step change, re-orient to the top of the flow so the new step isn't
  // mounted off-screen below where the just-clicked button was. (Smooth via the
  // global html{scroll-behavior:smooth}.) Skip the initial mount.
  const headRef = useRef<HTMLElement>(null);
  const firstStep = useRef(true);
  useEffect(() => {
    if (firstStep.current) {
      firstStep.current = false;
      return;
    }
    headRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [step]);

  return (
    <Fragment>
      <section ref={headRef} className="tm-sec tmF-head" style={{ paddingBottom: 0 }}>
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
          {/* key={step} remounts on each step so the entrance animation replays */}
          <div key={step} className="tmF-anim">
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
          </div>
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
