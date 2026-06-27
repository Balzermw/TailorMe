"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Check, Lock, Trash2, Upload } from "lucide-react";
import { ROUTES } from "@/components/landing/data";
import { isRealAuth, useSession } from "@/lib/auth";
import {
  clearResumeDraft,
  clearSavedResume,
  clearTargetResume,
  loadBaseResumeDoc,
} from "@/lib/resume";
import type { TailoredDoc } from "@/lib/types";

type DeleteState = "idle" | "confirm" | "done";

// Account settings — master profile, credits, security, data controls.
// Renders the fallback persona on the server and swaps in the actual demo
// session (email) after hydration, mirroring the prototype's tmGetSession.
export default function SettingsContent() {
  const [del, setDel] = useState<DeleteState>("idle"); // idle → confirm → done
  const [exported, setExported] = useState(false);
  const [baseResume, setBaseResume] = useState<TailoredDoc | null>(null);
  const { user: session } = useSession();

  useEffect(() => {
    loadBaseResumeDoc().then(setBaseResume);
  }, []);

  const email = session?.email || "local.user@example.com";
  const displayName = baseResume?.name || session?.name || "No resume saved";
  const initials = displayName
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("") || "LU";
  const roleCount = baseResume?.experience.length ?? 0;
  const bulletCount =
    baseResume?.experience.reduce((sum, role) => sum + role.bullets.length, 0) ?? 0;
  const skillCount = baseResume?.skills.length ?? 0;
  const profileSummary = baseResume
    ? [
        baseResume.headline,
        `${roleCount} role${roleCount === 1 ? "" : "s"}`,
        `${bulletCount} bullet${bulletCount === 1 ? "" : "s"}`,
        `${skillCount} skill${skillCount === 1 ? "" : "s"}`,
      ]
        .filter(Boolean)
        .join(" · ")
    : "Build or import a resume to create your master profile.";

  async function deleteEverything() {
    await clearSavedResume();
    clearResumeDraft();
    clearTargetResume();
    try {
      window.sessionStorage.removeItem("tm_tailor");
      window.sessionStorage.removeItem("tm_sid");
    } catch {
      /* non-fatal */
    }
    setBaseResume(null);
    setDel("done");
  }

  return (
    <section className="tm-sec">
      <div className="mx-auto max-w-[880px]">
        <h1 className="text-[clamp(28px,3vw,36px)] font-medium tracking-[-0.02em]">
          Account settings
        </h1>

        {/* master profile */}
        <div className="tm-card tmSet-card">
          <div className="tmSet-head">
            <h2>Master profile</h2>
            <span className={"tm-pill " + (baseResume ? "tm-pill--mint" : "tm-pill--gray")}>
              {baseResume ? (
                <>
                  <Check size={12} /> saved
                </>
              ) : (
                "not set"
              )}
            </span>
          </div>
          <p className="tm-small">
            The structured profile every application starts from. Re-upload
            anytime; tailoring always uses the latest version.
          </p>
          <div className="tmSet-profile">
            <span className="tmSet-avatar">{initials}</span>
            <div className="tmSet-profile-text">
              <b className="tmSet-profile-name">{displayName}</b>
              <span className="tm-small block">{profileSummary}</span>
            </div>
            <Link className="tm-btn tm-btn--outline tm-btn--sm ml-auto" href={ROUTES.resumeImport}>
              <Upload size={14} /> {baseResume ? "Re-upload resume" : "Add resume"}
            </Link>
          </div>
        </div>

        {/* credits */}
        <div className="tm-card tmSet-card">
          <div className="tmSet-head">
            <h2>Credits</h2>
          </div>
          <div className="tmSet-row">
            <span>
              {isRealAuth ? (
                <>
                  Credit balance is shown on your dashboard · credits never expire
                </>
              ) : (
                <>
                  <b className="font-medium">Local workspace</b> · billing is not connected here
                </>
              )}
            </span>
            <Link
              className="tm-btn tm-btn--outline tm-btn--sm"
              href={isRealAuth ? ROUTES.buyCredits : ROUTES.pricing}
            >
              {isRealAuth ? "Buy more" : "View pricing"}
            </Link>
          </div>
        </div>

        {/* security */}
        <div className="tm-card tmSet-card">
          <div className="tmSet-head">
            <h2>Sign-in &amp; security</h2>
          </div>
          <div className="tmSet-row">
            <span>{email} · password sign-in</span>
            <Link
              className="tm-btn tm-btn--outline tm-btn--sm"
              href={ROUTES.forgotPassword}
            >
              Change password
            </Link>
          </div>
        </div>

        {/* data & privacy */}
        <div className="tm-card tmSet-card">
          <div className="tmSet-head">
            <h2>Data &amp; privacy</h2>
            <span className="tm-pill tm-pill--gray">
              <Lock size={12} /> encrypted at rest
            </span>
          </div>
          <div className="tmSet-row">
            <span>
              Download everything we hold about you: profile, documents,
              feedback.
            </span>
            {!exported ? (
              <button
                type="button"
                className="tm-btn tm-btn--outline tm-btn--sm"
                onClick={() => setExported(true)}
              >
                Export my data
              </button>
            ) : (
              <span className="tm-pill tm-pill--mint">
                <Check size={12} /> export emailed
              </span>
            )}
          </div>
          <div className="tmSet-row tmSet-row--danger">
            {del === "idle" && (
              <>
                <span>
                  Permanently delete your profile, resumes, documents, and
                  history.
                </span>
                <button
                  type="button"
                  className="tm-btn tm-btn--outline tm-btn--sm tmSet-danger-btn"
                  onClick={() => setDel("confirm")}
                >
                  <Trash2 size={14} /> Delete everything
                </button>
              </>
            )}
            {del === "confirm" && (
              <>
                <span>
                  <b className="font-medium">
                    This is immediate and irreversible.
                  </b>{" "}
                  Your saved local resume, draft handoffs, and active target
                  resume will be cleared from this browser.
                </span>
                <span className="flex flex-wrap gap-[8px]">
                  <button
                    type="button"
                    className="tm-btn tm-btn--outline tm-btn--sm"
                    onClick={() => setDel("idle")}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="tm-btn tm-btn--sm tmSet-danger-fill"
                    onClick={() => void deleteEverything()}
                  >
                    Yes, delete everything
                  </button>
                </span>
              </>
            )}
            {del === "done" && (
              <span className="tm-pill tm-pill--gray">
                <Check size={12} /> deleted · local workspace data cleared ({" "}
                <button
                  type="button"
                  className="underline cursor-pointer"
                  onClick={() => setDel("idle")}
                >
                  reset
                </button>
                )
              </span>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
