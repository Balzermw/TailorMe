import Image from "next/image";
import { Check, PenLine, Search, Sparkles, Target, TrendingUp } from "lucide-react";
import { MICHAEL_CREDS } from "./data";

export default function Guide() {
  return (
    <section className="tm-sec">
      <div className="tm-wrap">
        <h2 className="tm-h2">Who’s actually reviewing your resume</h2>
        <p className="tm-body mt-[10px] max-w-[64ch]">
          TailorMe is built by Res.Me, the technical resume writers. The
          pipeline encodes how they work — and the same expert is behind the
          optional human pass.
        </p>
        <div className="tmB-guide mt-[30px]">
          <div className="tm-card tmB-guide-card">
            <span className="tm-eyebrow">
              <Sparkles size={14} /> The three agents
            </span>
            <div className="tmB-expert">
              <div className="tmB-agent-stack" aria-hidden="true">
                <span className="tmB-agent-face tmB-agent-face--blue">
                  <Search size={20} />
                </span>
                <span className="tmB-agent-face tmB-agent-face--mint">
                  <TrendingUp size={20} />
                </span>
                <span className="tmB-agent-face tmB-agent-face--deep">
                  <Target size={20} />
                </span>
              </div>
              <div>
                <h3 className="tm-h3">
                  Each one reads like a different gatekeeper
                </h3>
                <p className="tm-small mt-[2px]">
                  ATS · impact · role-fit — spawned fresh for every application
                </p>
              </div>
            </div>
            <p className="tm-small">
              A fresh reviewer is spawned for every application — it researches
              the company first, then critiques your draft from three angles:
              how the ATS parser will index it, how a recruiter skims it in
              thirty seconds, and how the hiring manager judges role-fit.
            </p>
            <p className="tm-small">
              The output isn’t a score. It’s a list of line-level edits — “this
              bullet needs a baseline metric,” “move platform work above
              frontend” — each one applied to the draft before it compiles.
            </p>
          </div>
          <div className="tm-card tmB-guide-card">
            <span
              className="tm-eyebrow"
              style={{ color: "var(--tm-mint-600)" }}
            >
              <PenLine size={14} /> The human expert
            </span>
            <div className="tmB-expert">
              <Image
                className="tmB-expert-photo"
                src="/michael.png"
                alt="Michael, head of Res.Me"
                width={56}
                height={56}
              />
              <div>
                <h3 className="tm-h3">Michael — head of Res.Me</h3>
                <p className="tm-small mt-[2px]">
                  The writer behind Res.Me’s coaching practice
                </p>
              </div>
            </div>
            <p className="tm-small">
              The optional +$49 pass isn’t a generic proofread — it’s Michael’s
              line-by-line review of your final draft:
            </p>
            <div className="tmB-creds">
              {MICHAEL_CREDS.map((c) => (
                <span key={c} className="tmB-cred">
                  <Check size={12} /> {c}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
