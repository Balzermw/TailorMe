import Link from "next/link";
import { ArrowRight, Sparkles } from "lucide-react";
import { HEADLINE, HERO_SUB, ROUTES } from "./data";
import HeroScoreCard from "./hero-score-card";

export default function Hero() {
  return (
    <section className="tm-sec tm-sec--hero">
      <div className="tm-wrap tmB-hero">
        <div className="tmH-copy">
          <span className="tm-pill tmH-badge">
            <Sparkles size={15} /> Agentic resume review powered by Res.Me
          </span>
          <h1 className="tm-h1">
            {HEADLINE.pre}
            <em>{HEADLINE.em}</em>
          </h1>
          <p className="tm-body">{HERO_SUB}</p>
          <div className="tmB-hero-ctas">
            <Link
              className="tm-btn tm-btn--primary tm-btn--lg"
              href={ROUTES.audit}
            >
              Run the agents on my resume
            </Link>
            <Link
              className="tm-btn tm-btn--outline tm-btn--lg"
              href={ROUTES.transformation}
            >
              See a sample report <ArrowRight size={16} />
            </Link>
          </div>
          <p className="tm-small tmH-note">First score free · no card required</p>
        </div>
        <HeroScoreCard />
      </div>
    </section>
  );
}
