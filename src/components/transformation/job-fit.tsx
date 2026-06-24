import { Check } from "lucide-react";
import { KEYWORDS, SCORES } from "@/components/landing/data";

// Ported from the design's shared <FitBars/> (tm-shared.jsx).
function FitBars({ title }: { title: string }) {
  return (
    <div className="tm-fit">
      <div className="tm-fit-head">
        <h3>{title}</h3>
      </div>
      {SCORES.map((s) => (
        <div key={s.l} className="tm-fit-row">
          <label>{s.l}</label>
          <div className="tm-fit-track">
            <div className="tm-fit-bar" style={{ width: `${s.v}%` }}></div>
          </div>
          <output>{s.v}</output>
        </div>
      ))}
      {/* Location is a pass/fail gate, not a 0–100 score — a full green bar +
          plain-language "Eligible" reads clearer than a bare "pass" pill. */}
      <div className="tm-fit-row">
        <label>Location</label>
        <div className="tm-fit-track">
          <div
            className="tm-fit-bar"
            style={{ width: "100%", background: "var(--tm-mint-600)" }}
          ></div>
        </div>
        <output style={{ color: "var(--tm-mint-600)", fontWeight: 600 }}>
          <Check size={14} aria-label="eligible" />
        </output>
      </div>
    </div>
  );
}

const JOB_LABEL: React.CSSProperties = {
  fontSize: "11px",
  fontWeight: 700,
  letterSpacing: "0.06em",
  textTransform: "uppercase",
  color: "var(--tm-blue-600)",
  marginBottom: "8px",
};

export default function JobFit() {
  return (
    <section
      className="tm-sec tm-tint--gray"
      style={{ paddingTop: "calc(var(--sy) * 0.6)" }}
    >
      <div className="tm-wrap tmT-grid2">
        {/* .tmA-posting is not in globals.css — equivalent via utilities. */}
        <div className="tm-card p-[24px]">
          <span className="tm-eyebrow mb-[10px]">The job</span>
          <strong className="block text-[length:var(--body)] font-medium">
            Senior Platform Engineer · Nordpeak Systems
          </strong>
          <p className="tm-small mt-[4px] mb-[16px]">
            Copenhagen / Remote EU · pasted as a URL
          </p>
          <p style={JOB_LABEL}>Must-have skills we detected</p>
          <div className="flex flex-wrap gap-[8px]">
            {KEYWORDS.map((k) => (
              <span key={k} className="tm-pill tm-pill--gray">
                {k}
              </span>
            ))}
          </div>
          <p style={{ ...JOB_LABEL, marginTop: "18px" }}>From the posting</p>
          <p
            className="tm-small"
            style={{ lineHeight: 1.65, borderLeft: "2px solid var(--tm-border)", paddingLeft: "12px" }}
          >
            “Own the evolution of our backend platform: lead distributed Node.js
            services at scale, set Kubernetes deployment standards across teams, and
            build observability into everything we ship. 5+ years backend, a track
            record of reliability and performance wins, plus mentoring and technical
            direction.”
          </p>
          <p className="tm-small mt-[10px]" style={{ color: "var(--tm-zinc)" }}>
            Nice to have: Datadog / Prometheus, and owning a platform other teams
            build on.
          </p>
        </div>
        <div className="tm-card p-[24px]">
          <div className="tmT-verdict">
            <strong>84</strong>
            <div>
              <span className="tm-pill tm-pill--mint">strong fit</span>
              <p className="tm-small mt-[6px]">
                An honest fit score before we write a word. We won’t dress up a
                weak match.
              </p>
            </div>
          </div>
          <div className="tmF-fit">
            <FitBars title="Five dimensions" />
          </div>
        </div>
      </div>
    </section>
  );
}
