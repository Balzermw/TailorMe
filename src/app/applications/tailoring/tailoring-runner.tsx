"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ROUTES } from "@/components/landing/data";
import { editHref } from "@/lib/apply/render";
import { track, getSessionId } from "@/lib/track";

// The audit step stashes the run inputs in sessionStorage and navigates here
// immediately, so the user never waits out the ~1-minute run on the results
// page. We run /api/apply (full) here, show staged progress, then drop straight
// into the editor when the document is ready.
const STAGES = [
  "Reading your resume and the job posting",
  "Rewriting your bullets for this posting",
  "Compiling your resume and cover letter",
  "Running the final faithfulness check",
  "Polishing formatting and layout",
  "Almost there — longer resumes take a little more time",
];

export default function TailoringRunner() {
  const router = useRouter();
  const [stage, setStage] = useState(0);
  const [pct, setPct] = useState(6);
  const [error, setError] = useState<string | null>(null);
  const started = useRef(false);

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

    const start = Date.now();
    const ticker = window.setInterval(() => {
      const t = Date.now() - start;
      // Crawl toward ~92% and never hit 100% until the doc is actually ready,
      // so larger/slower runs keep visibly progressing instead of freezing at
      // the last step. (6 + 86·(1−e^−t/20s) → 92% asymptotically.)
      setPct((p) => Math.max(p, Math.round(6 + 86 * (1 - Math.exp(-t / 20000)))));
      // Advance the reassurance message every ~8s, holding on the last one.
      setStage(Math.min(Math.floor(t / 8000), STAGES.length - 1));
    }, 600);

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
        // Demo mode or no persisted application → nothing to open; head back.
        router.replace(ROUTES.audit);
      } catch {
        setError("Something went wrong. Please try again.");
      } finally {
        window.clearInterval(ticker);
      }
    })();

    return () => window.clearInterval(ticker);
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
              <Link className="tm-btn tm-btn--primary" href={ROUTES.audit}>
                Back to your audit
              </Link>
              {/credit/i.test(error) && (
                <Link className="tm-btn tm-btn--outline" href={ROUTES.buyCredits}>
                  Buy credits
                </Link>
              )}
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
            <h3>Tailoring your application…</h3>
            <p style={{ minHeight: "1.4em" }}>{STAGES[stage]}…</p>
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
              We build your resume and cover letter while you wait, then open the editor
              automatically.
            </p>
          </>
        )}
      </div>
    </section>
  );
}
