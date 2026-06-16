import { Check } from "lucide-react";
import { KEYWORDS, SCORES } from "@/components/landing/data";

// Ported from the design's shared <FitBars/> (tm-shared.jsx).
function FitBars({ title }: { title: string }) {
  return (
    <div className="tm-fit">
      <div className="tm-fit-head">
        <h3>{title}</h3>
        <span className="tm-pill tm-pill--mint">84 — strong fit</span>
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
            Senior Platform Engineer — Nordpeak Systems
          </strong>
          <p className="tm-small mt-[4px] mb-[14px]">
            Copenhagen / Remote EU · pasted as a URL
          </p>
          <div className="flex flex-wrap gap-[8px]">
            {KEYWORDS.map((k) => (
              <span key={k} className="tm-pill tm-pill--gray">
                {k}
              </span>
            ))}
          </div>
        </div>
        <div className="tm-card p-[24px]">
          <div className="tmT-verdict">
            <strong>84</strong>
            <div>
              <span className="tm-pill tm-pill--mint">strong fit</span>
              <p className="tm-small mt-[6px]">
                An honest fit score before we write a word — we won’t dress up a
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
