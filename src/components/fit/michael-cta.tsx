import Image from "next/image";
import Link from "next/link";
import { PenLine } from "lucide-react";
import { ROUTES } from "@/components/landing/data";

// Shared human-coaching (Michael) CTAs, used by the audit funnel AND the fit
// panel's "earned escalation". Single source of truth so the pitch copy and
// styling never drift between surfaces. Both link to ROUTES.coaching (no gating).

/** Honest, conversion-friendly nudge toward a manual expert review on weak fit. */
export function ManualReviewCTA({ overall }: { overall: number }) {
  const line =
    overall >= 60
      ? "Your resume shows relevant experience, but there are notable gaps for this role."
      : overall >= 45
        ? "This role may be a stretch based on your current resume. The gaps below are real, but fixable."
        : "Based on this resume, this role looks like a significant stretch right now.";
  return (
    <div
      style={{
        marginTop: "16px",
        border: "0.5px solid rgba(67,115,219,.3)",
        background: "var(--tm-blue-50)",
        borderRadius: "12px",
        padding: "16px 18px",
        display: "flex",
        gap: "14px",
        alignItems: "flex-start",
      }}
    >
      <Image
        src="/michael.png"
        alt="Michael, Head of Res.Me"
        width={52}
        height={52}
        style={{
          width: "52px",
          height: "52px",
          borderRadius: "50%",
          objectFit: "cover",
          border: "0.5px solid var(--tm-border)",
          flex: "none",
        }}
      />
      <div style={{ minWidth: 0 }}>
        <p style={{ fontSize: "13.5px", fontWeight: 500, color: "var(--tm-ink)", lineHeight: 1.5 }}>
          {line}
        </p>
        <p className="tm-small" style={{ marginTop: "6px", fontSize: "12.5px", lineHeight: 1.5 }}>
          I&apos;m Michael, Head of Res.Me and a Certified Professional Resume Writer. I&apos;ve
          rewritten plenty of resumes that didn&apos;t look qualified on paper. I can do the same for
          yours, coach you on strategy, and tell you honestly which roles fit.
        </p>
        <Link
          href={ROUTES.coaching}
          className="tm-btn tm-btn--outline tmF-manual-cta"
          style={{ marginTop: "12px" }}
        >
          <PenLine size={13} /> Get a rewrite or coaching from Michael
        </Link>
      </div>
    </div>
  );
}

/** Optional human-pass upsell shown after a full run. */
export function MichaelPitch() {
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
          The AI agents already catch what a parser and a skim-read miss. For
          extra peace of mind, Michael (Certified Professional Resume Writer, 650+
          resumes) reads your final draft like a hiring manager and sends
          positioning notes for this role, back in your inbox within 48 hours.
        </p>
        <div className="tmF-michael-foot">
          <span className="tm-pill tm-pill--mint">+$79 per application</span>
          <span className="tm-small" style={{ fontSize: "12.5px" }}>
            Add it at checkout, or{" "}
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

/**
 * Dashboard escalation: once a person is managing tailored roles and one is a
 * stretch, offer a professional review + optimization with Michael. Reuses the
 * Michael card styling; the copy is dashboard/workflow-oriented.
 */
export function MichaelReviewCard({ weakCount }: { weakCount?: number }) {
  return (
    <div className="tm-card tmF-michael tmD-michael">
      <Image src="/michael.png" alt="Michael, Head of Res.Me" width={72} height={72} />
      <div className="tmF-michael-body">
        <span className="tmF-michael-eyebrow">
          <PenLine size={13} /> Professional review and optimization
        </span>
        <h3>Want an expert to take a stretch role further?</h3>
        <p>
          {weakCount && weakCount > 0
            ? `${weakCount} of your targets ${weakCount === 1 ? "is" : "are"} a reach on paper. `
            : "Some roles are a reach on paper. "}
          Michael (Certified Professional Resume Writer, 650+ resumes) does a hands-on review,
          rewrites and optimizes your resume for the role, and coaches you on how to position
          yourself.
        </p>
        <div className="tmF-michael-foot">
          <Link className="tm-btn tm-btn--primary tm-btn--sm" href={ROUTES.coaching}>
            <PenLine size={13} /> Get a professional review
          </Link>
          <Link
            className="tm-small"
            href={ROUTES.bookSession}
            style={{ color: "var(--tm-blue-600)", textDecoration: "none", fontSize: "12.5px" }}
          >
            or book a session
          </Link>
        </div>
      </div>
    </div>
  );
}
