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
      <div className="tm-fit-pass">
        <label>Location & logistics</label>
        <span className="tm-pill tm-pill--mint justify-self-start">
          <Check size={12} /> pass
        </span>
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
                Scored before drafting — weak fits get flagged, not flattered.
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
