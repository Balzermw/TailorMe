import Image from "next/image";
import { Check, PenLine, Search, Target, TrendingUp } from "lucide-react";
import { MICHAEL_CREDS } from "./data";

export default function Guide() {
  return (
    <section className="tm-sec">
      <div className="tm-wrap">
        <h2 className="tm-h2">Who’s actually reviewing your resume</h2>
        <p className="tm-body mt-[10px] max-w-[64ch]">
          TailorMe is built by Res.Me, the technical resume writers. The pipeline
          encodes how they work, and the same expert is behind the optional human pass.
        </p>
        <div className="tmB-guide mt-[30px]">
          <div className="tm-card tmB-guide-card">
            <span className="tm-eyebrow">
              The three agents
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
                  ATS, impact, and role-fit. Fresh for every application.
                </p>
              </div>
            </div>
            <ul
              style={{
                listStyle: "none",
                margin: "6px 0 0",
                padding: 0,
                display: "flex",
                flexDirection: "column",
                gap: "12px",
              }}
            >
              {[
                {
                  Icon: Search,
                  bg: "var(--tm-blue-50)",
                  fg: "var(--tm-blue-600)",
                  name: "Ada",
                  text: "checks the keywords an ATS screens for",
                },
                {
                  Icon: TrendingUp,
                  bg: "#e9f8f1",
                  fg: "#0f7a52",
                  name: "Max",
                  text: "flags lines missing a hard number",
                },
                {
                  Icon: Target,
                  bg: "var(--tm-blue-50)",
                  fg: "var(--tm-blue-800)",
                  name: "Remy",
                  text: "ranks each line, trims to two pages",
                },
              ].map(({ Icon, bg, fg, name, text }) => (
                <li key={name} style={{ display: "flex", gap: "11px", alignItems: "flex-start" }}>
                  <span
                    style={{
                      flex: "none",
                      width: 30,
                      height: 30,
                      borderRadius: "50%",
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      background: bg,
                      color: fg,
                    }}
                  >
                    <Icon size={15} />
                  </span>
                  <span className="tm-small" style={{ lineHeight: 1.5 }}>
                    <b style={{ color: "var(--tm-ink)" }}>{name}</b> {text}
                  </span>
                </li>
              ))}
            </ul>
            <p className="tm-small">
              You get specific line edits, not a score, and each one is applied before the
              draft compiles.
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
                <h3 className="tm-h3">Michael · head of Res.Me</h3>
                <p className="tm-small mt-[2px]">
                  The writer behind Res.Me’s coaching practice
                </p>
              </div>
            </div>
            <p className="tm-small">
              Want a person in the loop? For +$49, Michael reads your final draft
              line by line and sends back notes:
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
