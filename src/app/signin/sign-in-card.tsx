"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ROUTES } from "@/components/landing/data";
import {
  signInOAuth,
  signInPassword,
  signUp,
  useSession,
  type OAuthProvider,
} from "@/lib/auth";

function GoogleMark() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M23.5 12.27c0-.85-.08-1.66-.22-2.45H12v4.64h6.45a5.52 5.52 0 0 1-2.39 3.62v3h3.87c2.26-2.09 3.57-5.16 3.57-8.81Z"
      ></path>
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.96-1.07 7.93-2.91l-3.87-3a7.24 7.24 0 0 1-10.8-3.81H1.27v3.1A12 12 0 0 0 12 24Z"
      ></path>
      <path
        fill="#FBBC05"
        d="M5.26 14.28a7.2 7.2 0 0 1 0-4.56v-3.1H1.27a12 12 0 0 0 0 10.76l3.99-3.1Z"
      ></path>
      <path
        fill="#EA4335"
        d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.43-3.43A11.97 11.97 0 0 0 1.27 6.62l3.99 3.1A7.16 7.16 0 0 1 12 4.75Z"
      ></path>
    </svg>
  );
}

function LinkedInMark() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="#0A66C2"
        d="M20.45 20.45h-3.55v-5.57c0-1.33-.03-3.04-1.85-3.04-1.86 0-2.14 1.45-2.14 2.94v5.67H9.35V9h3.41v1.56h.05a3.74 3.74 0 0 1 3.37-1.85c3.6 0 4.27 2.37 4.27 5.46v6.28ZM5.34 7.43a2.06 2.06 0 1 1 0-4.12 2.06 2.06 0 0 1 0 4.12ZM7.12 20.45H3.56V9h3.56v11.45ZM22.22 0H1.77C.79 0 0 .77 0 1.73v20.54C0 23.23.79 24 1.77 24h20.45c.98 0 1.78-.77 1.78-1.73V1.73C24 .77 23.2 0 22.22 0Z"
      ></path>
    </svg>
  );
}

export default function SignInCard() {
  const router = useRouter();
  const [mode, setMode] = useState<"signup" | "signin">("signup");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirm, setConfirm] = useState(false);
  const { user: session } = useSession();

  const submit = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    setConfirm(false);
    if (mode === "signup") {
      const res = await signUp(email, password);
      setBusy(false);
      if (res.error) {
        setError(res.error);
        return;
      }
      if (res.needsConfirmation) {
        setConfirm(true);
        return;
      }
    } else {
      const res = await signInPassword(email, password);
      setBusy(false);
      if (res.error) {
        setError(res.error);
        return;
      }
    }
    router.push(ROUTES.dashboard);
    router.refresh();
  };

  const oauth = async (provider: OAuthProvider) => {
    if (busy) return;
    setBusy(true);
    setError(null);
    const res = await signInOAuth(provider);
    if (res.error) {
      setBusy(false);
      setError(res.error);
      return;
    }
    // Live mode redirects to the provider; demo mode falls through to dashboard.
    router.push(ROUTES.dashboard);
    router.refresh();
  };

  return (
    <div className="tmS-card">
      <div className="tmS-tabs">
        <button
          type="button"
          className={"tmS-tab" + (mode === "signup" ? " is-on" : "")}
          onClick={() => setMode("signup")}
        >
          Create account
        </button>
        <button
          type="button"
          className={"tmS-tab" + (mode === "signin" ? " is-on" : "")}
          onClick={() => setMode("signin")}
        >
          Sign in
        </button>
      </div>

      <div className="tmS-oauth">
        <button
          type="button"
          className="tm-btn tm-btn--outline"
          disabled={busy}
          onClick={() => oauth("google")}
        >
          <GoogleMark /> Continue with Google
        </button>
        <button
          type="button"
          className="tm-btn tm-btn--outline"
          disabled={busy}
          onClick={() => oauth("linkedin_oidc")}
        >
          <LinkedInMark /> Continue with LinkedIn
        </button>
      </div>

      <div className="tmS-div">or with email</div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        <div className="tmS-field">
          <label htmlFor="signin-email">Email</label>
          <input
            id="signin-email"
            className="tmS-input"
            type="email"
            autoComplete="email"
            placeholder="you@email.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <div className="tmS-field">
          <label htmlFor="signin-password">Password</label>
          <input
            id="signin-password"
            className="tmS-input"
            type="password"
            autoComplete={
              mode === "signup" ? "new-password" : "current-password"
            }
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={
              mode === "signup" ? "At least 8 characters" : "Your password"
            }
          />
        </div>

        {error && (
          <p
            className="tm-small"
            style={{ color: "#b3261e", marginBottom: "12px" }}
          >
            {error}
          </p>
        )}
        {confirm && (
          <p className="tmS-free" style={{ marginBottom: "12px" }}>
            Check your inbox to confirm your email, then sign in.
          </p>
        )}

        <button
          type="submit"
          className="tm-btn tm-btn--primary w-full justify-center mt-[6px]"
          disabled={busy}
        >
          {busy
            ? "One moment…"
            : mode === "signup"
              ? "Create free account"
              : "Sign in"}
        </button>
      </form>

      {session && (
        <p className="tmS-note mt-[12px]">
          Already signed in as <b className="font-medium">{session.name}</b>.{" "}
          <Link
            href={ROUTES.dashboard}
            className="text-[var(--tm-blue-600)] no-underline"
          >
            go to your dashboard
          </Link>
        </p>
      )}

      <p className={"tmS-note " + (mode === "signin" ? "visible" : "invisible")}>
        <Link
          href={ROUTES.forgotPassword}
          className="text-[var(--tm-blue-600)] no-underline"
        >
          Forgot your password?
        </Link>
      </p>
      <p className="tmS-note">
        By continuing you agree to the{" "}
        <Link
          href={ROUTES.terms}
          className="text-[var(--tm-blue-600)] no-underline"
        >
          terms
        </Link>{" "}
        and{" "}
        <Link
          href={ROUTES.privacy}
          className="text-[var(--tm-blue-600)] no-underline"
        >
          privacy policy
        </Link>
        .
      </p>
    </div>
  );
}
