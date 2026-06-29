"use client";

// Free audit wizard — a real 3-step flow.
// Step 1: upload a resume (real PDF/Word/text parsing) or use the sample.
// Step 2: paste a posting → real fit scoring (Anthropic) or simulated.
// Step 3: results. Signed-out → watermarked preview + account gate.
//         Signed-in → run the full tailored application (spends 1 credit),
//         showing the real tailored bullets, agent notes, and a PDF download.

import { Fragment, useEffect, useRef, useState, type CSSProperties } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  AlertTriangle,
  ArrowRight,
  Briefcase,
  Calendar,
  Check,
  ChevronDown,
  ClipboardPaste,
  FileText,
  Gauge,
  List,
  Minus,
  PenLine,
  Plus,
  Quote,
  Search,
  Sparkles,
  Target,
  TrendingUp,
  Upload,
  User,
} from "lucide-react";
import { ROUTES, SCORES } from "@/components/landing/data";
import type {
  ApplyResult,
  AuditAgent,
  FitBreakdown,
  ProofPoint,
  ResumeStats,
  RoleContext,
  TailoredDoc,
} from "@/lib/types";
import { useSession } from "@/lib/auth";
import { track, getSessionId } from "@/lib/track";
import {
  clearSavedResume,
  loadBaseResumeDoc,
  loadSavedResume,
  loadTargetResume,
  loadTargetResumeId,
  saveResume,
  statsAreEmpty,
  statsFromDoc,
  type SavedResume,
} from "@/lib/resume";
import { saveLocalApplication } from "@/lib/local-applications";
import { SAMPLE_DOC } from "@/lib/apply/sample";
import { fixSection, SECTION_LABEL } from "@/lib/apply/sections";
import { isPlaceholderName } from "@/lib/apply/placeholder-name";
import { ManualReviewCTA, MichaelPitch } from "@/components/fit/michael-cta";
import { stripLogoArtifact } from "@/lib/text-clean";
import { groundFindings, normalizeForMatch } from "@/lib/resume-rules/groundFindings";

const SHOW_SAMPLE_WORKFLOWS = process.env.NEXT_PUBLIC_SHOW_SAMPLE_WORKFLOWS === "1";

// Per-dimension demo evidence (fallback when Anthropic isn't configured).
const FIT_WHY: { plus: string[]; minus: string[] }[] = [
  {
    plus: [
      "Node.js at scale: your checkout-migration bullet matches the posting’s core requirement",
      "Kubernetes: you own deployment standards; named as required",
      "Distributed systems: strong overlap with the platform team’s stack",
    ],
    minus: [
      "Observability appears 3× in the posting but 0× in your resume; tailoring will surface your Datadog work",
    ],
  },
  {
    plus: [
      "7 years senior-level vs 5+ required",
      "Migration ownership maps directly to the role’s “own our platform evolution” mandate",
    ],
    minus: [
      "No formal platform-team title; your platform work is buried under a generic SWE heading",
    ],
  },
  {
    plus: [
      "Mentoring 6 engineers matches the posting’s “grow the team” emphasis",
      "Code-review ownership signals the collaboration they ask for",
    ],
    minus: [
      "Little evidence of cross-team work in your current bullets, likely present, just unwritten",
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

export interface FitView {
  header: string;
  overall: number;
  verdict: string; // clean verdict tier, e.g. "Strong fit"
  verdictPill: string;
  summary: string;
  locationStatus: "pass" | "fail" | "unclear";
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
  "Your last three years trend toward platform and infrastructure work, the natural next step this role describes.",
];

const DEMO_VIEW: FitView = {
  header: "Senior Platform Engineer · Nordpeak Systems",
  overall: 84,
  verdict: "Strong fit",
  verdictPill: "84 · strong fit",
  summary:
    "Why 84, strong fit: your platform work lines up with 4 of 5 dimensions. The weakest one, culture fit, isn’t missing experience, it’s missing evidence in your bullets. That’s exactly what tailoring surfaces. Tap any dimension to see what we found.",
  locationStatus: "pass",
  locationNote: "posting allows Remote EU; your profile lists Copenhagen",
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
    header: hasCompany ? `${result.role} · ${company}` : result.role,
    overall: fit.overall,
    verdict: fit.verdict,
    verdictPill: `${fit.overall} · ${fit.verdict}`,
    summary: fit.summary,
    locationStatus: fit.locationStatus ?? (fit.locationPass ? "pass" : "unclear"),
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

// Reverse of toView: rebuild a FitBreakdown from the audit's view model so the
// free "Open editor" handoff can stash a real scored application and the editor
// shows the same fit panel + coaching the paid path does.
function fitViewToBreakdown(v: FitView | null): FitBreakdown {
  if (!v) {
    return { overall: 0, verdict: "", dimensions: [], locationPass: false, locationNote: "", summary: "" };
  }
  return {
    overall: v.overall,
    verdict: v.verdict,
    dimensions: v.dims.map((d) => ({
      label: d.label,
      score: d.score,
      matched: d.plus,
      gaps: d.gaps,
      why: d.why,
    })),
    locationStatus: v.locationStatus,
    locationPass: v.locationStatus === "pass",
    locationNote: v.locationNote,
    summary: v.summary,
    keywords: v.keywords,
    recommendReview: v.recommendReview,
  };
}

const STEP_LABELS = ["Your resume", "Score & agents", "Summary"];

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
  if (score >= 78)
    return { tag: "Strong", bar: "var(--tm-mint-600)", pillBg: "var(--tm-mint-50)", pillInk: "var(--tm-mint-600)" };
  if (score >= 62)
    return { tag: "Solid", bar: "var(--tm-blue-600)", pillBg: "var(--tm-blue-50)", pillInk: "var(--tm-blue-800)" };
  if (score >= 45)
    return { tag: "Fair", bar: "#e0a23c", pillBg: "#fdf3e7", pillInk: "#854f0b" };
  return { tag: "Weak", bar: "#d9544d", pillBg: "#fdecea", pillInk: "#b3261e" };
}

// Location gate is tri-state: met / real conflict / not specified — clearer than
// a vague "Check".
const LOCATION_STATE: Record<
  "pass" | "fail" | "unclear",
  { label: string; bg: string; ink: string }
> = {
  pass: { label: "Pass", bg: "var(--tm-mint-50)", ink: "var(--tm-mint-600)" },
  fail: { label: "Fail", bg: "#fdecea", ink: "#b3261e" },
  unclear: { label: "Not specified", bg: "#fdf3e7", ink: "#854f0b" },
};

// Fit tier → hero colour theme. Green ONLY for a genuinely strong fit; blue for
// solid, amber for a stretch, red for a poor match — so the colour never
// celebrates a weak result. `positive` also picks the icon (check vs alert).
type FitTheme = {
  card: string;
  border: string;
  ring: string;
  ink: string;
  positive: boolean;
};
function fitTheme(overall: number): FitTheme {
  if (overall >= 78)
    return { card: "var(--tm-mint-50)", border: "rgba(33,146,107,.28)", ring: "var(--tm-mint-600)", ink: "var(--tm-mint-600)", positive: true };
  if (overall >= 62)
    return { card: "var(--tm-blue-50)", border: "rgba(67,115,219,.28)", ring: "var(--tm-blue-600)", ink: "var(--tm-blue-800)", positive: true };
  if (overall >= 45)
    return { card: "#fdf3e7", border: "rgba(133,79,11,.30)", ring: "#ba7517", ink: "#854f0b", positive: false };
  return { card: "#fdecea", border: "rgba(179,38,30,.28)", ring: "#b3261e", ink: "#b3261e", positive: false };
}

// The score ring — the hero of the Job Score step. Animates the stroke + the
// number up from zero once `run` flips true.
function ScoreRing({ score, run, color }: { score: number; run: boolean; color: string }) {
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
          stroke={color}
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

// Severity pill tints — high = red, medium = amber, low = neutral gray — so the
// badge reads at a glance instead of being a uniform gray chip.
const SEV_PILL: Record<ProofPoint["severity"], { bg: string; ink: string }> = {
  high: { bg: "#fdecea", ink: "#b3261e" },
  medium: { bg: "#fdf3e7", ink: "#854f0b" },
  low: { bg: "rgba(24,24,27,0.06)", ink: "var(--tm-zinc)" },
};

// Severity group headings for the categorized "What tailoring will fix" list.
const SEV_LABEL: Record<ProofPoint["severity"], string> = {
  high: "High priority",
  medium: "Worth fixing",
  low: "Minor polish",
};

function normalizeProofPointFix(p: ProofPoint): string {
  const fix = p.fix ?? "";
  const context = `${p.ruleId ?? ""} ${p.category ?? ""} ${p.targetSection ?? ""} ${p.title} ${p.summary}`.toLowerCase();
  const isSummaryDensityFinding =
    p.targetSection === "summary" ||
    p.ruleId === "lead_with_impact_summary" ||
    (context.includes("summary") && (context.includes("dense") || context.includes("paragraph")));
  const recommendsBullets = /\bbullets?\b/i.test(fix) || /3\s*(?:-|to)\s*5/i.test(fix);

  if (isSummaryDensityFinding && recommendsBullets) {
    return "Shorten this into a tighter 1-2 sentence summary paragraph that keeps the strongest role fit and proof. Do not turn the summary into bullets.";
  }

  return fix;
}

// A single proof point: headline + summary up front, the verbatim resume quote
// as proof it's real, and an optional deep-dive into why + the fix.
function ProofPointCard({ p }: { p: ProofPoint }) {
  const section = fixSection(p); // which résumé section this fix lives in
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
          className="tm-pill"
          style={{
            marginLeft: "auto",
            fontSize: "10.5px",
            textTransform: "capitalize",
            background: SEV_PILL[p.severity].bg,
            color: SEV_PILL[p.severity].ink,
          }}
        >
          {p.severity}
        </span>
      </div>
      <div style={{ marginTop: "8px" }}>
        <span
          className="tm-pill tm-pill--gray"
          style={{ fontSize: "10.5px" }}
        >
          {SECTION_LABEL[section]} section
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
          {normalizeProofPointFix(p) && (
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
                {normalizeProofPointFix(p)}
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
    "Only 3 of 14 bullets quantify impact; recruiters skim for numbers.",
    "Strong platform work is buried under a generic “Software Engineer” heading.",
    "No summary tuned to the role you’re targeting.",
  ],
  proofPoints: [
    {
      title: "Impact is described, not quantified",
      summary:
        "Your strongest bullet states activity but no result; recruiters skim for numbers first.",
      quote:
        "Responsible for developing and maintaining features for the web app using React and Node.js.",
      why: "An ATS and a recruiter scanning for ~6 seconds both look for outcomes. “Responsible for…” reads as a job description, not an achievement, so a strong engineer looks average on paper.",
      fix: "We rewrite it around the result using numbers already in your history, e.g. the checkout migration that cut p95 latency 38% across 2.4M daily transactions.",
      severity: "high",
    },
    {
      title: "A generic title buries your platform work",
      summary: "Your headline is the first thing matched against the role, and it’s too broad.",
      quote: "Software Engineer",
      why: "The headline is the highest-weight keyword line on the page. A generic “Software Engineer” under-ranks you for the platform role you’re targeting.",
      fix: "We align the headline to the target role where your experience genuinely supports it, surfacing the platform work that’s currently hidden in your bullets.",
      severity: "medium",
    },
    {
      title: "No summary tuned to this role",
      summary: "There’s no 1–2 line summary telling this employer why you fit.",
      quote: "",
      why: "Without a tailored summary the reader infers your fit from scattered bullets, so the top third of the page (the part that gets read first) never states your strongest match outright.",
      fix: "We add a tight, role-specific summary so the top third of the page sells your fit before the reader hits the bullets.",
      severity: "medium",
    },
  ],
};

// Parse-progress steps. The first few advance on a timer to feel alive; the
// LAST one stays a spinner until the real parse resolves — we never show every
// step complete before the candidate's data is actually ready.
const PARSE_STEPS = [
  "Reading your resume…",
  "Extracting roles, dates, and skills",
  "Finding the achievements buried in your bullets",
  "Building your profile…",
];

// When the final "Building your profile…" spinner appears, and the floor that
// lets the staged steps fully play even on a fast/cached parse. Tuned so the
// earlier steps carry more of the wait and the last step doesn't dominate.
const PARSE_LAST_STEP_MS = 3300;
const PARSE_MIN_MS = 3600;
const MAX_RESUME_UPLOAD_BYTES = 8 * 1024 * 1024;

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
  const [parseStep, setParseStep] = useState(0);
  const fileRef = useRef<HTMLInputElement>(null);

  // Advance through the early parse steps; HOLD on the last (a spinner) until
  // the real parse resolves and phase flips to "done". Never marks every step
  // complete while the backend is still working.
  useEffect(() => {
    if (phase !== "parsing") return;
    // parseStep is reset to 0 by whoever starts parsing; here we only schedule
    // the advance (deferred setState in timers is fine).
    // Pace the early steps over a longer, slightly randomized schedule so the
    // progress feels organic and the final spinner doesn't hog the wait. The
    // last step holds until the real parse resolves (phase flips to "done").
    const jitter = (ms: number) => Math.round(ms + (Math.random() - 0.5) * ms * 0.2);
    const t = [
      setTimeout(() => setParseStep(1), jitter(850)),
      setTimeout(() => setParseStep(2), jitter(2100)),
      setTimeout(() => setParseStep(PARSE_STEPS.length - 1), PARSE_LAST_STEP_MS),
    ];
    return () => t.forEach(clearTimeout);
  }, [phase]);

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
  // The resume left a template name placeholder ("CANDIDATE NAME", "Your Name")
  // unfilled — surface a gentle nudge so it isn't shipped as the candidate's name.
  const namePlaceholder = !showSample && !!profile && isPlaceholderName(profile.name || "");

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
    if (file.size > MAX_RESUME_UPLOAD_BYTES) {
      setError("File too large (max 8 MB).");
      if (fileRef.current) fileRef.current.value = "";
      return;
    }
    setParseStep(0);
    setPhase("parsing");
    // A new upload supersedes any previously-cached resume. Drop the stale "use
    // your saved resume" offer NOW so its (different) person can't be re-applied
    // over the file being parsed — the bug where an upload showed another name.
    setSaved(null);
    const startedAt = performance.now();
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/parse-resume", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "parse failed");
      const s = data.stats as ResumeStats;
      // Let the progress steps breathe even on a fast parse, so they read as
      // real progress rather than a flash of all-done.
      const elapsed = performance.now() - startedAt;
      if (elapsed < PARSE_MIN_MS)
        await new Promise((r) => setTimeout(r, PARSE_MIN_MS - elapsed));
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
    // The profile tiles read from `stats`, but a base/saved resume often stores a
    // rich `doc` with no parsed stats (or an all-zero placeholder). Derive stats
    // from the doc so the tiles match the resume the user can see, instead of 0s.
    if (!statsAreEmpty(saved.stats)) {
      onUploaded(saved.text, saved.stats!);
      setPhase("done");
      return;
    }
    const derived = saved.doc ? statsFromDoc(saved.doc) : null;
    if (derived && !statsAreEmpty(derived)) {
      onUploaded(saved.text, derived);
      setPhase("done");
    } else {
      // Nothing meaningful to show in the profile panel — skip it and go straight
      // to the job step (the resume text is fully present and usable).
      onUploaded(saved.text, derived ?? {
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
    setParseStep(0);
    setPhase("parsing");
    setTimeout(() => setPhase("done"), PARSE_MIN_MS);
  };

  // Metadata for the saved-resume card, derived from what we stored (resume text
  // + parse stats + save time): word count from the text, a rough page estimate,
  // role/skill counts, and when it was saved. Each is omitted if unavailable.
  const savedWords = saved?.text ? saved.text.trim().split(/\s+/).filter(Boolean).length : 0;
  const savedPages = savedWords ? Math.max(1, Math.round(savedWords / 480)) : 0;
  const savedRoles = saved?.stats?.roles ?? 0;
  const savedSkills = saved?.stats?.skills?.length ?? 0;
  const savedDate = saved?.savedAt ? new Date(saved.savedAt) : null;
  const savedDateLabel =
    savedDate && !Number.isNaN(savedDate.getTime())
      ? savedDate.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })
      : null;

  return (
    <div className="tm-card">
      {phase === "idle" && !done && (
        <div>
          {saved && (
            <>
              <div className="tm-card tmF-saved">
                <span aria-hidden="true" className="tmF-saved-thumb">
                  <FileText size={22} />
                </span>
                <div className="tmF-saved-body">
                  <div className="tmF-saved-name">
                    <b>{saved.name}</b>
                    <span className="tm-pill tm-pill--mint tmF-saved-badge">
                      <Check size={11} /> Saved
                    </span>
                  </div>
                  <span className="tmF-saved-sub">Saved resume, ready to reuse</span>
                  <div className="tmF-saved-meta">
                    {savedPages > 0 && (
                      <span className="tmF-saved-chip">
                        ~{savedPages} {savedPages === 1 ? "page" : "pages"}
                      </span>
                    )}
                    {savedRoles > 0 && (
                      <span className="tmF-saved-chip">
                        {savedRoles} {savedRoles === 1 ? "role" : "roles"}
                      </span>
                    )}
                    {savedSkills > 0 && (
                      <span className="tmF-saved-chip">{savedSkills} skills</span>
                    )}
                    {savedDateLabel && (
                      <span className="tmF-saved-date">saved {savedDateLabel}</span>
                    )}
                  </div>
                </div>
                <div className="tmF-saved-actions">
                  <button
                    type="button"
                    className="tm-btn tm-btn--primary tmF-saved-use"
                    onClick={useSaved}
                    disabled={phase !== "idle"}
                  >
                    Use this resume <ArrowRight size={15} />
                  </button>
                  <button
                    type="button"
                    onClick={forgetSaved}
                    className="tmF-saved-forget"
                  >
                    Not your resume? <span>Forget it</span>
                  </button>
                </div>
              </div>
              <p className="tmF-or">or upload a different one</p>
            </>
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
          {SHOW_SAMPLE_WORKFLOWS && (
            <>
              <p className="tmF-or">or</p>
              <button
                type="button"
                className="tm-btn tm-btn--outline w-full justify-center"
                onClick={useSampleNow}
              >
                Try with the sample resume
              </button>
            </>
          )}
        </div>
      )}
      {phase === "parsing" && (
        <div className="tmF-parse">
          <style>{`@keyframes tmspin{to{transform:rotate(360deg)}}`}</style>
          {PARSE_STEPS.map((label, i) => {
            const isDone = i < parseStep;
            const isActive = i === parseStep;
            return (
              <p
                key={label}
                className="tmF-parse-line"
                style={{ color: isDone || isActive ? "var(--tm-ink)" : "var(--tm-zinc)" }}
              >
                <span
                  aria-hidden="true"
                  style={{
                    display: "inline-flex",
                    width: "14px",
                    height: "14px",
                    flex: "none",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  {isDone ? (
                    <Check size={14} />
                  ) : isActive ? (
                    <span
                      style={{
                        width: "12px",
                        height: "12px",
                        borderRadius: "50%",
                        border: "2px solid var(--tm-blue-50)",
                        borderTopColor: "var(--tm-blue-600)",
                        animation: "tmspin .7s linear infinite",
                      }}
                    />
                  ) : (
                    <span
                      style={{
                        width: "5px",
                        height: "5px",
                        borderRadius: "50%",
                        background: "var(--tm-border)",
                      }}
                    />
                  )}
                </span>{" "}
                {label}
              </p>
            );
          })}
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
                  {namePlaceholder ? (
                    <span style={{ color: "#ba7517", display: "inline-flex", alignItems: "center", gap: "4px" }}>
                      <AlertTriangle size={12} style={{ flex: "none" }} />
                      Looks like a template placeholder. Add your real name when you edit.
                    </span>
                  ) : profile.primaryRole ? (
                    profile.primaryRole +
                    (profile.yearsExperience ? ` · ${profile.yearsExperience} yrs` : "") +
                    (showSample ? " · sample profile" : "")
                  ) : (
                    "parsed from your upload"
                  )}
                </span>
              </div>
              <span className={`tm-pill ${namePlaceholder ? "tm-pill--amber" : "tm-pill--mint"} ml-auto`}>
                {namePlaceholder ? <AlertTriangle size={12} /> : <Check size={12} />}{" "}
                {namePlaceholder ? "check name" : "parsed"}
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
                    <span style={{ color: "var(--tm-ink)" }}>{b.text}</span>
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
              <StatCard icon={<TrendingUp size={15} />} value={metricsN} label="quantified bullets" />
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

          {(() => {
            const fixCount = profile.proofPoints?.length || profile.weaknesses?.length || 0;
            if (!fixCount) return null;
            // Teaser only — the full, prioritized fix list (with each fix) is
            // consolidated on the Summary step after the job match, so we don't
            // dump a problem list on the user before they've even picked a job.
            return (
              <Reveal show={reveal >= 5} style={{ marginTop: "20px" }}>
                <div
                  style={{
                    border: "0.5px solid rgba(186,117,23,.3)",
                    background: "#fdf3e7",
                    borderRadius: "12px",
                    padding: "14px 16px",
                    display: "flex",
                    gap: "12px",
                    alignItems: "flex-start",
                  }}
                >
                  <AlertTriangle size={16} style={{ color: "#ba7517", flex: "none", marginTop: "1px" }} />
                  <div>
                    <p style={{ fontSize: "13.5px", fontWeight: 500, color: "var(--tm-ink)" }}>
                      We found <b className="tm-data">{fixCount}</b> thing{fixCount === 1 ? "" : "s"} to tighten in your resume.
                    </p>
                    <p className="tm-small" style={{ marginTop: "3px", fontSize: "12.5px" }}>
                      You’ll see each one, with the fix, in your summary after the job match.
                    </p>
                  </div>
                </div>
              </Reveal>
            );
          })()}

          <Reveal show={reveal >= 5} style={{ marginTop: "22px" }}>
            <div
              className="tmF-profile2-foot"
              style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "10px" }}
            >
              <button type="button" className="tm-btn tm-btn--primary" onClick={onNext}>
                Next: pick the job <ArrowRight size={15} />
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

// "What this kind of role needs" — context from the fast role call.
function RolePreview({ ctx }: { ctx: RoleContext }) {
  return (
    <div
      style={{
        border: "0.5px solid var(--tm-blue-200)",
        borderRadius: "12px",
        padding: "16px 18px",
        background: "var(--tm-blue-50)",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
        <p
          style={{
            margin: 0,
            fontSize: "11px",
            fontWeight: 600,
            letterSpacing: "0.05em",
            textTransform: "uppercase",
            color: "var(--tm-blue-800)",
          }}
        >
          What a {ctx.role} typically needs
        </p>
        {ctx.seniority && (
          <span className="tm-pill tm-pill--gray" style={{ marginLeft: "auto", fontSize: "10.5px" }}>
            {ctx.seniority}
          </span>
        )}
      </div>
      <p className="tm-small" style={{ marginTop: "6px", fontSize: "12.5px", lineHeight: 1.5 }}>
        While we score your fit, here’s what strong candidates for this role usually bring.
      </p>
      {ctx.responsibilities.length > 0 && (
        <ul style={{ marginTop: "12px", display: "flex", flexDirection: "column", gap: "7px" }}>
          {ctx.responsibilities.slice(0, 4).map((r, i) => (
            <li
              key={i}
              style={{ fontSize: "13px", lineHeight: 1.5, color: "var(--tm-ink)", display: "flex", gap: "9px" }}
            >
              <span style={{ color: "var(--tm-blue-600)", flex: "none" }}>•</span>
              <span>{r}</span>
            </li>
          ))}
        </ul>
      )}
      {ctx.typicalSkills.length > 0 && (
        <div className="tmF-chips" style={{ marginTop: "12px" }}>
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

// Eases the role-context card into the scoring screen the moment the fast role
// call returns: it grows from zero height while fading in (~0.8s) so it slides
// in gradually instead of snapping in mid-screen. Inline styles (not a CSS
// class) keep it immune to the dev CSS cache.
function RoleReveal({ ctx }: { ctx: RoleContext }) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const id = window.setTimeout(() => setOpen(true), 40);
    return () => window.clearTimeout(id);
  }, []);
  return (
    <div
      aria-hidden={!open}
      style={{
        display: "grid",
        gridTemplateRows: open ? "1fr" : "0fr",
        opacity: open ? 1 : 0,
        marginTop: open ? "18px" : 0,
        transition:
          "grid-template-rows .8s cubic-bezier(.22,1,.36,1), opacity .7s ease .05s, margin-top .8s cubic-bezier(.22,1,.36,1)",
      }}
    >
      <div style={{ overflow: "hidden", minHeight: 0 }}>
        <RolePreview ctx={ctx} />
      </div>
    </div>
  );
}

// The parsing/loading screen: status animation + the user's real target + the
// role-context card eased in once the fast role call returns. Never shows a
// default company/role.
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
              ? "Hang tight, this takes a few seconds."
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
      {roleCtx && <RoleReveal ctx={roleCtx} />}
    </div>
  );
}


// The fit breakdown (score hero + ranked dimensions + location + keyword
// coverage). Presentational + self-contained (owns its expand state) so both
// the Job Score step and the Summary step render an identical breakdown. The
// prose verdict is trimmed to a one-line lead — the ranked rows carry the "why".
// One compact scorecard: ring + verdict on the left, the dimensions and location
// on the right. Replaces the old separate score-hero + dimensions cards so the
// step reads as one block instead of three.
function FitResult({ view, shown }: { view: FitView; shown: boolean }) {
  const [openDims, setOpenDims] = useState<Set<number>>(new Set());
  const ranked = [...view.dims].sort((a, b) => b.score - a.score);
  const theme = fitTheme(view.overall);
  const top = ranked[0];
  const focus = ranked.length > 1 ? ranked[ranked.length - 1] : null;
  const loc = LOCATION_STATE[view.locationStatus];

  return (
    <div className="tm-card" style={{ padding: "22px 24px" }}>
      <div className="tmAg-head">
        <span className="tmB-ev-head">
          <Gauge size={14} /> Job score
        </span>
        <span className="tmAg-hint">tap a dimension</span>
      </div>
      <div className="tmSc">
        <div className="tmSc-left">
          <ScoreRing score={view.overall} run={shown} color={theme.ring} />
        <span className="tmSc-verdict" style={{ color: theme.ink }}>
          {theme.positive ? <Check size={12} /> : <AlertTriangle size={12} />} {view.verdict}
        </span>
        {top && (
          <div className="tmSc-take">
            <div className="tmSc-take-row">
              <span className="tmSc-take-k">Strongest</span>
              <span className="tmSc-take-v">{top.label}</span>
            </div>
            {focus && (
              <div className="tmSc-take-row">
                <span className="tmSc-take-k">Most room</span>
                <span className="tmSc-take-v">{focus.label}</span>
              </div>
            )}
          </div>
        )}
      </div>
      <div className="tmSc-right">
        {ranked.map((d, i) => {
          const b = band(d.score);
          const open = openDims.has(i);
          return (
            <div key={`${i}-${d.label}`} className={"tmSc-dim" + (open ? " is-open" : "")}>
              <div
                className="tmSc-dimrow"
                onClick={() =>
                  setOpenDims((s) => {
                    const n = new Set(s);
                    if (n.has(i)) n.delete(i);
                    else n.add(i);
                    return n;
                  })
                }
              >
                <span className="tmSc-dl">{d.label}</span>
                <span className="tmSc-dt">
                  <i
                    style={{
                      background: b.bar,
                      width: shown ? `${d.score}%` : "0%",
                      transitionDelay: `${i * 70}ms`,
                    }}
                  />
                </span>
                <span className="tmSc-dv">{d.score}</span>
                <span className="tmSc-tag" style={{ background: b.pillBg, color: b.pillInk }}>
                  {b.tag}
                </span>
                <span className="tmSc-chev" aria-hidden="true">
                  <Plus size={15} />
                </span>
              </div>
              <div className="tmSc-dimbody">
                <div className="tmSc-dimbody-in">
                  <div className="tmSc-why">
                    {d.why && <p className="tmSc-why-narr">{d.why}</p>}
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
        <div className="tmSc-loc">
          <span
            className="tm-pill"
            style={{ flex: "none", background: loc.bg, color: loc.ink }}
          >
            {view.locationStatus === "pass" ? (
              <Check size={12} />
            ) : view.locationStatus === "fail" ? (
              <AlertTriangle size={12} />
            ) : (
              <Minus size={12} />
            )}{" "}
            {loc.label}
          </span>
          <span className="tmSc-locnote">{view.locationNote}</span>
        </div>
      </div>
      </div>
    </div>
  );
}


function StepJob({
  posting,
  setPosting,
  useSample,
  resumeText,
  onNext,
  onScored,
  onAudited,
}: {
  posting: string;
  setPosting: (v: string) => void;
  useSample: boolean;
  resumeText: string;
  onNext: () => void;
  onScored?: (v: FitView) => void;
  onAudited?: (agents: AuditAgent[], sample: boolean) => void;
}) {
  const [phase, setPhase] = useState<"idle" | "scoring" | "done">("idle");
  const [view, setView] = useState<FitView>(DEMO_VIEW);
  const [shown, setShown] = useState(false); // triggers the ring + bar fill animation
  const [note, setNote] = useState<string | null>(null);
  const [fetching, setFetching] = useState(false);
  const [fetchErr, setFetchErr] = useState<string | null>(null);
  const [fetchNote, setFetchNote] = useState<string | null>(null);
  const [wasUrl, setWasUrl] = useState(false); // posting came from a pasted link
  const [demoScore, setDemoScore] = useState(false);
  const [roleCtx, setRoleCtx] = useState<RoleContext | null>(null);
  const [targetLabel, setTargetLabel] = useState("");
  const [statusIdx, setStatusIdx] = useState(0);
  // The agent audit shares this step's single mode:"audit" call (it returns the
  // fit score AND the three agents), so the score and the agent review land
  // together on one screen — no separate step or second loader.
  const [agents, setAgents] = useState<AuditAgent[]>(DEMO_AGENTS);
  const [auditSample, setAuditSample] = useState(false);

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
  const displayTarget = stripLogoArtifact(roleCtx?.role || targetLabel);

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
              ? "Pulled from the link. We trimmed a long page to its most relevant part."
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
    track("free_audit_started", { source: useSample ? "sample" : "user" });
    const scoreStart = performance.now();

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
    let ag: AuditAgent[] = DEMO_AGENTS;
    let sample = false;
    let msg: string | null = null;
    try {
      // ONE call returns both the fit score and the three agents (runAudit), so
      // the wizard scores + reviews in a single step instead of two.
      const res = await fetch("/api/apply", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-tm-session": getSessionId() ?? "",
        },
        body: JSON.stringify({
          mode: "audit",
          useSample,
          resumeText,
          postingText: postingForScore,
        }),
      });
      const data = await res.json();
      if (data.result) {
        const r = data.result as ApplyResult;
        v = toView(r);
        if (r.agents && r.agents.length) ag = r.agents;
        else sample = true; // fit came back but no agents → keep the sample agents
      } else if (res.status === 429 || res.status === 413) {
        // Free limit reached or input too large → show the sample, nudge signup.
        if (res.status === 429) track("limit_hit", { feature: "audit" });
        msg = data.error as string;
        sample = true;
      } else if (data.demo) {
        // No provider configured → DEMO results are shown; flag them as a sample.
        setDemoScore(true);
        sample = true;
      } else {
        sample = true;
      }
    } catch {
      /* fall back to the simulated result */
      sample = true;
    }
    // A reset (posting edited) or unmount during the awaits above bumps scoreRun;
    // bail before writing stale state or scheduling timers for an abandoned score.
    if (scoreRun.current !== myRun) return;
    setNote(msg);
    setView(v);
    setAgents(ag);
    setAuditSample(sample);
    onScored?.(v); // lift the fit result so the Summary step can reuse it
    onAudited?.(ag, sample); // lift the agents too — same single call
    // Let the loader visibly complete its last step, hold a short beat, THEN
    // reveal — so the hand-off reads as "analysis finished → results glide in"
    // instead of cutting away mid-progress (which felt jarring).
    setStatusIdx(STATUS_MESSAGES("").length - 1);
    // Keep the loading screen up long enough for the role-context card (a ~3.2s
    // call) to return, ease in (0.8s), AND stay readable for a few seconds:
    // ~7s total minimum. Slow scores already exceed this, so they get only the
    // 650ms "analysis finished" beat and no extra delay.
    const holdMs = Math.max(650, 7000 - (performance.now() - scoreStart));
    scoreTimers.current.push(
      setTimeout(() => {
        if (scoreRun.current !== myRun) return;
        setShown(false);
        setPhase("done");
        // mount at zero, then flip `shown` to animate the ring + bars filling.
        scoreTimers.current.push(setTimeout(() => setShown(true), 60));
      }, holdMs),
    );
  };

  // Editing the posting (or "Change") invalidates a score — return to idle so the
  // user re-scores the text that will actually be tailored, cancelling any pending
  // timers / in-flight call so a stale result can't snap back.
  const resetToIdle = () => {
    cancelScore();
    setPhase("idle");
    setShown(false);
    setNote(null);
    setFetchNote(null);
    setDemoScore(false);
  };

  const sample =
    "Senior Platform Engineer · Nordpeak Systems (Remote, EU). Own the evolution of our backend platform: lead distributed Node.js services handling millions of daily transactions, set Kubernetes deployment standards across teams, and build observability into everything we ship. Requirements: 5+ years backend at scale; distributed systems and Node.js in production; strong Kubernetes and cloud (AWS/GCP); a track record of reliability and performance wins; mentoring and technical direction. Nice to have: Datadog/Prometheus; owning a platform other teams build on.";

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
              Paste a link and we’ll pull the posting for you, or paste the text.
            </p>
            {fetchErr && (
              <p className="tm-small mt-[8px]" style={{ color: "#b3261e" }}>
                {fetchErr}
              </p>
            )}
            <div className="tmF-actions" style={{ justifyContent: "space-between" }}>
              {SHOW_SAMPLE_WORKFLOWS ? (
                <button
                  type="button"
                  className="tm-btn tm-btn--ghost"
                  onClick={() => setPosting(sample)}
                >
                  Use the sample posting
                </button>
              ) : (
                <span />
              )}
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
    <div ref={resultRef} className="tmF-reveal" style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
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

      <FitResult view={view} shown={shown} />

      {note && (
        <p className="tmS-free">
          {note} This is a sample result.{" "}
          <Link href={ROUTES.signIn} style={{ color: "var(--tm-mint-600)", textDecoration: "underline" }}>
            create a free account
          </Link>{" "}
          to run your own.
        </p>
      )}
      {demoScore && (
        <p className="tmS-free">
          Demo mode: this is a sample result, not scored from your resume. Add a provider key to score
          real resumes.
        </p>
      )}
      {/* the three specialist agents — same single call returns them, so they
          render below the score (with extra space so "job score" and "agent
          review" read as two distinct groups). */}
      <div style={{ marginTop: "14px" }}>
        <AgentAudit agents={agents} sample={auditSample} />
      </div>

      {/* Michael escalation sits at the bottom, after the analysis, not above it. */}
      {view.recommendReview && <ManualReviewCTA overall={view.overall} />}

      {/* footer */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: "14px",
          flexWrap: "wrap",
        }}
      >
        <div style={{ textAlign: "center" }}>
          <button type="button" className="tm-btn tm-btn--primary" onClick={onNext}>
            See your summary <ArrowRight size={15} />
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------- Step 3: results (signed-out gate OR signed-in full run) ----------
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
  "kept-top": { label: "Kept · top", color: "var(--tm-mint-700)", bg: "var(--tm-mint-50)" },
  kept: { label: "Kept", color: "var(--tm-mint-700)", bg: "var(--tm-mint-50)" },
  trimmed: { label: "Trimmed", color: "#854f0b", bg: "#fdf3e7" },
  cut: { label: "Cut", color: "var(--tm-zinc)", bg: "var(--tm-gray)", strike: true },
};

// One semantic palette shared by every agent so the colors always mean the same
// thing: GREEN = already in your resume / strong; AMBER = missing, add it. Blue is
// reserved for neutral progress meters, never for "good" or "bad".
const SEMANTIC = {
  present: {
    bg: "var(--tm-mint-50)",
    ink: "var(--tm-mint-700)",
    border: "rgba(33, 146, 107, 0.28)",
    fill: "var(--tm-mint-500)",
  },
  missing: {
    bg: "#fdf3e7",
    ink: "#854f0b",
    border: "rgba(133, 79, 11, 0.3)",
    fill: "#d99b3a",
  },
};

function CoverageEvidence({ a }: { a: AuditAgent }) {
  const kws = a.keywords ?? [];
  const matchedKws = kws.filter((k) => k.matched);
  const missingKws = kws.filter((k) => !k.matched);
  const matched = a.matched ?? matchedKws.length;
  const total = a.total ?? kws.length;
  const pct = total ? Math.round((matched / total) * 100) : 0;
  return (
    <div>
      {/* coverage meter — green portion = the keywords you already cover */}
      <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
        <div
          style={{
            flex: 1,
            height: "8px",
            borderRadius: "999px",
            background: SEMANTIC.missing.bg,
            overflow: "hidden",
          }}
        >
          <div style={{ width: `${pct}%`, height: "100%", borderRadius: "999px", background: SEMANTIC.present.fill }} />
        </div>
        <span
          style={{
            fontSize: "13px",
            fontWeight: 600,
            color: "var(--tm-ink)",
            fontVariantNumeric: "tabular-nums",
            flex: "none",
          }}
        >
          {matched}
          <span style={{ color: "var(--tm-zinc)", fontWeight: 400 }}>/{total} covered</span>
        </span>
      </div>

      {/* GREEN group — keywords already present in the resume */}
      {matchedKws.length > 0 && (
        <div style={{ marginTop: "14px" }}>
          <EvidenceGroupLabel tone="present" icon={<Check size={12} />}>
            In your resume ({matchedKws.length})
          </EvidenceGroupLabel>
          <div className="tmF-chips" style={{ marginTop: "8px" }}>
            {matchedKws.map((k, i) => (
              <span key={`m-${i}`} className="tm-pill tm-pill--mint">
                <Check size={11} /> {k.name}
                {k.count && (
                  <span style={{ marginLeft: "5px", opacity: 0.6, fontVariantNumeric: "tabular-nums" }}>{k.count}</span>
                )}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* AMBER group — keywords the posting wants that aren't on the resume yet */}
      {missingKws.length > 0 && (
        <div
          style={{
            marginTop: "14px",
            borderRadius: "10px",
            border: `0.5px dashed ${SEMANTIC.missing.border}`,
            background: SEMANTIC.missing.bg,
            padding: "10px 12px",
          }}
        >
          <EvidenceGroupLabel tone="missing" icon={<Plus size={12} />}>
            Not in your resume — add to match ({missingKws.length})
          </EvidenceGroupLabel>
          <div className="tmF-chips" style={{ marginTop: "8px" }}>
            {missingKws.map((k, i) => (
              <span
                key={`x-${i}`}
                className="tm-pill"
                style={{ color: SEMANTIC.missing.ink, background: "#fff", border: `0.5px solid ${SEMANTIC.missing.border}` }}
              >
                <Plus size={11} /> {k.name}
              </span>
            ))}
          </div>
          <p className="tm-small" style={{ marginTop: "8px", fontSize: "11.5px", color: "var(--tm-zinc)" }}>
            Add these only where your experience genuinely backs them.
          </p>
        </div>
      )}
    </div>
  );
}

// Small uppercase group heading used across the agent evidence to label a green
// "present" block vs an amber "missing/add" block — so color always has a word.
function EvidenceGroupLabel({
  tone,
  icon,
  children,
}: {
  tone: "present" | "missing";
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "6px",
        fontSize: "11px",
        fontWeight: 700,
        letterSpacing: "0.04em",
        textTransform: "uppercase",
        color: SEMANTIC[tone].ink,
      }}
    >
      {icon} {children}
    </span>
  );
}

function ImpactEvidence({ a }: { a: AuditAgent }) {
  const total = a.quantified?.total ?? 0;
  const count = a.quantified?.count ?? 0;
  const gap = Math.max(0, total - count);
  const hasStats = !!(a.stats && a.stats.length > 0);
  const hasNeeds = !!(a.needsMetric && a.needsMetric.length > 0);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
      {/* meter — green portion = experience bullets that already carry a number */}
      {total > 0 && (
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <div style={{ flex: 1, height: "8px", borderRadius: "999px", background: SEMANTIC.missing.bg, overflow: "hidden" }}>
            <div
              style={{
                width: `${Math.round((count / total) * 100)}%`,
                height: "100%",
                borderRadius: "999px",
                background: SEMANTIC.present.fill,
              }}
            />
          </div>
          <span
            style={{
              fontSize: "13px",
              fontWeight: 600,
              color: "var(--tm-ink)",
              fontVariantNumeric: "tabular-nums",
              flex: "none",
            }}
          >
            {count}
            <span style={{ color: "var(--tm-zinc)", fontWeight: 400 }}>/{total} bullets are quantified</span>
          </span>
        </div>
      )}

      {/* AMBER — the actual lines still missing a number, with a metric hint each.
          The actionable core: which bullets to quantify, and with what. */}
      {a.needsMetric && a.needsMetric.length > 0 && (
        <div>
          <EvidenceGroupLabel tone="missing" icon={<Plus size={12} />}>
            Lines that need a number ({gap})
          </EvidenceGroupLabel>
          <ul
            style={{ listStyle: "none", margin: "8px 0 0", padding: 0, display: "flex", flexDirection: "column" }}
          >
            {a.needsMetric.map((m, i) => (
              <li
                key={i}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
                  padding: "8px 0",
                  borderTop: i ? "0.5px solid var(--tm-border)" : "none",
                }}
              >
                <span
                  style={{
                    flex: "1 1 auto",
                    minWidth: 0,
                    fontSize: "12.5px",
                    color: "var(--tm-ink)",
                    lineHeight: 1.4,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {m.text}
                </span>
                <span
                  style={{
                    flex: "none",
                    fontSize: "10px",
                    fontWeight: 600,
                    color: SEMANTIC.missing.ink,
                    background: SEMANTIC.missing.bg,
                    border: `0.5px solid ${SEMANTIC.missing.border}`,
                    borderRadius: "999px",
                    padding: "3px 9px",
                    whiteSpace: "nowrap",
                  }}
                >
                  + {m.hint}
                </span>
              </li>
            ))}
          </ul>
          {!!a.needsMetricMore && a.needsMetricMore > 0 && (
            <p className="tm-small" style={{ marginTop: "8px", fontSize: "11.5px", color: "var(--tm-zinc)" }}>
              + {a.needsMetricMore} more line{a.needsMetricMore === 1 ? "" : "s"} without a number.
              Tailoring adds one only where your work genuinely supports it.
            </p>
          )}
        </div>
      )}

      {/* GREEN — figures already in the resume (summary, awards, bullets): material
          to weave into the lines above. Compact chips, not big boxes. */}
      {hasStats && (
        <div>
          <EvidenceGroupLabel tone="present" icon={<Check size={12} />}>
            Numbers already in your resume ({a.stats!.length})
          </EvidenceGroupLabel>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", marginTop: "8px" }}>
            {a.stats!.map((s, i) => (
              <span
                key={i}
                style={{
                  display: "inline-flex",
                  alignItems: "baseline",
                  gap: "5px",
                  maxWidth: "100%",
                  borderRadius: "8px",
                  background: SEMANTIC.present.bg,
                  border: `0.5px solid ${SEMANTIC.present.border}`,
                  padding: "5px 10px",
                }}
              >
                <b style={{ fontSize: "12px", fontWeight: 600, color: SEMANTIC.present.ink }}>
                  {s.value}
                </b>
                <span className="tm-small" style={{ fontSize: "11px" }}>{s.label}</span>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* example — one vague line rewritten with its own numbers */}
      {(a.before || a.after) && (
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          <span
            style={{
              fontSize: "11px",
              fontWeight: 600,
              letterSpacing: "0.04em",
              textTransform: "uppercase",
              color: "var(--tm-zinc)",
            }}
          >
            Example rewrite
          </span>
          {a.before && (
            <div style={{ borderRadius: "10px", border: "0.5px solid var(--tm-border)", padding: "10px 12px", background: "#fff" }}>
              <span style={{ fontSize: "10px", fontWeight: 600, letterSpacing: ".06em", color: "var(--tm-zinc)" }}>
                BEFORE
              </span>
              <p style={{ marginTop: "3px", fontSize: "13px", color: "var(--tm-zinc)", lineHeight: 1.5 }}>
                {a.before}
              </p>
            </div>
          )}
          {a.after && (
            <div style={{ borderRadius: "10px", border: `0.5px solid ${SEMANTIC.present.border}`, padding: "10px 12px", background: SEMANTIC.present.bg }}>
              <span style={{ fontSize: "10px", fontWeight: 600, letterSpacing: ".06em", color: SEMANTIC.present.ink }}>
                AFTER
              </span>
              <p style={{ marginTop: "3px", fontSize: "13px", color: "var(--tm-ink)", lineHeight: 1.5 }}>
                {a.after}
              </p>
            </div>
          )}
        </div>
      )}

      {/* Fallback amber callout when we know the count but not the exact lines
          (e.g. a résumé with no bullet markers to read). */}
      {gap > 0 && !hasNeeds && (
        <div
          style={{
            borderRadius: "10px",
            border: `0.5px dashed ${SEMANTIC.missing.border}`,
            background: SEMANTIC.missing.bg,
            padding: "10px 12px",
          }}
        >
          <EvidenceGroupLabel tone="missing" icon={<Plus size={12} />}>
            {gap} bullets have no number yet
          </EvidenceGroupLabel>
          <p className="tm-small" style={{ marginTop: "8px", fontSize: "11.5px", color: "var(--tm-zinc)" }}>
            These lines state activity with no result. Tailoring adds a number only where your work
            genuinely supports it.
          </p>
        </div>
      )}

      {total === 0 && !a.before && !a.after && !hasStats && (
        <p className="tm-small" style={{ fontSize: "12.5px", lineHeight: 1.5 }}>
          No quantified outcomes found in your resume yet. Max flags the lines that state
          activity without a result, so you know exactly where to add the numbers.
        </p>
      )}
    </div>
  );
}

function RankingEvidence({ a }: { a: AuditAgent }) {
  const lines = a.lines ?? [];
  const anyReason = lines.some((l) => !!l.reason);
  if (lines.length === 0)
    return (
      <p className="tm-small" style={{ fontSize: "12.5px" }}>
        Line ranking wasn’t available for this run.
      </p>
    );
  return (
    <>
      <p
        className="tm-small"
        style={{ fontSize: "11.5px", lineHeight: 1.5, color: "var(--tm-zinc)", marginBottom: "12px" }}
      >
        Lines pulled straight from{" "}
        <b style={{ color: "var(--tm-ink)", fontWeight: 600 }}>your resume</b>, each scored 0&ndash;100
        for how well it matches this posting.
        {anyReason && " The note under each line is the reviewer's reason."}
      </p>
      <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
      {lines.map((l) => {
        const st = RANK_STATUS[l.status];
        return (
          <div key={l.rank}>
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
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
                  fontWeight: 500,
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
            {l.reason && (
              <p
                style={{
                  margin: "4px 0 0 26px",
                  paddingLeft: "10px",
                  borderLeft: "2px solid var(--tm-gray)",
                  fontSize: "12px",
                  lineHeight: 1.45,
                  color: "var(--tm-slate)",
                }}
              >
                {l.reason}
              </p>
            )}
          </div>
        );
      })}
      </div>
    </>
  );
}

// Persona icons mirror the landing page's "meet the agents" trio (Search /
// TrendingUp / Target) so the avatar a user saw there is the same one here.
const AGENT_VISUALS: Record<AuditAgent["id"], { icon: typeof Search }> = {
  ats: { icon: Search },
  impact: { icon: TrendingUp },
  rolefit: { icon: Target },
};

// One headline number per agent for its gallery card, derived from the SAME
// evidence the drawer shows so the card and detail can never disagree.
function agentBig(a: AuditAgent): { value: string; label: string } {
  if (a.kind === "coverage") {
    const matched = a.matched ?? a.keywords?.filter((k) => k.matched).length ?? 0;
    const total = a.total ?? a.keywords?.length ?? 0;
    return { value: `${matched}/${total}`, label: "keywords matched" };
  }
  if (a.kind === "impact") {
    const q = a.quantified;
    if (q) {
      const gap = Math.max(0, q.total - q.count);
      return { value: String(gap), label: gap === 1 ? "bullet needs a number" : "bullets need a number" };
    }
    return { value: String(a.stats?.length ?? 0), label: "metrics found" };
  }
  const lines = a.lines ?? [];
  const kept = lines.filter((l) => l.status === "kept-top" || l.status === "kept").length;
  const trimmed = lines.length - kept;
  return { value: String(kept), label: trimmed ? `lines kept, ${trimmed} trimmed` : "lines kept" };
}

// The selected agent's evidence in the drawer — reuses the per-kind renderers so
// there's a single source of truth for each layout.
function AgentDrawerBody({ a }: { a: AuditAgent }) {
  const ac = ACCENT[a.accent];
  return (
    <div className="tmAg-dbody">
      <div className="tmAg-dtitle">
        <b>{a.title}</b>
        <p>{a.subtitle}</p>
      </div>
      {a.kind === "coverage" && <CoverageEvidence a={a} />}
      {a.kind === "impact" && <ImpactEvidence a={a} />}
      {a.kind === "ranking" && <RankingEvidence a={a} />}
      {a.footer && (
        <p className="tmAg-action" style={{ color: ac.ink }}>
          {a.footer}
        </p>
      )}
      <DeepDive label={`How ${a.persona} read it`}>
        <p className="tm-small" style={{ fontSize: "13px", lineHeight: 1.55, color: "var(--tm-ink)" }}>
          {a.detail}
        </p>
      </DeepDive>
    </div>
  );
}

// Agent gallery: a compact card per specialist; tap one to open its evidence in
// the drawer below (a tab/panel pattern). Cards stagger in for a smooth reveal,
// and the drawer re-keys so it fades when you switch agents.
function AgentGallery({ agents }: { agents: AuditAgent[] }) {
  const [activeId, setActiveId] = useState<AuditAgent["id"]>(agents[0].id);
  const active = agents.find((a) => a.id === activeId) ?? agents[0];
  const activeAc = ACCENT[active.accent];
  const ActiveIcon = AGENT_VISUALS[active.id].icon;
  return (
    <>
      <div className="tmAg-gallery">
        {agents.map((a, i) => {
          const ac = ACCENT[a.accent];
          const Icon = AGENT_VISUALS[a.id].icon;
          const big = agentBig(a);
          const isOn = a.id === activeId;
          return (
            <button
              key={a.id}
              type="button"
              className={"tmAg-card" + (isOn ? " is-on" : "")}
              style={
                {
                  "--ag-tint": ac.tint,
                  "--ag-ink": ac.ink,
                  "--ag-solid": ac.solid,
                  animationDelay: `${i * 70}ms`,
                } as CSSProperties
              }
              onClick={() => setActiveId(a.id)}
              aria-expanded={isOn}
            >
              <span className="tmAg-card-top">
                <span className="tmAg-avatar" style={{ background: ac.tint, color: ac.ink }}>
                  <Icon size={18} />
                </span>
                <span className="tmAg-card-id">
                  <b>{a.persona}</b>
                  <span>{a.archetype}</span>
                </span>
              </span>
              <span className="tmAg-card-big">
                <span className="tmAg-card-num">{big.value}</span>
                <span className="tmAg-card-lab">{big.label}</span>
              </span>
              <span className="tmAg-card-more">
                {isOn ? "Hide evidence" : "See evidence"}
                <ChevronDown size={15} className="tmAg-card-chev" />
              </span>
            </button>
          );
        })}
      </div>
      <div
        key={active.id}
        className="tmAg-drawer"
        style={
          {
            "--ag-tint": activeAc.tint,
            "--ag-ink": activeAc.ink,
            "--ag-solid": activeAc.solid,
          } as CSSProperties
        }
      >
        <div className="tmAg-dhead">
          <span className="tmAg-avatar" style={{ background: "#fff", color: activeAc.ink }}>
            <ActiveIcon size={18} />
          </span>
          <span className="tmAg-dhead-id">
            <b>{active.persona}</b> <span>· {active.archetype}</span>
          </span>
          <span className="tmAg-dhead-spec">{active.specialty}</span>
        </div>
        <AgentDrawerBody a={active} />
      </div>
    </>
  );
}

function AgentAudit({
  agents,
  sample,
}: {
  agents: AuditAgent[];
  sample?: boolean;
}) {
  if (!agents || agents.length === 0) return null;
  const galleryKey = agents.map((a) => `${a.id}:${a.title}:${a.footer}`).join("|");
  return (
    <div className="tm-card" style={{ padding: "22px 24px" }}>
      <div className="tmAg-head">
        <span className="tmB-ev-head">
          <Sparkles size={14} /> What your {agents.length} specialists found
          {sample ? " (sample)" : ""}
        </span>
        <span className="tmAg-hint">tap a specialist</span>
      </div>
      <AgentGallery key={galleryKey} agents={agents} />
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
    reads: "Reads your resume like an ATS system",
    kind: "coverage",
    title: "Keyword coverage",
    subtitle: "how many keywords your resume covers from the posting",
    footer: "",
    detail:
      "Ada matches the posting's must-have keywords against your resume and counts the hits. Missing terms are the biggest ATS risk; tailoring adds them only where your experience backs them.",
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
    reads: "Reads your resume looking for quantified results",
    kind: "impact",
    title: "Quantified impact",
    subtitle: "how many of your bullets can be quantified (backed by a number)",
    footer: "",
    detail:
      "Max scans every line for a measurable outcome and rewrites activity into results, using only numbers already in your resume. It never invents a figure.",
    quantified: { count: 5, total: 9 },
    before: "Improved checkout performance and mentored the team.",
    after: "Cut p95 latency 38% across 2.4M daily txns; mentored 6 engineers.",
    stats: [
      { value: "38%", label: "lower p95 latency" },
      { value: "2.4M", label: "daily transactions" },
      { value: "6", label: "engineers mentored" },
      { value: "52%", label: "faster deploys" },
    ],
    needsMetric: [
      { text: "Led the migration to a new observability stack.", hint: "team size or # of people" },
      { text: "Improved checkout reliability for the platform team.", hint: "% change or time saved" },
      { text: "Built internal tools to streamline deploys.", hint: "count or scale" },
      { text: "Supported enterprise customers through onboarding.", hint: "# of accounts or volume" },
    ],
    needsMetricMore: 0,
  },
  {
    id: "rolefit",
    persona: "Remy",
    archetype: "The Hiring Manager",
    specialty: "Role-fit",
    accent: "navy",
    reads: "Reads your resume like a hiring manager",
    kind: "ranking",
    title: "Your bullets, ranked",
    subtitle: "how relevant each of your bullets is to this role, strongest kept",
    footer: "",
    detail:
      "Remy scores every line 0–100 for relevance to this posting, keeps the strongest, and trims the lowest to hold two pages, by relevance and never by age.",
    lines: [
      { rank: 1, label: "Distributed systems", score: 96, status: "kept-top", reason: "Directly matches the posting's distributed-systems and scale focus." },
      { rank: 2, label: "Kubernetes standards", score: 88, status: "kept", reason: "Hits a named must-have keyword (Kubernetes)." },
      { rank: 3, label: "Mentored 6 engineers", score: 79, status: "kept", reason: "Backs the posting's leadership and mentoring requirement." },
      { rank: 4, label: "Frontend (React) work", score: 41, status: "trimmed", reason: "Only loosely related to this backend-platform role." },
      { rank: 5, label: "2014 PHP role", score: 18, status: "cut", reason: "No overlap with the posting's stack or responsibilities." },
    ],
  },
];

// Stash the paid-run inputs for the dedicated tailoring page. Shared by the
// audit results and the summary so the paid handoff payload stays identical.
interface TailorArgs {
  useSample: boolean;
  resumeText: string;
  postingText: string;
  proofPoints: ProofPoint[];
  resumeId: string | null;
  role?: string; // target role (+ company) label, shown on the tailoring loader
}
function stashTailor(args: TailorArgs): void {
  try {
    sessionStorage.setItem("tm_tailor", JSON.stringify(args));
  } catch {
    /* ignore */
  }
}

// The paid "tailor for this job" run / signed-out account gate. Reused by the
// audit results and the summary so the upsell reads the same in both places.
export function TailorGate({
  user,
  onRunFull,
}: {
  user: { name: string } | null;
  onRunFull: () => void;
}) {
  return user ? (
    <div className="tm-card tmF-gate" style={{ padding: "30px" }}>
      <span className="tm-pill tm-pill--mint">
        <Check size={12} /> signed in as {user.name}
      </span>
      <h3>Tailor this application</h3>
      <p>
        We’ll rewrite every bullet for this posting and compile your resume +
        cover letter, building on the review above.
      </p>
      <button
        type="button"
        className="tm-btn tm-btn--primary tm-btn--lg"
        onClick={() => {
          track("tailor_click");
          onRunFull();
        }}
      >
        Tailor my application · 1 credit
      </button>
      <p className="tm-small" style={{ fontSize: "12px" }}>
        Uses <span className="tm-m">1 credit</span> · your first is free · credits
        never expire
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
        report. Your first application is free, no card required.
      </p>
      <Link className="tm-btn tm-btn--primary tm-btn--lg" href={ROUTES.signIn}>
        Create free account
      </Link>
      <p className="tm-small" style={{ fontSize: "12px" }}>
        Encrypted at rest · delete everything in one click
      </p>
    </div>
  );
}

// Merge EVERYTHING the audit surfaced into one suggestion list — the parse fixes
// plus the Job Score's missing keywords plus each agent's evidence (Ada's missing
// terms, Max's un-quantified bullets, Remy's low-relevance lines). This is the
// payload the editor's Suggestions panel receives, so "open in editor" carries the
// whole report, not just the parse pass. Deduped by title; capped implicitly.
function buildCombinedProofPoints({
  base,
  fitView,
  agents,
}: {
  base: ProofPoint[];
  fitView: FitView | null;
  agents: AuditAgent[] | null;
}): ProofPoint[] {
  const out: ProofPoint[] = [...base];
  const seen = new Set(out.map((p) => p.title.toLowerCase()));
  const push = (p: ProofPoint) => {
    const key = p.title.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    out.push(p);
  };

  // Missing keywords — prefer Ada's coverage list, fall back to the Job Score.
  const ada = agents?.find((a) => a.kind === "coverage");
  const missFromAda = (ada?.keywords ?? []).filter((k) => !k.matched).map((k) => k.name);
  const missFromFit = (fitView?.keywords ?? []).filter((k) => !k.inResume).map((k) => k.term);
  const missingKw = (missFromAda.length ? missFromAda : missFromFit).slice(0, 12);
  if (missingKw.length) {
    push({
      title: `Add ${missingKw.length} keyword${missingKw.length > 1 ? "s" : ""} the posting screens for`,
      summary: missingKw.join(", "),
      why: "ATS filters and recruiters look for these exact terms. Your resume doesn't name them yet, so it can be screened out before a person reads it.",
      fix: `Work these into your experience and skills where they genuinely apply: ${missingKw.join(", ")}.`,
      severity: "high",
      category: "keywords",
      targetSection: "skills",
    });
  }

  // Bullets with no number (Max's gap).
  const max = agents?.find((a) => a.kind === "impact");
  const gap = Math.max(0, (max?.quantified?.total ?? 0) - (max?.quantified?.count ?? 0));
  if (gap > 0) {
    push({
      title: `Quantify ${gap} bullet${gap > 1 ? "s" : ""} with no number`,
      summary: "Lines that state activity without a measurable result.",
      why: "Bullets without a number read as tasks, not impact. Recruiters skim for figures — percentages, dollars, counts, time saved.",
      fix: "Add a metric to each (scale, speed, money, or volume) only where your real work supports it.",
      severity: "medium",
      category: "impact",
      targetSection: "experience",
    });
  }

  // Low-relevance bullets to trim/cut (Remy).
  const remy = agents?.find((a) => a.kind === "ranking");
  const weak = (remy?.lines ?? []).filter((l) => l.status === "trimmed" || l.status === "cut");
  if (weak.length) {
    push({
      title: `Trim ${weak.length} low-relevance bullet${weak.length > 1 ? "s" : ""}`,
      summary: weak.map((l) => l.label).join("; "),
      why: "These lines score low for this posting and push your strongest, on-target experience further down the page.",
      fix: "Cut or shorten them so the bullets that match this role lead each section.",
      severity: "low",
      category: "rolefit",
      targetSection: "experience",
    });
  }

  return out;
}

// ---------- Step 4: Summary — all the advice in one place + free editor handoff ----------
function StepSummary({
  stats,
  fitView,
  auditAgents,
  auditSample,
  resumeText,
  useSample,
  posting,
  resumeId,
}: {
  stats: ResumeStats | null;
  fitView: FitView | null;
  auditAgents: AuditAgent[] | null;
  auditSample: boolean;
  resumeText: string;
  useSample: boolean;
  posting: string;
  resumeId: string | null;
}) {
  const router = useRouter();
  const { user } = useSession();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Signed-out summary still shows the download gate → it's a paywall view.
  useEffect(() => {
    if (!user) track("paywall_seen", { trigger: "download" });
  }, [user]);

  // Trust layer: only surface findings that are real (evidence verifiable in the
  // résumé text) and not about template-owned layout/formatting/ATS. Same screen
  // the editor uses, so the audit promises what the editor will actually show.
  const proofPoints = groundFindings(
    useSample ? SAMPLE_PROFILE.proofPoints ?? [] : stats?.proofPoints ?? [],
    normalizeForMatch(resumeText ?? ""),
    { templated: true },
  );
  const name = useSample ? SAMPLE_PROFILE.name : stats?.name;
  // The unified handoff: parse fixes + Job Score + agent findings as ONE list.
  const combinedSuggestions = buildCombinedProofPoints({
    base: proofPoints,
    fitView,
    agents: auditAgents ?? (useSample || auditSample ? DEMO_AGENTS : null),
  });

  // Free on-ramp: structure the resume, then stash it as a scored local
  // application and open the SAME editor the paid path uses. The fixes are
  // staged in the Suggestions panel (not pre-applied) and the fit score shows
  // read-only with the coaching pitch. No credit, no sign-in. Demo (no LLM)
  // falls back to a saved/sample doc.
  const openEditor = async () => {
    setError(null);
    setBusy(true);
    try {
      let doc: TailoredDoc | null = null;
      if (useSample) {
        doc = SAMPLE_DOC;
      } else {
        const res = await fetch("/api/resume/structure", {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-tm-session": getSessionId() ?? "" },
          body: JSON.stringify({ text: resumeText }),
        });
        const data = await res.json().catch(() => ({}));
        if (data.demo) doc = (await loadBaseResumeDoc()) ?? SAMPLE_DOC;
        else if (res.ok && data.doc) doc = data.doc as TailoredDoc;
        else throw new Error(data.error || "Couldn’t open the editor. Try again.");
      }
      const [rolePart, companyPart] = (fitView?.header ?? "Target role").split(" · ");
      const app = saveLocalApplication(
        {
          company: (companyPart ?? "").trim(),
          role: (rolePart ?? "Target role").trim(),
          fit: fitViewToBreakdown(fitView),
          bullets: [],
          keywords: fitView?.keywords?.map((k) => k.term) ?? [],
          agentNotes: [],
          agents: auditAgents ?? (useSample || auditSample ? DEMO_AGENTS : undefined),
          doc,
          postingText: posting,
          proofPoints: combinedSuggestions,
        },
        resumeId,
      );
      router.push(`/applications/${app.id}/edit`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn’t open the editor. Try again.");
      setBusy(false);
    }
  };

  const runFull = () => {
    track("tailor_click", { source: "audit_summary" });
    stashTailor({
      useSample,
      resumeText,
      postingText: posting,
      proofPoints: stats?.proofPoints ?? [],
      resumeId,
      role: fitView?.header,
    });
    router.push("/applications/tailoring");
  };

  // Distilled buckets: what's strong + what to change (counts). The full fix list
  // and missing-keyword chips live in the editor, so they're not repeated here.
  const matchedKw = fitView?.keywords?.filter((k) => k.inResume) ?? [];
  // Strongest dimensions (solid or better), best first — the evidence behind the
  // score, shown with their own mini bars.
  const bestDims = [...(fitView?.dims ?? [])]
    .filter((d) => d.score >= 62)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);
  const quantified = stats?.metricBullets ?? 0;
  // Up to three already-quantified bullets, verbatim, so "N bullets carry a metric"
  // reads as real proof rather than just a count.
  const strongExamples = (stats?.sampleBullets ?? [])
    .filter((s) => s.hasMetric && s.text?.trim())
    .slice(0, 3)
    .map((s) => {
      const t = s.text.trim();
      return t.length > 120 ? `${t.slice(0, 117).trimEnd()}…` : t;
    });
  const hasStrengths = matchedKw.length > 0 || bestDims.length > 0 || quantified > 0;
  const changeGroups: [ProofPoint["severity"], ProofPoint[]][] = [
    ["high", proofPoints.filter((p) => p.severity === "high")],
    ["medium", proofPoints.filter((p) => p.severity === "medium")],
    ["low", proofPoints.filter((p) => p.severity === "low")],
  ];

  return (
    <div className="flex flex-col gap-[20px]">
      {/* recap — lead with the job being assessed, then the fit score. Centered. */}
      <div className="tm-card tmSum-verdict">
        {fitView ? (
          (() => {
            const t = fitTheme(fitView.overall);
            return (
              <>
                <span className="tmF-p2-label">
                  {name ? `${name}, your fit for` : "Your fit for"}
                </span>
                <p className="tmSum-verdict-role">{fitView.header}</p>
                <div className="tmSum-verdict-score">
                  <span className="tmSum-verdict-num" style={{ color: t.ring }}>
                    {fitView.overall}
                  </span>
                  <span className="tmSum-verdict-of">/ 100</span>
                  {fitView.verdict && (
                    <span
                      className="tm-pill"
                      style={{
                        fontSize: "12px",
                        fontWeight: 600,
                        background: t.card,
                        color: t.ink,
                        border: `0.5px solid ${t.border}`,
                      }}
                    >
                      {fitView.verdict}
                    </span>
                  )}
                </div>
              </>
            );
          })()
        ) : (
          <>
            <span className="tmF-p2-label">
              {name ? `${name}, here’s your summary` : "Your audit summary"}
            </span>
            <p className="tmSum-verdict-role">{posting ? "Your target posting" : "Your resume"}</p>
          </>
        )}
        {(auditSample || useSample) && (
          <p className="tmS-free" style={{ marginTop: "6px", display: "block" }}>
            This is a sample result.{" "}
            <Link href={ROUTES.signIn} style={{ color: "var(--tm-mint-600)", textDecoration: "underline" }}>
              create a free account
            </Link>{" "}
            to run your own.
          </p>
        )}
      </div>

      {/* 1 · what's strong (keep) */}
      {hasStrengths && (
        <div className="tm-card tmSum-card tmSum-card--good">
          <div className="tmSum-head">
            <Check size={15} style={{ color: "var(--tm-mint-600)" }} />
            <b>What&apos;s strong</b>
            <span className="tmSum-sub">keep these, tailoring leaves them alone</span>
          </div>
          {bestDims.length > 0 && (
            <div className="tmSum-block">
              <span className="tmSum-blocklabel">Where you score best</span>
              <div className="tmSum-strong-dims">
                {bestDims.map((d) => {
                  const b = band(d.score);
                  return (
                    <div key={d.label} className="tmSum-dimrow">
                      <span className="tmSum-dimlabel">{d.label}</span>
                      <span className="tmSum-dimtrack">
                        <span
                          className="tmSum-dimfill"
                          style={{ width: `${d.score}%`, background: b.bar }}
                        />
                      </span>
                      <span className="tmSum-dimscore">{d.score}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
          {matchedKw.length > 0 && (
            <div className="tmSum-block">
              <span className="tmSum-blocklabel">Keywords you already match ({matchedKw.length})</span>
              <div className="tmSum-pills">
                {matchedKw.slice(0, 10).map((k) => (
                  <span key={k.term} className="tm-pill tm-pill--mint" style={{ fontSize: "11px" }}>
                    <Check size={11} /> {k.term}
                  </span>
                ))}
                {matchedKw.length > 10 && (
                  <span className="tm-pill tm-pill--gray" style={{ fontSize: "11px" }}>
                    +{matchedKw.length - 10} more
                  </span>
                )}
              </div>
            </div>
          )}
          {strongExamples.length > 0 && (
            <div className="tmSum-block">
              <span className="tmSum-blocklabel">
                Already quantified ({quantified} bullet{quantified === 1 ? "" : "s"})
              </span>
              <ul className="tmSum-egs">
                {strongExamples.map((eg, i) => (
                  <li key={i} className="tmSum-eg">
                    “{eg}”
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* 2 · what to quantify */}
      {/* 3 · what to change (rewrite/fix) */}
      {proofPoints.length > 0 && (
        <div className="tm-card tmSum-card" style={{ gap: "14px" }}>
          <div>
            <div className="tmSum-head">
              <PenLine size={15} style={{ color: "#854f0b" }} />
              <b>What to change</b>
              <span className="tmSum-count">
                {proofPoints.length} fix{proofPoints.length === 1 ? "" : "es"}
              </span>
            </div>
            <p className="tmSum-sub" style={{ marginTop: "4px" }}>
              Your top fix is below. Open the editor to work through all {proofPoints.length}. Each is
              tagged with its section and applies in a click.
            </p>
          </div>
          {(() => {
            const top = changeGroups.find(([, items]) => items.length > 0)?.[1][0];
            return top ? <ProofPointCard p={top} /> : null;
          })()}
          {proofPoints.length > 1 && (
            <div className="tmSum-pills">
              {changeGroups
                .filter(([, items]) => items.length > 0)
                .map(([sev, items]) => (
                  <span
                    key={sev}
                    className="tm-pill"
                    style={{
                      fontSize: "11px",
                      fontWeight: 600,
                      color: SEV_COLOR[sev],
                      background: "var(--tm-gray)",
                    }}
                  >
                    {items.length} {SEV_LABEL[sev].toLowerCase()}
                  </span>
                ))}
            </div>
          )}
        </div>
      )}

      {/* The full fix list + missing-keyword chips live in the editor's Feedback
          tab (and the agent breakdown on the previous step), so the Summary stays
          a distilled recap + handoff rather than repeating them here. */}

      {/* Two on-ramps into the SAME editor — the choice is who makes the edits. */}
      <div className="tm-card tmF-gate">
        <span className="tm-pill tm-pill--mint">
          <Check size={12} />{" "}
          {combinedSuggestions.length > 0
            ? `${combinedSuggestions.length} suggestion${combinedSuggestions.length === 1 ? "" : "s"} ready`
            : "Your full report"}
        </span>
        <h3>Take it into the editor</h3>
        <p className="tmF-gate-sub">
          Both open the same editor, with your fit score and every suggestion. The only choice is
          who makes the edits.
        </p>
        <div className="tmF-onramps">
          <div className="tmF-onramp is-primary">
            <span className="tmF-onramp-tag">
              <Sparkles size={13} /> AI does it
            </span>
            <b className="tmF-onramp-title">Build the tailored draft</b>
            <p className="tmF-onramp-desc">
              {combinedSuggestions.length > 0
                ? `We apply all ${combinedSuggestions.length} fix${combinedSuggestions.length === 1 ? "" : "es"} for you, then you review every change and adjust.`
                : "We tailor your resume to the job, then you review every change and adjust."}
            </p>
            {user ? (
              <button type="button" className="tm-btn tm-btn--primary tm-btn--lg" onClick={runFull}>
                Build tailored draft <ArrowRight size={15} />
              </button>
            ) : (
              <Link className="tm-btn tm-btn--primary tm-btn--lg" href={ROUTES.signIn}>
                Create free account <ArrowRight size={15} />
              </Link>
            )}
          </div>
          <div className="tmF-onramp">
            <span className="tmF-onramp-tag">
              <PenLine size={13} /> You do it
            </span>
            <b className="tmF-onramp-title">Open the editor yourself</b>
            <p className="tmF-onramp-desc">
              {combinedSuggestions.length > 0
                ? `All ${combinedSuggestions.length} suggestion${combinedSuggestions.length === 1 ? "" : "s"} are staged. Apply them at your own pace, line by line.`
                : "Edit your resume at your own pace, with suggestions on hand."}
            </p>
            <button
              type="button"
              className="tm-btn tm-btn--outline tm-btn--lg"
              onClick={() => void openEditor()}
              disabled={busy}
            >
              {busy ? "Opening..." : "Open editor"}
            </button>
          </div>
        </div>
        {busy && (
          <div style={{ display: "flex", alignItems: "center", gap: "10px", marginTop: "4px" }}>
            <style>{`@keyframes tmspin{to{transform:rotate(360deg)}}`}</style>
            <span
              aria-hidden="true"
              style={{
                height: "16px",
                width: "16px",
                flex: "none",
                borderRadius: "50%",
                border: "2px solid var(--tm-blue-50)",
                borderTopColor: "var(--tm-blue-600)",
                animation: "tmspin .8s linear infinite",
              }}
            />
            <span className="tm-small" style={{ fontSize: "12px" }}>
              Structuring your resume into the editor… this can take a few seconds.
            </span>
          </div>
        )}
        {error && (
          <p className="tm-small" style={{ color: "#b3261e", marginTop: "4px" }}>
            {error}
          </p>
        )}
      </div>

      {/* secondary upsell: human pass */}
      <MichaelPitch />
    </div>
  );
}

// Entry chooser: the ways to start. Data-driven so cards are a one-line add.
const START_OPTIONS = [
  {
    id: "upload" as const,
    icon: FileText,
    title: "I already have a resume",
    blurb: "Upload it, get instant feedback, and tailor it to any job.",
    cta: "Upload my resume",
    route: "",
  },
  {
    id: "import" as const,
    icon: ClipboardPaste,
    title: "Import from LinkedIn",
    blurb: "Paste your LinkedIn profile or notes and we'll build a resume to edit.",
    cta: "Paste from LinkedIn",
    route: ROUTES.resumeImport,
  },
  {
    id: "scratch" as const,
    icon: PenLine,
    title: "I need to create a resume",
    blurb: "Start with guided sections and build a resume before targeting jobs.",
    cta: "Build from scratch",
    route: ROUTES.resumeNew,
  },
];

function StartChooser({ onUpload }: { onUpload: () => void }) {
  const router = useRouter();
  return (
    <Fragment>
      <section className="tm-sec tmF-head" style={{ paddingBottom: 0 }}>
        <h1 className="tm-h1">How would you like to start?</h1>
        <p className="tm-body">
          Three ways in. Same editor, same three-agent review.
        </p>
      </section>
      <section className="tm-sec" style={{ paddingTop: 24 }}>
        <div className="tmF-start">
          {START_OPTIONS.map((o) => {
            const Icon = o.icon;
            return (
              <button
                key={o.id}
                type="button"
                className="tmF-start-card"
                onClick={() => {
                  track("chooser_select", { choice: o.id });
                  if (o.id === "scratch") track("start_from_scratch");
                  if (o.id === "upload") onUpload();
                  else router.push(o.route);
                }}
              >
                <span className="tmF-start-ic">
                  <Icon size={22} />
                </span>
                <b>{o.title}</b>
                <span className="tmF-start-blurb">{o.blurb}</span>
                <span className="tmF-start-cta">
                  {o.cta} <ArrowRight size={15} />
                </span>
              </button>
            );
          })}
        </div>
      </section>
    </Fragment>
  );
}

export default function AuditWizard() {
  const search = useSearchParams();
  // /audit?from=base seeds the resume from a base resume (handed off via
  // sessionStorage) and jumps straight to the job step. /audit?start=upload
  // skips the chooser. (This component is client-rendered under Suspense, so
  // reading sessionStorage in the initializers is safe — no SSR/hydration.)
  const fromBase = search.get("from") === "base";
  const seededResume = fromBase ? loadTargetResume() : "";
  const seededResumeId = fromBase ? loadTargetResumeId() : null;
  const [step, setStep] = useState(seededResume ? 1 : 0);
  const [mode, setMode] = useState<"choose" | "upload">(
    fromBase || search.get("start") === "upload" ? "upload" : "choose",
  );
  const [resumeText, setResumeText] = useState(seededResume);
  // Captured once on mount so a later target-resume clear can't null it before the run.
  const [resumeId] = useState<string | null>(seededResumeId);
  const [useSample, setUseSample] = useState(false);
  const [stats, setStats] = useState<ResumeStats | null>(null);
  const [posting, setPosting] = useState("");
  // Lifted from StepJob / StepResults so the Summary step can consolidate the
  // fit score and the agent findings without re-running either.
  const [fitView, setFitView] = useState<FitView | null>(null);
  const [auditAgents, setAuditAgents] = useState<AuditAgent[] | null>(null);
  const [auditSample, setAuditSample] = useState(false);

  // from=base seeds only the resume TEXT; the rich structured doc lives in the
  // saved base resume. Derive stats from that doc so the profile tiles and the
  // Summary read real numbers (not zeros) if the user steps back to "Your resume".
  useEffect(() => {
    if (!fromBase || !seededResume) return;
    let active = true;
    void loadBaseResumeDoc().then((doc) => {
      if (active && doc) setStats((prev) => (statsAreEmpty(prev) ? statsFromDoc(doc) : prev));
    });
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  if (mode === "choose") {
    return <StartChooser onUpload={() => setMode("upload")} />;
  }

  return (
    <Fragment>
      <section ref={headRef} className="tm-sec tmF-head" style={{ paddingBottom: 0 }}>
        <h1 className="tm-h1">See what tailoring does to your resume</h1>
        <p className="tm-body">
          Three AI agents (ATS, impact, role-fit) score your resume against the
          role and return line-level fixes. First use is free.
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
              onScored={setFitView}
              onAudited={(a, s) => {
                setAuditAgents(a);
                setAuditSample(s);
              }}
            />
          )}
          {step === 2 && (
            <StepSummary
              stats={stats}
              fitView={fitView}
              auditAgents={auditAgents}
              auditSample={auditSample}
              resumeText={resumeText}
              useSample={useSample}
              posting={posting}
              resumeId={resumeId}
            />
          )}
          </div>
          {step < 2 && (
            <p
              className="tm-small mt-[16px] cursor-pointer text-center"
              onClick={() => (step === 0 ? setMode("choose") : setStep(step - 1))}
            >
              ← back
            </p>
          )}
        </div>
      </section>
    </Fragment>
  );
}
