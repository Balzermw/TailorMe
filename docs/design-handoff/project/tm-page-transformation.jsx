// tm-page-transformation.jsx — "See a real transformation" case study.

function BeforeDoc() {
  return (
    <div className="tm-card tmB-paper tmB-paper--before">
      <div className="tmB-pdoc-head">
        <p className="tmB-pdoc-name">Alex Mercer</p>
        <p className="tmB-pdoc-contact">Software Engineer · alex.m@email.com</p>
      </div>
      <div className="tmB-pdoc-rule" style={{ opacity: 0.25 }}></div>
      <p className="tmB-pdoc-sec" style={{ borderColor: 'var(--tm-border)' }}>Experience</p>
      <div className="tmB-pdoc-entry"><span className="tmB-pdoc-role" style={{ fontFamily: 'var(--tm-font)', fontWeight: 500 }}>Senior Software Engineer — Brightline Commerce</span><span className="tmB-pdoc-date">2019 – present</span></div>
      <p className="tmT-before-bullet">Responsible for developing and maintaining features for the web app using React and Node.js.</p>
      <p className="tmT-before-bullet">Worked on bug fixes and performance improvements.</p>
      <p className="tmT-before-bullet">Participated in code reviews and mentoring.</p>
      <div className="tmB-pdoc-entry"><span className="tmB-pdoc-role" style={{ fontFamily: 'var(--tm-font)', fontWeight: 500 }}>Software Engineer — Versa Labs</span><span className="tmB-pdoc-date">2014 – 2019</span></div>
      <p className="tmT-before-bullet">Wrote backend services and helped with deployments.</p>
      <p className="tmT-before-bullet">Attended sprint planning and worked with the QA team.</p>
      <p className="tmT-before-note">…continues for 3 pages. Tasks, not impact. Nothing ranked for the role.</p>
    </div>
  );
}

function AfterDoc() {
  return (
    <div className="tm-card tmB-paper tmB-paper--stack tmB-paper--doc">
      <div className="tmB-pdoc-head">
        <span className="tmB-pdoc-avatar">AM</span>
        <p className="tmB-pdoc-name">Alex Mercer</p>
        <p className="tmB-pdoc-contact">Senior Platform Engineer · Copenhagen · alex.m@email.com</p>
      </div>
      <div className="tmB-pdoc-rule"></div>
      <p className="tmB-pdoc-sec">Experience</p>
      <div className="tmB-pdoc-entry"><span className="tmB-pdoc-role">Senior Software Engineer — Brightline Commerce</span><span className="tmB-pdoc-date">2019 – present</span></div>
      <p className="tmB-pdoc-bullet">Led migration of checkout to a <mark className="tm-k">distributed Node.js service</mark>, cutting p95 latency <mark className="tm-m">38%</mark> across <mark className="tm-m">2.4M daily transactions</mark>.</p>
      <p className="tmB-pdoc-bullet">Mentored <mark className="tm-m">6 engineers</mark> through promotion cycles while owning <mark className="tm-k">Kubernetes</mark> deployment standards.</p>
      <div className="tmB-pdoc-entry"><span className="tmB-pdoc-role">Software Engineer — Versa Labs</span><span className="tmB-pdoc-date">2014 – 2019</span></div>
      <p className="tmB-pdoc-bullet">Built the order-events pipeline handling 40k messages/min with <mark className="tm-k">observability</mark> baked in.</p>
      <p className="tmB-pdoc-sec">Skills</p>
      <p className="tmB-pdoc-skills">Distributed systems · Node.js at scale · Kubernetes · Observability · Mentorship</p>
      <p className="tmB-pdoc-foot">1 / 2</p>
    </div>
  );
}

function TransformationPage({ t }) {
  return (
    <div className="tm tmB tm--page" data-density={t.density} data-tints={t.tints ? 'on' : 'off'} data-screen-label="Transformation case study">
      <TMNav active="" />

      <section className="tm-sec tmF-head">
        <span className="tm-pill tm-pill--gray">Case study · labeled composite, not a real client</span>
        <h1 className="tm-h1">One application, end to end</h1>
        <p className="tm-body">
          Alex M. — a senior software engineer with 7 years of real impact and a resume
          that read like a task list — tailored to one posting at Nordpeak Systems.
        </p>
      </section>

      {/* the job */}
      <section className="tm-sec tm-tint--gray" style={{ paddingTop: 'calc(var(--sy) * 0.6)' }}>
        <div className="tm-wrap tmT-grid2">
          <div className="tm-card tmA-posting" style={{ maxWidth: 'none' }}>
            <span className="tm-eyebrow" style={{ marginBottom: '10px' }}>The job</span>
            <strong>Senior Platform Engineer — Nordpeak Systems</strong>
            <p className="tm-small">Copenhagen / Remote EU · pasted as a URL</p>
            <div className="tmA-posting-tags">
              {TM_KEYWORDS.map((k) => <span key={k} className="tm-pill tm-pill--gray">{k}</span>)}
            </div>
          </div>
          <div className="tm-card" style={{ padding: '24px' }}>
            <div className="tmT-verdict">
              <strong>84</strong>
              <div>
                <span className="tm-pill tm-pill--mint">strong fit</span>
                <p className="tm-small" style={{ marginTop: '6px' }}>Scored before drafting — weak fits get flagged, not flattered.</p>
              </div>
            </div>
            <div className="tmF-fit"><FitBars title="Five dimensions" /></div>
          </div>
        </div>
      </section>

      {/* the documents */}
      <section className="tm-sec">
        <div className="tm-wrap">
          <h2 className="tm-h2" style={{ textAlign: 'center' }}>The resume, before and after</h2>
          <div className="tmT-docs" style={{ marginTop: '36px' }}>
            <div>
              <span className="tm-pill tm-pill--gray tmT-doclabel" style={{ display: 'inline-flex' }}>Before — 3 pages, generic</span>
              <BeforeDoc />
            </div>
            <div className="tmT-docs-arrow"><Ic n="arrow-right" s={20} /></div>
            <div>
              <span className="tm-pill tmT-doclabel" style={{ display: 'inline-flex' }}>After — 2 pages, tailored to Nordpeak</span>
              <AfterDoc />
            </div>
          </div>
          <div className="tm-keywords" style={{ justifyContent: 'center' }}>
            <span className="tm-keywords-label">Keyword alignment:</span>
            {TM_KEYWORDS.map((k) => (
              <span key={k} className="tm-pill tm-pill--mint"><Ic n="check" s={12} /> {k}</span>
            ))}
          </div>
        </div>
      </section>

      {/* full agent notes */}
      <section className="tm-sec tm-tint--blue">
        <div className="tm-wrap">
          <h2 className="tm-h2">Everything the three agents flagged</h2>
          <p className="tm-body" style={{ marginTop: '10px', maxWidth: '64ch' }}>
            The full review for this run — every note a concrete, line-level change.
          </p>
          <div style={{ marginTop: '28px' }}><AgentCards /></div>
        </div>
      </section>

      {/* output + CTA */}
      <section className="tm-sec">
        <div className="tm-wrap tm-cta">
          <h2 className="tm-h2">Your bullets can do this too.</h2>
          <p className="tm-body">Run the same pipeline on your own resume — the first application is free.</p>
          <a className="tm-btn tm-btn--primary tm-btn--lg" href="Free Audit.html"><Ic n="sparkles" s={16} /> Get a free resume audit</a>
          <div style={{ marginTop: '34px' }}><TrustStrip /></div>
        </div>
      </section>
      <TMFooter />
    </div>
  );
}

function TransformationApp() {
  const [t, setTweak] = useTweaks({ density: 'regular', tints: true });
  return (
    <React.Fragment>
      <TransformationPage t={t} />
      <TweaksPanel>
        <TweakSection label="Layout" />
        <TweakRadio label="Density" value={t.density} options={['compact', 'regular', 'comfy']} onChange={(v) => setTweak('density', v)} />
        <TweakToggle label="Section tints" value={t.tints} onChange={(v) => setTweak('tints', v)} />
      </TweaksPanel>
    </React.Fragment>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<TransformationApp />);
