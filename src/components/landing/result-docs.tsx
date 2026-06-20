import { Check } from "lucide-react";

function ResumePaper() {
  return (
    <div className="tmB-paperwrap">
      <div className="tmB-paper tmB-paper--doc">
        <div
          style={{
            display: "flex",
            justifyContent: "flex-end",
            marginBottom: "8px",
          }}
        >
          <span
            className="tm-pill tm-pill--mint"
            style={{ fontSize: "10px" }}
          >
            Tailored for Nordpeak
          </span>
        </div>
        <div className="tmB-pdoc-head" style={{ textAlign: "left" }}>
          <p className="tmB-pdoc-name">Alex Mercer</p>
          <p className="tmB-pdoc-contact">
            Senior Platform Engineer · Copenhagen · alex.m@email.com
          </p>
        </div>
        <div className="tmB-pdoc-rule"></div>
        <p
          className="tmB-pdoc-body"
          style={{
            fontSize: "10px",
            fontFamily: "var(--tm-font)",
            color: "var(--tm-zinc)",
            lineHeight: 1.55,
            marginBottom: "10px",
          }}
        >
          Platform engineer specialising in distributed Node.js services,
          checkout reliability, and observability-backed releases for high-volume
          commerce systems.
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
          <mark className="tm-k">distributed Node.js service</mark>, cutting
          p95 latency <mark className="tm-m">38%</mark> across{" "}
          <mark className="tm-m">2.4M daily transactions</mark>.
        </p>
        <p className="tmB-pdoc-bullet">
          Mentored <mark className="tm-m">6 engineers</mark> through promotion
          cycles while owning <mark className="tm-k">Kubernetes</mark>{" "}
          deployment standards.
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
      </div>
      <span className="tmB-paper-foot">
        <Check size={12} /> Resume_Nordpeak.pdf · exactly 2 pages, inspected
      </span>
    </div>
  );
}

function CoverPaper() {
  return (
    <div className="tmB-paperwrap">
      <div className="tmB-paper tmB-paper--doc">
        <div className="tmB-pdoc-head">
          <p className="tmB-pdoc-name">Alex Mercer</p>
          <p className="tmB-pdoc-contact">Copenhagen · alex.m@email.com</p>
        </div>
        <div className="tmB-pdoc-rule"></div>
        <p className="tmB-pdoc-meta">
          Nordpeak Systems — hiring team
          <br />
          Re: Senior Platform Engineer
        </p>
        <p className="tmB-pdoc-body">Dear Nordpeak team,</p>
        <p className="tmB-pdoc-body">
          Your posting asks for someone who has run distributed Node.js services
          in production — that has been my work for the past five years, most
          recently leading the checkout migration at Brightline.
        </p>
        <p className="tmB-pdoc-body">
          I&apos;d welcome the chance to bring that platform experience to Nordpeak.
        </p>
        <p className="tmB-pdoc-body">Sincerely,</p>
        <p className="tmB-pdoc-sig">Alex Mercer</p>
      </div>
      <span className="tmB-paper-foot">
        <Check size={12} /> Cover_Nordpeak.pdf · 1 page, inspected
      </span>
    </div>
  );
}

export default function ResultDocs() {
  return (
    <section className="tm-sec tm-tint--mint">
      <div className="tm-wrap tmB-success">
        <div>
          <h2 className="tm-h2">What goes out the door</h2>
          <p className="tm-body mt-[12px]">
            A compiled, inspected resume and cover letter, re-ranked for the
            posting, with every claim scoped to real numbers and keywords added
            only where your experience backs them.
          </p>
          <div className="mt-[20px] flex flex-wrap gap-[10px]">
            <span className="tm-pill tm-pill--mint">
              <Check size={12} /> recruiter-ready
            </span>
            <span className="tm-pill tm-pill--mint">
              <Check size={12} /> ATS-aligned
            </span>
          </div>
        </div>
        <div className="tmB-result">
          <ResumePaper />
          <CoverPaper />
        </div>
      </div>
    </section>
  );
}
