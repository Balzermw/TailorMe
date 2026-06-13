"use client";

import Link from "next/link";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="tm">
      <section className="tm-sec">
        <div className="tm-wrap tm-wrap--narrow">
          <div className="tm-card tm-cta" style={{ padding: "40px 32px" }}>
            <span className="tm-pill tm-pill--gray">Error</span>
            <h1 className="tm-h2">Something went wrong</h1>
            <p className="tm-body">
              An unexpected error occurred. You can try again, or head back home.
            </p>
            <div
              style={{ display: "flex", gap: 12, flexWrap: "wrap", justifyContent: "center" }}
            >
              <button onClick={() => reset()} className="tm-btn tm-btn--primary">
                Try again
              </button>
              <Link href="/" className="tm-btn tm-btn--outline">
                Back home
              </Link>
            </div>
            {error.digest ? (
              <p className="tm-small">Reference: {error.digest}</p>
            ) : null}
          </div>
        </div>
      </section>
    </div>
  );
}
