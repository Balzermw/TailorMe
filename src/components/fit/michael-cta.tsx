import Image from "next/image";
import Link from "next/link";
import { PenLine } from "lucide-react";
import { ROUTES } from "@/components/landing/data";

// Shared human-coaching (Michael) CTAs, used by the audit funnel AND the fit
// panel's "earned escalation". Single source of truth so the pitch copy and
// styling never drift between surfaces. Both link to ROUTES.coaching (no gating).

/** Honest, conversion-friendly nudge toward a manual expert review on weak fit.
 * Compact + animated so it sits under the fit score without crowding it. */
export function ManualReviewCTA({ overall }: { overall: number }) {
  const line =
    overall >= 60
      ? "Relevant experience, but notable gaps for this role."
      : overall >= 45
        ? "A stretch on paper, but the gaps below are real and fixable."
        : "A significant stretch for this résumé right now.";
  return (
    <div className="tmFit-michael">
      <Image
        src="/michael.png"
        alt="Michael, Head of Res.Me"
        width={40}
        height={40}
        className="tmFit-michael-img"
      />
      <div className="tmFit-michael-body">
        <p className="tmFit-michael-line">{line}</p>
        <p className="tmFit-michael-sub">
          Michael (Certified Resume Writer, 650+ résumés) can rewrite it for this role and coach your
          positioning.
        </p>
        <Link href={ROUTES.coaching} className="tm-btn tm-btn--outline tm-btn--sm tmF-manual-cta">
          <PenLine size={13} /> Get coaching from Michael
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
          {weakCount && weakCount > 0 ? (
            <>
              <b className="tm-data">{weakCount}</b> of your targets{" "}
              {weakCount === 1 ? "is" : "are"} a reach on paper.{" "}
            </>
          ) : (
            "Some roles are a reach on paper. "
          )}
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
