import { ArrowRight, Check } from "lucide-react";
import { KEYWORDS } from "@/components/landing/data";

function BeforeDoc() {
  return (
    <div className="tm-card tmB-paper tmB-paper--before">
      <div className="tmB-pdoc-head">
        <p className="tmB-pdoc-name">Alex Mercer</p>
        <p className="tmB-pdoc-contact">Software Engineer · alex.m@email.com</p>
      </div>
      <div className="tmB-pdoc-rule" style={{ opacity: 0.25 }}></div>
      <p className="tmB-pdoc-sec" style={{ borderColor: "var(--tm-border)" }}>
        Experience
      </p>
      <div className="tmB-pdoc-entry">
        <span
          className="tmB-pdoc-role"
          style={{ fontFamily: "var(--tm-font)", fontWeight: 500 }}
        >
          Senior Software Engineer — Brightline Commerce
        </span>
        <span className="tmB-pdoc-date">2019 – present</span>
      </div>
      <p className="tmT-before-bullet">
        Responsible for developing and maintaining features for the web app
        using React and Node.js.
      </p>
      <p className="tmT-before-bullet">
        Worked on bug fixes and performance improvements.
      </p>
      <p className="tmT-before-bullet">
        Participated in code reviews and mentoring.
      </p>
      <div className="tmB-pdoc-entry">
        <span
          className="tmB-pdoc-role"
          style={{ fontFamily: "var(--tm-font)", fontWeight: 500 }}
        >
          Software Engineer — Versa Labs
        </span>
        <span className="tmB-pdoc-date">2014 – 2019</span>
      </div>
      <p className="tmT-before-bullet">
        Wrote backend services and helped with deployments.
      </p>
      <p className="tmT-before-bullet">
        Attended sprint planning and worked with the QA team.
      </p>
      <p className="tmT-before-note">
        …continues for 3 pages. Tasks, not impact. Nothing ranked for the role.
      </p>
    </div>
  );
}

function AfterDoc() {
  return (
    <div className="tm-card tmB-paper tmB-paper--stack tmB-paper--doc">
      <div className="tmB-pdoc-head">
        <span className="tmB-pdoc-avatar">AM</span>
        <p className="tmB-pdoc-name">Alex Mercer</p>
        <p className="tmB-pdoc-contact">
          Senior Platform Engineer · Copenhagen · alex.m@email.com
        </p>
      </div>
      <div className="tmB-pdoc-rule"></div>
      <p className="tmB-pdoc-sec">Experience</p>
      <div className="tmB-pdoc-entry">
        <span className="tmB-pdoc-role">
          Senior Software Engineer — Brightline Commerce
        </span>
        <span className="tmB-pdoc-date">2019 – present</span>
      </div>
      <p className="tmB-pdoc-bullet">
        Led migration of checkout to a{" "}
        <mark className="tm-k">distributed Node.js service</mark>, cutting p95
        latency <mark className="tm-m">38%</mark> across{" "}
        <mark className="tm-m">2.4M daily transactions</mark>.
      </p>
      <p className="tmB-pdoc-bullet">
        Mentored <mark className="tm-m">6 engineers</mark> through promotion
        cycles while owning <mark className="tm-k">Kubernetes</mark> deployment
        standards.
      </p>
      <div className="tmB-pdoc-entry">
        <span className="tmB-pdoc-role">Software Engineer — Versa Labs</span>
        <span className="tmB-pdoc-date">2014 – 2019</span>
      </div>
      <p className="tmB-pdoc-bullet">
        Built the order-events pipeline handling 40k messages/min with{" "}
        <mark className="tm-k">observability</mark> baked in.
      </p>
      <p className="tmB-pdoc-sec">Skills</p>
      <p className="tmB-pdoc-skills">
        Distributed systems · Node.js at scale · Kubernetes · Observability ·
        Mentorship
      </p>
      <p className="tmB-pdoc-foot">1 / 2</p>
    </div>
  );
}

export default function DocsCompare() {
  return (
    <section className="tm-sec">
      <div className="tm-wrap">
        <h2 className="tm-h2 text-center">The resume, before and after</h2>
        <div className="tmT-docs mt-[36px]">
          <div>
            <span className="tm-pill tm-pill--gray tmT-doclabel inline-flex">
              Before — 3 pages, generic
            </span>
            <BeforeDoc />
          </div>
          <div className="tmT-docs-arrow">
            <ArrowRight size={20} />
          </div>
          <div>
            <span className="tm-pill tmT-doclabel inline-flex">
              After — 2 pages, tailored to Nordpeak
            </span>
            <AfterDoc />
          </div>
        </div>
        <div className="tm-keywords justify-center">
          <span className="tm-keywords-label">Keyword alignment:</span>
          {KEYWORDS.map((k) => (
            <span key={k} className="tm-pill tm-pill--mint">
              <Check size={12} /> {k}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}
