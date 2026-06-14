import { ArrowRight, Check } from "lucide-react";
import { KEYWORDS } from "@/components/landing/data";

const serif = { fontFamily: "var(--tm-font)", fontWeight: 500 } as const;

function BeforeDoc() {
  return (
    <div className="tm-card tmB-paper tmB-paper--before tmB-paper--page">
      <div className="tmB-pdoc-head">
        <p className="tmB-pdoc-name">Alex Mercer</p>
        <p className="tmB-pdoc-contact">Software Engineer · alex.m@email.com</p>
      </div>
      <div className="tmB-pdoc-rule" style={{ opacity: 0.25 }}></div>
      <p className="tmB-pdoc-sec" style={{ borderColor: "var(--tm-border)" }}>
        Experience
      </p>
      <div className="tmB-pdoc-entry">
        <span className="tmB-pdoc-role" style={serif}>
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
      <p className="tmT-before-bullet">
        Attended daily standups and sprint planning.
      </p>
      <div className="tmB-pdoc-entry">
        <span className="tmB-pdoc-role" style={serif}>
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
      <p className="tmT-before-bullet">
        Helped onboard and train new team members.
      </p>
      <div className="tmB-pdoc-entry">
        <span className="tmB-pdoc-role" style={serif}>
          Junior Developer — Webstack Inc.
        </span>
        <span className="tmB-pdoc-date">2012 – 2014</span>
      </div>
      <p className="tmT-before-bullet">
        Built internal tools and fixed reported bugs.
      </p>
      <p className="tmT-before-bullet">
        Assisted senior engineers with day-to-day tasks.
      </p>
      <p className="tmT-before-note">
        …continues for 3 pages. Tasks, not impact. Nothing ranked for the role.
      </p>
    </div>
  );
}

function AfterDoc() {
  return (
    <div className="tm-card tmB-paper tmB-paper--doc tmB-paper--page tmB-paper--after">
      <div className="tmB-pdoc-head">
        <span className="tmB-pdoc-avatar">AM</span>
        <p className="tmB-pdoc-name">Alex Mercer</p>
        <p className="tmB-pdoc-contact">
          Senior Platform Engineer · Copenhagen · alex.m@email.com
        </p>
      </div>
      <div className="tmB-pdoc-rule"></div>
      <p className="tmB-pdoc-sec">Summary</p>
      <p className="tmB-pdoc-summary">
        Senior platform engineer, 9+ years building{" "}
        <mark className="tm-k">distributed systems</mark> at scale — owns
        reliability, performance, and shared deployment standards.
      </p>
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
        standards, cutting incident MTTR <mark className="tm-m">52%</mark> with
        standardized <mark className="tm-k">observability</mark>.
      </p>
      <div className="tmB-pdoc-entry">
        <span className="tmB-pdoc-role">Software Engineer — Versa Labs</span>
        <span className="tmB-pdoc-date">2014 – 2019</span>
      </div>
      <p className="tmB-pdoc-bullet">
        Built the order-events pipeline handling{" "}
        <mark className="tm-m">40k messages/min</mark> with{" "}
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
        <p className="tmT-subhead text-center">
          The same experience, rewritten and ranked for the role — shown at full
          page size.
        </p>
        <div className="tmT-docs mt-[36px]">
          <div className="tmT-doccol">
            <span className="tm-pill tm-pill--gray tmT-doclabel inline-flex">
              Before — 3 pages, generic
            </span>
            <BeforeDoc />
          </div>
          <div className="tmT-docs-arrow">
            <ArrowRight size={22} />
          </div>
          <div className="tmT-doccol">
            <span className="tm-pill tmT-doclabel inline-flex">
              After — 2 pages, tailored to Nordpeak
            </span>
            <AfterDoc />
          </div>
        </div>

        <div className="tmT-kw">
          <p className="tmT-kw-title">
            Keywords we pulled from the Nordpeak posting — highlighted in green
            on the resume above
          </p>
          <div className="tm-keywords justify-center">
            {KEYWORDS.map((k) => (
              <span key={k} className="tm-pill tm-pill--mint">
                <Check size={12} /> {k}
              </span>
            ))}
          </div>
          <div className="tmT-stuffing">
            <p className="tmT-stuffing-head">Why this isn’t keyword stuffing</p>
            <ul>
              <li>
                <Check size={15} />
                <span>
                  Every keyword sits inside a real accomplishment — attached to
                  actual work and a real number, never a hidden list or a wall of
                  repeated terms.
                </span>
              </li>
              <li>
                <Check size={15} />
                <span>
                  We only add a keyword where your experience already backs it.
                  Nothing is invented or exaggerated.
                </span>
              </li>
              <li>
                <Check size={15} />
                <span>
                  One natural mention each, in the posting’s own language — so
                  the ATS scan and a human recruiter both find it, without
                  repetition.
                </span>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}
