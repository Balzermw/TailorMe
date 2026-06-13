"use client";

import { useState } from "react";
import Link from "next/link";
import { Check, Lock, Trash2, Upload } from "lucide-react";
import { ROUTES } from "@/components/landing/data";
import { useSession } from "@/lib/auth";

type DeleteState = "idle" | "confirm" | "done";

// Account settings — master profile, credits, security, data controls.
// Renders the fallback persona on the server and swaps in the actual demo
// session (email) after hydration, mirroring the prototype's tmGetSession.
export default function SettingsContent() {
  const [del, setDel] = useState<DeleteState>("idle"); // idle → confirm → done
  const [exported, setExported] = useState(false);
  const { user: session } = useSession();

  const email = session?.email || "alex.m@email.com";

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
            <span className="tm-pill tm-pill--mint">
              <Check size={12} /> parsed
            </span>
          </div>
          <p className="tm-small">
            The structured profile every application starts from. Re-upload
            anytime — tailoring always uses the latest version.
          </p>
          <div className="tmF-profile2-id mt-[6px]">
            <span className="tmC-tst-avatar w-[44px]! h-[44px]!">AM</span>
            <div>
              <b className="text-[15px]! font-medium">Alex Mercer</b>
              <span className="tm-small block">
                Senior Software Engineer · 2 roles · 14 bullets · 11 skills
              </span>
            </div>
            <span className="tm-btn tm-btn--outline tm-btn--sm ml-auto">
              <Upload size={14} /> Re-upload resume
            </span>
          </div>
        </div>

        {/* credits */}
        <div className="tm-card tmSet-card">
          <div className="tmSet-head">
            <h2>Credits</h2>
          </div>
          <div className="tmSet-row">
            <span>
              <b className="font-medium">7 credits</b> remaining · credits
              never expire
            </span>
            <Link
              className="tm-btn tm-btn--outline tm-btn--sm"
              href={ROUTES.buyCredits}
            >
              Buy more
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
              Download everything we hold about you — profile, documents,
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
                  Your 7 unused credits will be refunded.
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
                    onClick={() => setDel("done")}
                  >
                    Yes, delete everything
                  </button>
                </span>
              </>
            )}
            {del === "done" && (
              <span className="tm-pill tm-pill--gray">
                <Check size={12} /> deleted — your data is gone (demo state,{" "}
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
