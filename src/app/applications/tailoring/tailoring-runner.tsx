"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ROUTES } from "@/components/landing/data";
import { editHref } from "@/lib/apply/render";
import { saveLocalApplication } from "@/lib/local-applications";
import type { ApplyResult } from "@/lib/types";
import { track, getSessionId } from "@/lib/track";

// The audit step stashes the run inputs in sessionStorage and navigates here
// immediately, so the user never waits out the ~1-minute run on the results
// page. We run /api/apply (full) here, show staged progress, then drop straight
// into the editor when the document is ready.
const STAGES = [
  "Reading your resume and the job posting",
  "Matching your experience to the role",
  "Rewriting your bullets for this posting",
  "Compiling your resume and cover letter",
  "Running the final faithfulness check",
  "Polishing formatting and layout",
  "Almost there. Longer resumes take a little more time.",
];

export default function TailoringRunner() {
  const router = useRouter();
  const [stage, setStage] = useState(0);
  const [pct, setPct] = useState(12);
  const [error, setError] = useState<string | null>(null);
  const [role, setRole] = useState<string | null>(null);
  const started = useRef(false);

  // Progress ticker in its OWN effect so React StrictMode's mount→cleanup→mount
  // cycle re-creates it cleanly. (The work effect below is ref-guarded to run
  // once; putting the interval there left it cleared-and-never-recreated, which
  // froze the bar at its starting value while the request kept running.)
  useEffect(() => {
    const start = Date.now();
    const id = window.setInterval(() => {
      const t = Date.now() - start;
      // Climb briskly early, then ease toward ~94% and never hit 100% until the
      // doc is actually ready. (~37% at 2s, ~60% at 5s, ~80% at 12s.)
      setPct((p) => Math.max(p, Math.round(12 + 82 * (1 - Math.exp(-t / 13000)))));
      setStage(Math.min(Math.floor(t / 6000), STAGES.length - 1));
    }, 400);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    if (started.current) return; // run once (StrictMode double-mount guard)
    started.current = true;

    let raw: string | null = null;
    try {
      raw = sessionStorage.getItem("tm_tailor");
    } catch {
      raw = null;
    }
    if (!raw) {
      router.replace(ROUTES.audit);
      return;
    }
    let inputs: Record<string, unknown>;
    try {
      inputs = JSON.parse(raw) as Record<string, unknown>;
    } catch {
      router.replace(ROUTES.audit);
      return;
    }
    const targetRole = typeof inputs.role === "string" ? inputs.role.trim() : "";
    if (targetRole) queueMicrotask(() => setRole(targetRole));

    void (async () => {
      try {
        const res = await fetch("/api/apply", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-tm-session": getSessionId() ?? "",
          },
          body: JSON.stringify({ mode: "full", ...inputs }),
        });
        if (res.status === 401) {
          router.replace(ROUTES.signIn);
          return;
        }
        const data = await res.json();
        if (res.status === 429) {
          track("limit_hit", { feature: "tailor" });
          setError(data.error || "You’ve hit today’s limit. Please try again later.");
          return;
        }
        if (res.status === 402 || data.needCredits) {
          track("credit_gate_shown", { source: "tailor" });
          setError(data.error || "You’re out of credits.");
          return;
        }
        if (data.applicationId) {
          try {
            sessionStorage.removeItem("tm_tailor");
          } catch {
            /* ignore */
          }
          router.replace(editHref(data.applicationId as string));
          return;
        }
        // Local/demo mode (no account DB): persist the finished draft to
        // localStorage and open the editor, which reads from localStorage here.
        // (Account mode can't use this — its editor loads from the DB — so an
        // account persistence failure returns a 500 and falls through to a retry.)
        if (data.local && data.result?.doc) {
          const app = saveLocalApplication(
            data.result as ApplyResult,
            typeof inputs.resumeId === "string" ? inputs.resumeId : null,
          );
          try {
            sessionStorage.removeItem("tm_tailor");
          } catch {
            /* ignore */
          }
          router.replace(editHref(app.id));
          return;
        }
        if (data.demo) {
          setError("AI tailoring is not configured for this environment yet.");
          return;
        }
        // tm_tailor is intentionally NOT cleared here, so the error UI's "Try
        // again" (a reload) re-runs with the same inputs.
        setError(
          typeof data.error === "string"
            ? data.error
            : "The tailored draft didn’t come back. Please try again.",
        );
      } catch {
        setError("Something went wrong. Please try again.");
      }
    })();
  }, [router]);

  return (
    <section
      className="tm-sec"
      style={{
        minHeight: "62vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <div
        className="tm-card tmF-gate tmF-anim"
        style={{ padding: "46px 38px", alignItems: "center", maxWidth: 540 }}
      >
        <style>{`@keyframes tmspin{to{transform:rotate(360deg)}}`}</style>
        {error ? (
          <>
            <h3>That didn’t go through</h3>
            <p>{error}</p>
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap", justifyContent: "center" }}>
              {/credit/i.test(error) ? (
                <Link className="tm-btn tm-btn--primary" href={ROUTES.buyCredits}>
                  Buy credits
                </Link>
              ) : (
                // tm_tailor is only cleared on success, so a reload re-runs the
                // same tailoring inputs — a real retry without re-entering the flow.
                <button
                  type="button"
                  className="tm-btn tm-btn--primary"
                  onClick={() => window.location.reload()}
                >
                  Try again
                </button>
              )}
              <Link className="tm-btn tm-btn--outline" href={ROUTES.audit}>
                Back to your audit
              </Link>
            </div>
          </>
        ) : (
          <>
            <span
              aria-hidden="true"
              style={{
                height: 36,
                width: 36,
                flex: "none",
                borderRadius: "50%",
                border: "3px solid var(--tm-blue-50)",
                borderTopColor: "var(--tm-blue-600)",
                animation: "tmspin .8s linear infinite",
              }}
            />
            <h3>Building your tailored draft...</h3>
            {role && (
              <p
                style={{
                  margin: "2px 0 2px",
                  fontSize: "13.5px",
                  fontWeight: 500,
                  color: "var(--tm-blue-800)",
                }}
              >
                Tailoring it for {role}
              </p>
            )}
            <p style={{ minHeight: "1.4em" }}>{STAGES[stage]}...</p>
            <div
              role="progressbar"
              aria-valuenow={pct}
              aria-valuemin={0}
              aria-valuemax={100}
              style={{
                width: "100%",
                maxWidth: 320,
                height: 6,
                borderRadius: 999,
                background: "var(--tm-blue-50)",
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  width: `${pct}%`,
                  height: "100%",
                  borderRadius: 999,
                  background: "var(--tm-blue-600)",
                  transition: "width 600ms ease",
                }}
              />
            </div>
            <p className="tm-small" style={{ color: "var(--tm-zinc)" }}>
              We build your role-specific resume draft while you wait, then open the review
              editor automatically.
            </p>
          </>
        )}
      </div>
    </section>
  );
}
