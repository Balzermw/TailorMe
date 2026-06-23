import Link from "next/link";
import { ArrowDown, Check, ClipboardList, Download, FileText } from "lucide-react";
import { AGENT_NOTES, ROUTES } from "./data";

export default function RunTimeline() {
  return (
    <section className="tm-sec">
      <div className="tm-wrap">
        <h2 className="tm-h2">Watch a real application run</h2>
        <p className="tm-body mt-[10px] max-w-[70ch]">
          One sample candidate and a real job posting, walked through all four
          steps of an application.
        </p>

        <div className="tmB-tl">
          <div className="tmB-tl-step">
            <span className="tmB-tl-dot">1</span>
            <div className="tmB-tl-body">
              <h3 className="tmB-tl-title">The job</h3>
              <p className="tmB-tl-sub">
                Paste a URL. Fit is scored before you spend a credit.
              </p>
              <div className="tm-card tmB-tl-card tmB-tl-job">
                <ClipboardList size={17} />
                <span>
                  <b>Senior Platform Engineer</b> · Nordpeak Systems
                </span>
                <span className="tm-pill tm-pill--mint ml-auto">
                  84 · strong fit
                </span>
              </div>
            </div>
          </div>

          <div className="tmB-tl-step">
            <span className="tmB-tl-dot">2</span>
            <div className="tmB-tl-body">
              <h3 className="tmB-tl-title">The rewrite</h3>
              <p className="tmB-tl-sub">
                Every bullet, re-written for this posting. One example:
              </p>
              <div className="tm-card tmB-tl-card tmB-tl-rw">
                <p className="tmB-tl-before">
                  “Responsible for developing and maintaining features for the
                  web app using React and Node.js.”
                </p>
                <span className="tmB-tl-arrow" style={{ justifyContent: "center" }}>
                  <ArrowDown size={15} />
                </span>
                <p className="tmB-tl-after">
                  “Led migration of checkout to a{" "}
                  <mark className="tm-k">distributed Node.js service</mark>,
                  cutting p95 latency <mark className="tm-m">38%</mark> across{" "}
                  <mark className="tm-m">2.4M daily transactions</mark>.”
                </p>
              </div>
            </div>
          </div>

          <div className="tmB-tl-step">
            <span className="tmB-tl-dot">3</span>
            <div className="tmB-tl-body">
              <h3 className="tmB-tl-title">The review</h3>
              <p className="tmB-tl-sub">
                Three agents read the draft. Each note is a concrete change.
              </p>
              <div className="tm-card tmB-tl-card">
                {AGENT_NOTES.map((a) => (
                  <p key={a.name} className="tmB-rq-item">
                    <span className="tm-pill">
                      <b style={{ color: a.accent }}>{a.agent}</b> · {a.name}
                    </span>
                    {a.note}
                  </p>
                ))}
              </div>
            </div>
          </div>

          <div className="tmB-tl-step">
            <span className="tmB-tl-dot">
              <Check size={14} />
            </span>
            <div className="tmB-tl-body">
              <h3 className="tmB-tl-title">The result</h3>
              <p className="tmB-tl-sub">
                Compiled, inspected for page breaks, ready to send.
              </p>
              <div className="tm-card tmB-tl-card tmB-tl-out">
                <span className="tmB-ev-file">
                  <FileText size={15} /> Resume_Nordpeak.pdf{" "}
                  <span className="ok">
                    <Check size={11} /> 2 pages
                  </span>
                </span>
                <span className="tmB-ev-file">
                  <FileText size={15} /> Cover_Nordpeak.pdf{" "}
                  <span className="ok">
                    <Check size={11} /> 1 page
                  </span>
                </span>
                <Link
                  href={ROUTES.audit}
                  className="tm-btn tm-btn--primary tm-btn--sm justify-center mt-[6px]"
                >
                  <Download size={14} /> Download both · 1 credit
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
