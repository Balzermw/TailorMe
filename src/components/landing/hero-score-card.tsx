"use client";

import { useEffect, useRef } from "react";
import { Brain, CircleCheck, Cpu, Zap } from "lucide-react";
import { HERO_SAMPLE } from "./data";

const BAR_ICON = { cpu: Cpu, zap: Zap, brain: Brain } as const;

// Gauge geometry from the design mockup: 168×168, r=73, stroke 11.
const R = 73;
const CIRC = 2 * Math.PI * R;

// Sample agent-score card. The overall score counts up (0 → value) while the
// gauge arc sweeps with it; the per-agent bars animate up via CSS. The count-up
// is driven by refs + direct DOM writes inside rAF (no per-frame React render),
// so it stays smooth. Honors prefers-reduced-motion by snapping to the end.
export default function HeroScoreCard() {
  const { role, context, score, scoreMax, verdict, status, bars } = HERO_SAMPLE;
  const numRef = useRef<HTMLSpanElement>(null);
  const arcRef = useRef<SVGCircleElement>(null);

  useEffect(() => {
    const numEl = numRef.current;
    const arcEl = arcRef.current;
    if (!numEl || !arcEl) return;

    const apply = (v: number) => {
      numEl.textContent = String(Math.round(v));
      arcEl.style.strokeDashoffset = String(CIRC * (1 - v / scoreMax));
    };

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) {
      apply(score);
      return;
    }

    let raf = 0;
    const duration = 1500;
    const start = performance.now();
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / duration);
      const eased = 1 - Math.pow(1 - p, 3); // easeOutCubic
      apply(eased * score);
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [score, scoreMax]);

  return (
    <div className="tm-card tmH-card" aria-hidden="true">
      <div className="tmH-card-top">
        <div className="tmH-gauge">
          <svg viewBox="0 0 168 168" className="tmH-gauge-svg">
            <circle className="tmH-gauge-track" cx="84" cy="84" r={R} />
            <circle
              ref={arcRef}
              className="tmH-gauge-val"
              cx="84"
              cy="84"
              r={R}
              style={{ strokeDasharray: CIRC, strokeDashoffset: CIRC }}
            />
          </svg>
          <span className="tmH-gauge-center">
            <span ref={numRef} className="tmH-gauge-num">
              0
            </span>
            <span className="tmH-gauge-verdict">{verdict}</span>
          </span>
        </div>
        <div className="tmH-card-meta">
          <p className="tmH-card-role">{role}</p>
          <p className="tmH-card-ctx">{context}</p>
          <span className="tm-pill tm-pill--mint tmH-card-status">
            <CircleCheck size={14} /> {status}
          </span>
        </div>
      </div>

      <div className="tmH-bars">
        {bars.map((b, i) => {
          const Icon = BAR_ICON[b.icon];
          return (
            <div className="tmH-bar" key={b.agent}>
              <span className={`tmH-bar-ic tmH-bar-ic--${b.color}`}>
                <Icon size={18} />
              </span>
              <div className="tmH-bar-main">
                <div className="tmH-bar-head">
                  <span className="tmH-bar-name">{b.agent}</span>
                  <span className="tmH-bar-sep">·</span>
                  <span className="tmH-bar-label">{b.label}</span>
                  <span className="tmH-bar-val">{b.value}</span>
                </div>
                <div className="tmH-bar-track">
                  <span
                    className={`tmH-bar-fill tmH-bar-fill--${b.color}`}
                    style={
                      {
                        "--w": `${b.value}%`,
                        "--d": `${200 + i * 130}ms`,
                      } as React.CSSProperties
                    }
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
