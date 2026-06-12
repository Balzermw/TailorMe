// tm-direction-b.jsx — Direction B: "Show the machine".
// Dense, data-forward. Split hero with a live pipeline rail, transformation as a
// step-rail layout with the terminal replay, pricing as a comparison table.

function HeroArtB() {
  return (
    <div className="tmB-art" aria-hidden="true">
      <div className="tm-card tmB-doc">
        <div className="tmB-scan"></div>
        <div className="tmB-doc-bar b1"></div>
        <div className="tmB-doc-bar b2"></div>
        <div className="tmB-doc-bar b3" style={{ marginTop: '8px' }}></div>
        <div className="tmB-doc-bar b4"></div>
        <div className="tmB-doc-bar mint b5"></div>
        <div className="tmB-doc-bar b6"></div>
        <div className="tmB-doc-bar b3"></div>
        <div className="tmB-doc-bar mint b4"></div>
        <div className="tmB-doc-bar b2"></div>
      </div>
      <div className="tm-card tmB-rail">
        {[
          ['Read the job posting', 'paste a URL or the posting text'],
          ['Tailor every bullet', 'rewritten for this job, not in general'],
          ['Three agents review', 'ATS, impact & role-fit fixes applied'],
          ['Build the final PDF', 'compiled, then checked page by page'],
        ].map(([p, sub], i) => (
          <div key={p} className="tmB-stage" style={{ '--i': i }}>
            <span className="tmB-stage-dot"></span>
            <span className="tmB-stage-txt"><b>{p}</b><span>{sub}</span></span>
          </div>
        ))}
      </div>
      <div className="tm-card tmB-hero-michael">
        <img src="assets/michael.png" alt="Michael, head of Res.Me" />
        <span>
          <b>Human review by Michael</b>
          <span>Head of Res.Me · CPRW · optional on any run</span>
        </span>
      </div>
    </div>
  );
}

function PainVizTasklist() {
  return (
    <div className="tmB-pviz" aria-hidden="true">
      {[68, 62, 70, 64].map((w, i) => (
        <div key={i} className="tmB-pviz-row">
          <span className="tmB-pviz-dot"></span>
          <span className="tmB-pviz-bar" style={{ width: w + '%' }}></span>
        </div>
      ))}
    </div>
  );
}

function PainVizSilence() {
  return (
    <div className="tmB-pviz tmB-pviz--row" aria-hidden="true">
      {[1, 0.7, 0.45, 0.25].map((o, i) => (
        <span key={i} className="tmB-pviz-app" style={{ opacity: o }}></span>
      ))}
      <span className="tm-pill tm-pill--gray">0 replies</span>
    </div>
  );
}

function PainVizBuried() {
  return (
    <div className="tmB-pviz" aria-hidden="true">
      <div className="tmB-pviz-row"><span className="tmB-pviz-bar" style={{ width: '84%' }}></span></div>
      <div className="tmB-pviz-row"><span className="tmB-pviz-bar" style={{ width: '72%' }}></span></div>
      <div className="tmB-pviz-row">
        <span className="tmB-pviz-bar tmB-pviz-bar--value" style={{ width: '34%' }}></span>
        <span className="tmB-pviz-note">your real impact</span>
      </div>
      <div className="tmB-pviz-row"><span className="tmB-pviz-bar" style={{ width: '78%' }}></span></div>
    </div>
  );
}

const TMB_PAIN_VIZ = [PainVizTasklist, PainVizSilence, PainVizBuried];

function ResultDocs() {
  return (
    <div className="tmB-result">
      <div className="tmB-paperwrap">
        <div className="tmB-paper tmB-paper--stack tmB-paper--doc">
          <div className="tmB-pdoc-head">
            <span className="tmB-pdoc-avatar">AM</span>
            <p className="tmB-pdoc-name">Alex Mercer</p>
            <p className="tmB-pdoc-contact">Senior Platform Engineer · Copenhagen · alex.m@email.com</p>
          </div>
          <div className="tmB-pdoc-rule"></div>
          <p className="tmB-pdoc-sec">Experience</p>
          <div className="tmB-pdoc-entry"><span className="tmB-pdoc-role">Senior Software Engineer — Brightline Commerce</span><span className="tmB-pdoc-date">2019 – present</span></div>
          <p className="tmB-pdoc-bullet">Led migration of checkout to a <mark className="tm-k">distributed Node.js service</mark>, cutting p95 latency <mark className="tm-m">38%</mark> across 2.4M daily transactions.</p>
          <p className="tmB-pdoc-bullet">Mentored <mark className="tm-m">6 engineers</mark> through promotion cycles while owning <mark className="tm-k">Kubernetes</mark> deployment standards.</p>
          <div className="tmB-pdoc-entry"><span className="tmB-pdoc-role">Software Engineer — Versa Labs</span><span className="tmB-pdoc-date">2014 – 2019</span></div>
          <p className="tmB-pdoc-bullet">Built the order-events pipeline handling 40k messages/min with <mark className="tm-k">observability</mark> baked in.</p>
          <p className="tmB-pdoc-sec">Skills</p>
          <p className="tmB-pdoc-skills">Distributed systems · Node.js at scale · Kubernetes · Observability · Mentorship</p>
          <p className="tmB-pdoc-foot">1 / 2</p>
        </div>
        <span className="tmB-paper-foot"><Ic n="check" s={12} /> Resume_Nordpeak.pdf · exactly 2 pages, inspected</span>
      </div>
      <div className="tmB-paperwrap">
        <div className="tmB-paper tmB-paper--doc">
          <div className="tmB-pdoc-head">
            <p className="tmB-pdoc-name">Alex Mercer</p>
            <p className="tmB-pdoc-contact">Copenhagen · alex.m@email.com</p>
          </div>
          <div className="tmB-pdoc-rule"></div>
          <p className="tmB-pdoc-meta">Nordpeak Systems — hiring team<br />Re: Senior Platform Engineer</p>
          <p className="tmB-pdoc-body">Dear Nordpeak team,</p>
          <p className="tmB-pdoc-body">Your posting asks for someone who has run distributed Node.js services in production — that has been my work for the past five years, most recently leading the checkout migration at Brightline.</p>
          <p className="tmB-pdoc-body">I’d welcome the chance to bring that platform experience to Nordpeak.</p>
          <p className="tmB-pdoc-body">Sincerely,</p>
          <p className="tmB-pdoc-sig">Alex Mercer</p>
        </div>
        <span className="tmB-paper-foot"><Ic n="check" s={12} /> Cover_Nordpeak.pdf · 1 page, inspected</span>
      </div>
    </div>
  );
}

function DirectionB({ t, pageMode }) {
  return (
    <div className={'tm tmB' + (pageMode ? ' tm--page' : '')} data-density={t.density} data-tints={t.tints ? 'on' : 'off'} data-screen-label="Direction B — show the machine">
      <TMNav />

      {/* 1 — hero */}
      <section className="tm-sec">
        <div className="tm-wrap tmB-hero">
          <div>
            <TMHeadline id={t.headline} />
            <p className="tm-body">
              Paste a job posting. TailorMe rewrites your resume for it, then three
              specialist agents review the draft the way the ATS, the recruiter, and the
              hiring manager will — and return fixes, not a score.
            </p>
            <div className="tmB-hero-ctas">
              <a className="tm-btn tm-btn--primary" href="Free Audit.html"><Ic n="sparkles" s={15} /> Get a free resume audit</a>
              <a className="tm-btn tm-btn--outline" href="Transformation.html">See a real transformation</a>
            </div>
            <p className="tm-small" style={{ marginTop: '22px' }}>First application free · no card · credits never expire</p>
          </div>
          <HeroArtB />
        </div>
      </section>

      {/* 2 — problem strip */}
      <section className="tm-sec tm-tint--gray">
        <div className="tm-wrap">
          <h2 className="tm-h2">The resume is the bottleneck</h2>
          <p className="tm-body" style={{ marginTop: '10px', maxWidth: '66ch' }}>
            What we hear from senior candidates — and what it costs them in response rates.
          </p>
          <div className="tmB-strip" style={{ marginTop: '24px' }}>
            {TM_PAINS.map((p, i) => {
              const Viz = TMB_PAIN_VIZ[i];
              return (
                <div key={p.q} className="tm-card tmB-quote">
                  <Viz />
                  <q>{p.q}</q>
                  <p>{p.d}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* 3 — guide: who reviews your resume */}
      <section className="tm-sec">
        <div className="tm-wrap">
          <h2 className="tm-h2">Who’s actually reviewing your resume</h2>
          <p className="tm-body" style={{ marginTop: '10px', maxWidth: '64ch' }}>
            TailorMe is built by Res.Me, the technical resume writers. The pipeline encodes
            how they work — and the same expert is behind the optional human pass.
          </p>
          <div className="tmB-guide" style={{ marginTop: '30px' }}>
            <div className="tm-card tmB-guide-card">
              <span className="tm-eyebrow"><Ic n="sparkles" s={14} /> The three agents</span>
              <div className="tmB-expert">
                <div className="tmB-agent-stack" aria-hidden="true">
                  <span className="tmB-agent-face tmB-agent-face--blue"><Ic n="search" s={20} /></span>
                  <span className="tmB-agent-face tmB-agent-face--mint"><Ic n="trending-up" s={20} /></span>
                  <span className="tmB-agent-face tmB-agent-face--deep"><Ic n="target" s={20} /></span>
                </div>
                <div>
                  <h3 className="tm-h3">Each one reads like a different gatekeeper</h3>
                  <p className="tm-small" style={{ marginTop: '2px' }}>ATS · impact · role-fit — spawned fresh for every application</p>
                </div>
              </div>
              <p className="tm-small">
                A fresh reviewer is spawned for every application — it researches the
                company first, then critiques your draft from three angles: how the ATS
                parser will index it, how a recruiter skims it in thirty seconds, and how
                the hiring manager judges role-fit.
              </p>
              <p className="tm-small">
                The output isn’t a score. It’s a list of line-level edits — “this bullet
                needs a baseline metric,” “move platform work above frontend” — each one
                applied to the draft before it compiles.
              </p>
            </div>
            <div className="tm-card tmB-guide-card">
              <span className="tm-eyebrow" style={{ color: 'var(--tm-mint-600)' }}><Ic n="pen-line" s={14} /> The human expert</span>
              <div className="tmB-expert">
                <img className="tmB-expert-photo" src="assets/michael.png" alt="Michael, head of Res.Me" />
                <div>
                  <h3 className="tm-h3">Michael — head of Res.Me</h3>
                  <p className="tm-small" style={{ marginTop: '2px' }}>The writer behind Res.Me’s coaching practice</p>
                </div>
              </div>
              <p className="tm-small">
                The optional +$49 pass isn’t a generic proofread — it’s Michael’s
                line-by-line review of your final draft:
              </p>
              <div className="tmB-creds">
                {['Certified Professional Resume Writer', '15+ years of experience', '650+ resumes written', 'Fiverr Top Rated Pro · 4.8/5 across 200+ reviews'].map((c) => (
                  <span key={c} className="tmB-cred"><Ic n="check" s={12} /> {c}</span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 4 — plan */}
      <section className="tm-sec tm-tint--blue">
        <div className="tm-wrap">
          <h2 className="tm-h2" style={{ textAlign: 'center' }}>How it works</h2>
          <div style={{ marginTop: '28px' }}><PlanSteps /></div>
        </div>
      </section>

      {/* 5 — transformation, one artifact per step */}
      <section className="tm-sec">
        <div className="tm-wrap">
          <h2 className="tm-h2">Watch a real application run</h2>
          <p className="tm-body" style={{ marginTop: '10px', maxWidth: '70ch' }}>
            One composite candidate, one real posting — the same four moments, every time.
          </p>

          <div className="tmB-tl">

            <div className="tmB-tl-step">
              <span className="tmB-tl-dot">1</span>
              <div className="tmB-tl-body">
                <h3 className="tmB-tl-title">The job</h3>
                <p className="tmB-tl-sub">Paste a URL. Fit is scored before you spend a credit.</p>
                <div className="tm-card tmB-tl-card tmB-tl-job">
                  <Ic n="clipboard-list" s={17} />
                  <span><b>Senior Platform Engineer</b> — Nordpeak Systems</span>
                  <span className="tm-pill tm-pill--mint" style={{ marginLeft: 'auto' }}>84 — strong fit</span>
                </div>
              </div>
            </div>

            <div className="tmB-tl-step">
              <span className="tmB-tl-dot">2</span>
              <div className="tmB-tl-body">
                <h3 className="tmB-tl-title">The rewrite</h3>
                <p className="tmB-tl-sub">Every bullet, re-written for this posting. One example:</p>
                <div className="tm-card tmB-tl-card tmB-tl-rw">
                  <p className="tmB-tl-before">“Responsible for developing and maintaining features for the web app using React and Node.js.”</p>
                  <span className="tmB-tl-arrow"><Ic n="arrow-down" s={15} /></span>
                  <p className="tmB-tl-after">“Led migration of checkout to a <mark className="tm-k">distributed Node.js service</mark>, cutting p95 latency <mark className="tm-m">38%</mark> across <mark className="tm-m">2.4M daily transactions</mark>.”</p>
                </div>
              </div>
            </div>

            <div className="tmB-tl-step">
              <span className="tmB-tl-dot">3</span>
              <div className="tmB-tl-body">
                <h3 className="tmB-tl-title">The review</h3>
                <p className="tmB-tl-sub">Three agents read the draft. Each note is a concrete change.</p>
                <div className="tm-card tmB-tl-card">
                  {TM_AGENTS.map((a) => (
                    <p key={a.name} className="tmB-rq-item">
                      <span className="tm-pill">{a.name}</span>
                      {a.notes[0].txt}
                    </p>
                  ))}
                </div>
              </div>
            </div>

            <div className="tmB-tl-step">
              <span className="tmB-tl-dot"><Ic n="check" s={14} /></span>
              <div className="tmB-tl-body">
                <h3 className="tmB-tl-title">The result</h3>
                <p className="tmB-tl-sub">Compiled, inspected for page breaks, ready to send.</p>
                <div className="tm-card tmB-tl-card tmB-tl-out">
                  <span className="tmB-ev-file"><Ic n="file-text" s={15} /> Resume_Nordpeak.pdf <span className="ok"><Ic n="check" s={11} /> 2 pages</span></span>
                  <span className="tmB-ev-file"><Ic n="file-text" s={15} /> Cover_Nordpeak.pdf <span className="ok"><Ic n="check" s={11} /> 1 page</span></span>
                  <span className="tm-btn tm-btn--primary tm-btn--sm" style={{ justifyContent: 'center', marginTop: '6px' }}><Ic n="download" s={14} /> Download both — 1 credit</span>
                </div>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* 6 — success: the end-result documents */}
      <section className="tm-sec tm-tint--mint">
        <div className="tm-wrap" style={{ display: 'grid', gridTemplateColumns: '0.85fr 1.25fr', gap: '52px', alignItems: 'center' }}>
          <div>
            <h2 className="tm-h2">What goes out the door</h2>
            <p className="tm-body" style={{ marginTop: '12px' }}>
              A compiled, inspected two-page resume and one-page cover letter — re-ranked
              for the posting, every claim scoped with real numbers, keywords aligned only
              where your experience backs them.
            </p>
            <div style={{ display: 'flex', gap: '10px', marginTop: '20px', flexWrap: 'wrap' }}>
              <span className="tm-pill tm-pill--mint"><Ic n="check" s={12} /> recruiter-ready</span>
              <span className="tm-pill tm-pill--mint"><Ic n="check" s={12} /> ATS-aligned</span>
            </div>
          </div>
          <ResultDocs />
        </div>
      </section>

      {/* 7 — pricing table */}
      <section className="tm-sec">
        <div className="tm-wrap">
          <h2 className="tm-h2">Pricing</h2>
          <p className="tm-body" style={{ marginTop: '10px' }}>
            Pay per application. No subscription, no API keys, credits never expire.
          </p>
          <div style={{ marginTop: '26px' }}><PricingTable emphasis={t.pricingEmphasis} /></div>
          <HumanReviewRow />
          <FreeNote />
        </div>
      </section>

      {/* 8 — FAQ */}
      <section className="tm-sec tm-tint--gray">
        <div className="tm-wrap">
          <h2 className="tm-h2">Objections, answered</h2>
          <div style={{ marginTop: '22px' }}><FaqList cols openFirst={false} /></div>
        </div>
      </section>

      {/* 9 — CTA + footer */}
      <section className="tm-sec">
        <div className="tm-wrap tm-cta">
          <h2 className="tm-h2">Run your first application free.</h2>
          <p className="tm-body">Five dimensions scored, every line tailored, three reviewers — before you pay anything.</p>
          <a className="tm-btn tm-btn--primary tm-btn--lg" href="Free Audit.html"><Ic n="sparkles" s={16} /> Get a free resume audit</a>
          <div style={{ marginTop: '34px' }}><TrustStrip /></div>
        </div>
      </section>
      <TMFooter />
    </div>
  );
}

window.DirectionB = DirectionB;
