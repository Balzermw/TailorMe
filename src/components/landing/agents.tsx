import Image from "next/image";
import { Brain, Cpu, Zap } from "lucide-react";
import { AGENTS, MICHAEL } from "./data";

const ICON = { cpu: Cpu, zap: Zap, brain: Brain } as const;

// "The agents" section: three AI reviewers, each playing a gatekeeper (the ATS,
// the recruiter, the hiring manager), plus Michael for the optional human pass.
export default function Agents() {
  return (
    <section id="agents" className="tm-sec tm-tint--blue">
      <div className="tm-wrap">
        <span className="tm-eyebrow">The agents</span>
        <h2 className="tm-h2 mt-[8px]">Three reviewers, three perspectives</h2>
        <p className="tm-body mt-[10px] max-w-[62ch]">
          AI agents read every draft the way the ATS, the recruiter, and the
          hiring manager will, then hand back exact fixes.
        </p>

        <div className="tmH-agents mt-[34px]">
          {AGENTS.map((a) => {
            const Icon = ICON[a.icon];
            return (
              <div key={a.agent} className="tm-card tmH-agent">
                <span className="tmH-agent-persona">{a.persona}</span>
                <div className="tmH-agent-head">
                  <span className={`tmH-bar-ic tmH-bar-ic--${a.color}`}>
                    <Icon size={20} />
                  </span>
                  <div>
                    <p className="tmH-agent-name">{a.agent}</p>
                    <p className="tmH-agent-role">{a.role}</p>
                  </div>
                </div>
                <p className="tm-small tmH-agent-blurb">{a.blurb}</p>
                <p className="tmH-agent-sample">{a.sample}</p>
              </div>
            );
          })}
        </div>

        <div className="tm-card tmH-human mt-[20px]">
          <Image
            className="tmH-human-img"
            src={MICHAEL.img}
            alt={`${MICHAEL.name}, ${MICHAEL.title}`}
            width={60}
            height={60}
          />
          <div className="tmH-human-body">
            <p className="tmH-human-name">
              {MICHAEL.name}
              <span className="tmH-human-tag">Human reviewer</span>
            </p>
            <p className="tmH-human-title">{MICHAEL.title}</p>
            <p className="tm-small tmH-human-blurb">{MICHAEL.blurb}</p>
          </div>
        </div>
      </div>
    </section>
  );
}
