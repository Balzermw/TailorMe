"use client";

// Free audit wizard — clickable 3-step flow, all simulated.
// Step 1 upload+parse → Step 2 posting+fit score → Step 3 watermarked results + account gate.
// Ported verbatim from the design handoff (tm-page-audit.jsx).

import { Fragment, useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  Briefcase,
  Check,
  List,
  PenLine,
  Plus,
  Sparkles,
  TrendingUp,
  Upload,
  User,
} from "lucide-react";
import { AGENTS_FULL, ROUTES, SCORES } from "@/components/landing/data";

// Per-dimension evidence for the fit score — what matched and what's missing.
const FIT_WHY: { plus: string[]; minus: string[] }[] = [
  {
    // Technical skills · 88
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
    // Experience match · 80
    plus: [
      "7 years senior-level vs 5+ required",
      "Migration ownership maps directly to the role’s “own our platform evolution” mandate",
    ],
    minus: [
      "No formal platform-team title — your platform work is buried under a generic SWE heading",
    ],
  },
  {
    // Culture fit · 74
    plus: [
      "Mentoring 6 engineers matches the posting’s “grow the team” emphasis",
      "Code-review ownership signals the collaboration they ask for",
    ],
    minus: [
      "Little evidence of cross-team work in your current bullets — likely present, just unwritten",
    ],
  },
  {
    // Career alignment · 90
    plus: [
      "Natural next step: your last 3 years trend toward platform and infrastructure work",
      "The role’s scope matches the trajectory your bullets already show",
    ],
    minus: [],
  },
];

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

function StepUpload({ onNext }: { onNext: () => void }) {
  const [phase, setPhase] = useState<"idle" | "parsing" | "done">("idle");
  useEffect(() => {
    if (phase === "parsing") {
      const id = setTimeout(() => setPhase("done"), 1700);
      return () => clearTimeout(id);
    }
  }, [phase]);

  return (
    <div className="tm-card">
      {phase === "idle" && (
        <div>
          <button
            type="button"
            className="tmF-drop w-full"
            onClick={() => setPhase("parsing")}
          >
            <Upload size={26} strokeWidth={1.6} />
            <b>Drop your resume here</b>
            <span>PDF or Word · parsed once, encrypted at rest</span>
          </button>
          <p className="tmF-or">or</p>
          <button
            type="button"
            className="tm-btn tm-btn--outline w-full justify-center"
            onClick={() => setPhase("parsing")}
          >
            Try with the sample resume (Alex M.)
          </button>
        </div>
      )}
      {phase === "parsing" && (
        <div className="tmF-parse">
          <p className="tmF-parse-line">
            <Check size={14} /> Reading Resume_AlexM.pdf…
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
      {phase === "done" && (
        <div className="tmF-profile2">
          <div className="tmF-profile2-id">
            <div
              className="flex h-[64px] w-[64px] flex-none items-center justify-center rounded-full bg-[var(--tm-blue-50)] text-[var(--tm-blue-800)]"
              aria-hidden="true"
            >
              <User size={26} strokeWidth={1.6} />
            </div>
            <div>
              <b>Alex Mercer</b>
              <span className="tm-small mt-[2px] block">
                Senior Software Engineer · 7 yrs · sample profile
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
                    <b>2</b> roles, 2014 – present
                  </span>
                </span>
                <span className="tmF-p2-row">
                  <List size={15} />{" "}
                  <span>
                    <b>14</b> experience bullets
                  </span>
                </span>
                <span className="tmF-p2-row">
                  <TrendingUp size={15} />{" "}
                  <span>
                    <b>3</b> bullets with metrics
                  </span>
                </span>
              </div>
            </div>
            <div className="tmF-p2-group">
              <p className="tmF-p2-label">
                Skills found <span className="tmF-p2-count">11</span>
              </p>
              <div className="tmF-chips">
                {["React", "Node.js", "Kubernetes", "PostgreSQL", "Mentoring"].map(
                  (s) => (
                    <span key={s} className="tm-pill tm-pill--gray">
                      {s}
                    </span>
                  )
                )}
                <span className="tm-pill tm-pill--line">+6 more</span>
              </div>
            </div>
          </div>
          <div className="tmF-profile2-foot">
            <button
              type="button"
              className="tm-btn tm-btn--primary"
              onClick={onNext}
            >
              Next — pick the job <ArrowRight size={15} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function StepJob({ onNext }: { onNext: () => void }) {
  const [phase, setPhase] = useState<"idle" | "scoring" | "done">("idle");
  const [text, setText] = useState("");
  const [w, setW] = useState<number[]>([0, 0, 0, 0]);
  const [why, setWhy] = useState(0); // which dimension's evidence is open
  useEffect(() => {
    if (phase === "scoring") {
      const a = setTimeout(() => setW(SCORES.map((s) => s.v)), 250);
      const b = setTimeout(() => setPhase("done"), 1300);
      return () => {
        clearTimeout(a);
        clearTimeout(b);
      };
    }
  }, [phase]);

  const sample = "https://nordpeak.io/careers/senior-platform-engineer";
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
        value={text}
        placeholder="https://…  or paste the full posting"
        onChange={(e) => setText(e.target.value)}
      ></textarea>
      {phase === "idle" && (
        <div className="tmF-actions" style={{ justifyContent: "space-between" }}>
          <button
            type="button"
            className="tm-btn tm-btn--ghost"
            onClick={() => setText(sample)}
          >
            Use the sample posting
          </button>
          <button
            type="button"
            className="tm-btn tm-btn--primary"
            style={{
              opacity: text ? 1 : 0.45,
              pointerEvents: text ? "auto" : "none",
            }}
            onClick={() => setPhase("scoring")}
          >
            Score my fit <ArrowRight size={15} />
          </button>
        </div>
      )}
      {phase !== "idle" && (
        <div className="mt-[24px]">
          <div className="tm-fit tmF-fit">
            <div className="tm-fit-head">
              <h3>Senior Platform Engineer — Nordpeak Systems</h3>
              {phase === "done" && (
                <span className="tm-pill tm-pill--mint">84 — strong fit</span>
              )}
            </div>
            {SCORES.map((s, i) => (
              <div key={s.l}>
                <div
                  className={
                    "tm-fit-row tmF-why-row" +
                    (phase === "done" ? " is-clickable" : "")
                  }
                  onClick={() => phase === "done" && setWhy(why === i ? -1 : i)}
                >
                  <label>{s.l}</label>
                  <div className="tm-fit-track">
                    <div
                      className="tm-fit-bar"
                      style={{ width: w[i] + "%" }}
                    ></div>
                  </div>
                  <output>{phase === "done" ? s.v : ""}</output>
                  {phase === "done" && (
                    <span
                      className={
                        "tmF-why-toggle" + (why === i ? " is-open" : "")
                      }
                    >
                      <Plus size={13} />
                    </span>
                  )}
                </div>
                {phase === "done" && why === i && (
                  <div className="tmF-why">
                    {FIT_WHY[i].plus.map((p) => (
                      <p key={p} className="tmF-why-line is-plus">
                        <Check size={12} /> {p}
                      </p>
                    ))}
                    {FIT_WHY[i].minus.map((m) => (
                      <p key={m} className="tmF-why-line is-minus">
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
                  <span className="tm-pill tm-pill--mint">
                    <Check size={12} /> pass
                  </span>{" "}
                  posting allows Remote EU — your profile lists Copenhagen
                </span>
              ) : (
                <span className="tm-small">checking…</span>
              )}
            </div>
          </div>
          {phase === "done" && (
            <Fragment>
              <div className="tmF-verdict">
                <b>Why 84 — strong fit:</b> your platform work lines up with 4 of
                5 dimensions. The weakest one — culture fit — isn’t missing
                experience, it’s missing evidence in your bullets. That’s exactly
                what tailoring surfaces. Tap any dimension to see what we found.
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

function StepResults() {
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
            final draft and adds positioning notes for this specific role. Back
            in your inbox within 48 hours.
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
      <div className="tm-card tmF-gate" style={{ padding: "30px" }}>
        <span className="tm-pill tm-pill--mint">
          <Check size={12} /> your audit is ready
        </span>
        <h3>Create a free account to download it</h3>
        <p>
          The clean PDF, the cover letter, and the full line-by-line feedback
          report. Your first application is free — no card required.
        </p>
        <Link className="tm-btn tm-btn--primary tm-btn--lg" href={ROUTES.signIn}>
          <Sparkles size={16} /> Create free account
        </Link>
        <p className="tm-small" style={{ fontSize: "12px" }}>
          Encrypted at rest · delete everything in one click
        </p>
      </div>
    </div>
  );
}

export default function AuditWizard() {
  const [step, setStep] = useState(0);
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
          {step === 0 && <StepUpload onNext={() => setStep(1)} />}
          {step === 1 && <StepJob onNext={() => setStep(2)} />}
          {step === 2 && <StepResults />}
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
