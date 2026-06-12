import Image from "next/image";
import Link from "next/link";
import { Sparkles } from "lucide-react";
import { HEADLINE, HERO_STAGES, ROUTES } from "./data";

function HeroArt() {
  return (
    <div className="tmB-art" aria-hidden="true">
      <div className="tm-card tmB-doc">
        <div className="tmB-scan"></div>
        <div className="tmB-doc-bar b1"></div>
        <div className="tmB-doc-bar b2"></div>
        <div className="tmB-doc-bar b3 mt-[8px]"></div>
        <div className="tmB-doc-bar b4"></div>
        <div className="tmB-doc-bar mint b5"></div>
        <div className="tmB-doc-bar b6"></div>
        <div className="tmB-doc-bar b3"></div>
        <div className="tmB-doc-bar mint b4"></div>
        <div className="tmB-doc-bar b2"></div>
      </div>
      <div className="tm-card tmB-rail">
        {HERO_STAGES.map(([stage, sub], i) => (
          <div
            key={stage}
            className="tmB-stage"
            style={{ "--i": i } as React.CSSProperties}
          >
            <span className="tmB-stage-dot"></span>
            <span className="tmB-stage-txt">
              <b>{stage}</b>
              <span>{sub}</span>
            </span>
          </div>
        ))}
      </div>
      <div className="tm-card tmB-hero-michael">
        <Image
          src="/michael.png"
          alt="Michael, head of Res.Me"
          width={38}
          height={38}
        />
        <span>
          <b>Human review by Michael</b>
          <span>Head of Res.Me · CPRW · optional on any run</span>
        </span>
      </div>
    </div>
  );
}

export default function Hero() {
  return (
    <section className="tm-sec">
      <div className="tm-wrap tmB-hero">
        <div>
          <h1 className="tm-h1">
            {HEADLINE.pre}
            <em>{HEADLINE.em}</em>
            {HEADLINE.post}
          </h1>
          <p className="tm-body">
            Paste a job posting. TailorMe rewrites your resume for it, then
            three specialist agents review the draft the way the ATS, the
            recruiter, and the hiring manager will — and return fixes, not a
            score.
          </p>
          <div className="tmB-hero-ctas">
            <Link className="tm-btn tm-btn--primary" href={ROUTES.audit}>
              <Sparkles size={15} /> Get a free resume audit
            </Link>
            <Link className="tm-btn tm-btn--outline" href={ROUTES.transformation}>
              See a real transformation
            </Link>
          </div>
          <p className="tm-small mt-[22px]">
            First application free · no card · credits never expire
          </p>
        </div>
        <HeroArt />
      </div>
    </section>
  );
}
