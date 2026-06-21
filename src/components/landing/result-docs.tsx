import { ArrowUpDown, BarChart3, Search } from "lucide-react";

// The tailored resume that goes out the door — keyword chips (blue) and metrics
// (green) are color-coded to the annotation cards on the right, which explain
// what changed and why it earns its place.
function ResumePaper() {
  return (
    <div className="tmB-paperwrap">
      <div className="tmB-paper tmB-paper--doc tmB-paper--clip">
        <div
          style={{ display: "flex", justifyContent: "flex-end", marginBottom: "8px" }}
        >
          <span className="tm-pill tm-pill--mint" style={{ fontSize: "10px" }}>
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
          Platform engineer specialising in{" "}
          <mark className="tmB-doc-kw">distributed Node.js services</mark>,{" "}
          <mark className="tmB-doc-kw">checkout reliability</mark>, and{" "}
          <mark className="tmB-doc-kw">observability</mark>-backed releases for
          high-volume commerce systems.
        </p>
        <p className="tmB-pdoc-sec">Experience</p>
        <div className="tmB-pdoc-entry">
          <span className="tmB-pdoc-role">
            Senior Software Engineer · Brightline Commerce
          </span>
          <span className="tmB-pdoc-date">2019 – present</span>
        </div>
        <p className="tmB-pdoc-bullet">
          Led migration of checkout to a{" "}
          <mark className="tmB-doc-kw">distributed Node.js service</mark>, cutting
          p95 latency <mark className="tmB-doc-mx">38%</mark> across{" "}
          <mark className="tmB-doc-mx">2.4M daily transactions</mark>.
        </p>
        <p className="tmB-pdoc-bullet">
          Mentored <mark className="tmB-doc-mx">6 engineers</mark> through promotion
          cycles while owning <mark className="tmB-doc-kw">Kubernetes</mark>{" "}
          deployment standards.
        </p>
        <div className="tmB-pdoc-entry">
          <span className="tmB-pdoc-role">Software Engineer · Versa Labs</span>
          <span className="tmB-pdoc-date">2014 – 2019</span>
        </div>
        <p className="tmB-pdoc-bullet">
          Built the order-events pipeline handling{" "}
          <mark className="tmB-doc-mx">40k messages/min</mark> with{" "}
          <mark className="tmB-doc-kw">observability</mark> baked in.
        </p>
        <p className="tmB-pdoc-sec">Skills</p>
        <p className="tmB-pdoc-skills">
          <mark className="tmB-doc-kw">Distributed systems</mark> ·{" "}
          <mark className="tmB-doc-kw">Node.js at scale</mark> ·{" "}
          <mark className="tmB-doc-kw">Kubernetes</mark> ·{" "}
          <mark className="tmB-doc-kw">Observability</mark> · Mentorship
        </p>
        {/* Faint trimmed continuation — signals this is a clipping, not the full résumé. */}
        <div className="tmB-pdoc-cont" aria-hidden="true">
          <span className="tmB-pdoc-cont-head" />
          <span className="tmB-pdoc-cont-line" style={{ width: "94%" }} />
          <span className="tmB-pdoc-cont-line" style={{ width: "85%" }} />
          <span className="tmB-pdoc-cont-line" style={{ width: "68%" }} />
        </div>
      </div>
    </div>
  );
}

// Each change, annotated: what we did, where it came from, why it earns its place.
const ANNOTATIONS = [
  {
    Icon: Search,
    bg: "var(--tm-blue-50)",
    fg: "var(--tm-blue-600)",
    num: "7",
    unit: "keywords",
    from: "from the Nordpeak posting",
    desc: "Added only where your history already backs them. Never stuffed.",
  },
  {
    Icon: BarChart3,
    bg: "var(--tm-mint-50)",
    fg: "var(--tm-mint-600)",
    num: "4",
    unit: "metrics",
    from: "pulled from your real work",
    desc: "p95 latency, transaction volume, throughput, team size. All scoped to truth.",
  },
  {
    Icon: ArrowUpDown,
    bg: "#eceef3",
    fg: "var(--tm-ink)",
    num: "",
    unit: "Re-ranked",
    from: "for this posting",
    desc: "Your strongest, most relevant bullets surface to the top.",
  },
];

export default function ResultDocs() {
  return (
    <section className="tm-sec tm-tint--mint">
      <div className="tm-wrap">
        <h2 className="tm-h2">What goes out the door.</h2>
        <p className="tm-body mt-[12px] max-w-[64ch]">
          Here&apos;s exactly what we changed, and why each change earns its place.
        </p>
        <div className="tmB-annot-grid">
          <ResumePaper />
          <div className="tmB-annot-list">
            {ANNOTATIONS.map(({ Icon, bg, fg, num, unit, from, desc }) => (
              <div key={unit} className="tmB-annot">
                <span className="tmB-annot-ic" style={{ background: bg, color: fg }}>
                  <Icon size={18} />
                </span>
                <div className="tmB-annot-body">
                  <p className="tmB-annot-head" style={{ color: fg }}>
                    {num && <span className="tmB-annot-num">{num}</span>}
                    {unit}
                    {" "}
                    <span className="tmB-annot-from">{from}</span>
                  </p>
                  <p className="tmB-annot-desc">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
