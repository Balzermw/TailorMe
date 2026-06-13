"use client";

import { useState } from "react";
import Link from "next/link";
import { Check } from "lucide-react";
import { ROUTES } from "@/components/landing/data";

export default function ForgotCard() {
  const [sent, setSent] = useState(false);
  return (
    <div className="tmS-card">
      {!sent ? (
        <div className="tm-card p-[32px]">
          <h1 className="text-[24px] font-medium tracking-[-0.01em]">
            Reset your password
          </h1>
          <p className="tm-small mt-[8px] mb-[22px]">
            Enter the email you signed up with and we&rsquo;ll send you a reset
            link.
          </p>
          <div className="tmS-field">
            <label htmlFor="forgot-email">Email</label>
            <input
              id="forgot-email"
              className="tmS-input"
              type="email"
              placeholder="you@email.com"
            />
          </div>
          <button
            type="button"
            className="tm-btn tm-btn--primary w-full justify-center mt-[6px]"
            onClick={() => setSent(true)}
          >
            Send reset link
          </button>
          <p className="tmS-note">
            <Link
              href={ROUTES.signIn}
              className="text-[var(--tm-blue-600)] no-underline"
            >
              &larr; Back to sign in
            </Link>
          </p>
        </div>
      ) : (
        <div className="tm-card tmF-gate px-[32px] py-[36px]">
          <span className="tm-pill tm-pill--mint">
            <Check size={12} /> sent
          </span>
          <h3>Check your inbox</h3>
          <p>
            If an account exists for that email, a reset link is on its way. It
            expires in 30 minutes.
          </p>
          <p className="tm-small text-[12.5px]">
            Nothing arriving? Check spam, or{" "}
            <Link
              href={ROUTES.contact}
              className="text-[var(--tm-blue-600)] no-underline"
            >
              contact us
            </Link>
            .
          </p>
          <Link className="tm-btn tm-btn--outline" href={ROUTES.signIn}>
            Back to sign in
          </Link>
        </div>
      )}
    </div>
  );
}
