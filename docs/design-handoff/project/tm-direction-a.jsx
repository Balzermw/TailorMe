// tm-direction-a.jsx — Direction A: "Quiet confidence".
// Closest evolution of v1: centered hero with an animated resume-transform
// graphic, vertical 5-step journey, classic pricing cards. Calm, assured tone.

function HeroArtA() {
  return (
    <div className="tmA-art" aria-hidden="true">
      <div className="tm-card tmA-doc">
        <div className="tmA-doc-head">
          <span className="tmA-doc-avatar"></span>
          <div>
            <div className="tmA-doc-namebar"></div>
            <div className="tmA-doc-rolebar"></div>
          </div>
          <span className="tm-pill tm-pill--gray tmA-doc-badge">Composite example</span>
        </div>
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="tmA-row" style={{ '--i': i }}>
            <span className="tmA-dot"></span>
            <span className="tmA-bar tmA-bar--old"></span>
            <span className="tmA-bar tmA-bar--new"></span>
            <span className="tmA-chip">{['38% p95 latency', '2.4M daily tx', '6 engineers', 'Kubernetes'][i]}</span>
          </div>
        ))}
        <div className="tmA-ready"><Ic n="check" s={13} /> interview-ready</div>
      </div>
      <span className="tmA-float tmA-float--1">Distributed systems</span>
      <span className="tmA-float tmA-float--2">Node.js at scale</span>
      <span className="tmA-float tmA-float--3">Observability</span>
    </div>
  );
}

function JourneyStepA({ num, eyebrow, title, children }) {
  return (
    <div className="tmA-journey-step">
      <span className="tmA-journey-num">{num}</span>
      <div className="tmA-journey-body">
        <span className="tm-eyebrow">{eyebrow}</span>
        <h3 className="tm-h3">{title}</h3>
        {children}
      </div>
    </div>
  );
}

function DirectionA({ t }) {
  return (
    <div className="tm tmA" data-density={t.density} data-tints={t.tints ? 'on' : 'off'} data-screen-label="Direction A — quiet confidence">
      <TMNav />

      {/* 1 — hero */}
      <section className="tm-sec tmA-hero">
        <span className="tm-pill">Resume tailoring by Res.Me</span>
        <TMHeadline id={t.headline} />
        <p className="tm-body">
          Show us the job you want. We tailor your resume to it line by line, run three
          specialist reviewers over the draft, and hand you concrete fixes — with an
          optional human expert for the final pass.
        </p>
        <div className="tmA-hero-ctas">
          <span className="tm-btn tm-btn--primary tm-btn--lg"><Ic n="sparkles" s={16} /> Get a free resume audit</span>
          <span className="tm-btn tm-btn--outline tm-btn--lg">See a real transformation <Ic n="arrow-down" s={15} /></span>
        </div>
        <p className="tmA-hero-note">First application free · no card required</p>
        <HeroArtA />
      </section>

      {/* 2 — problem & stakes */}
      <section className="tm-sec tm-tint--gray">
        <div className="tm-wrap">
          <h2 className="tm-h2">It’s not your experience. It’s the translation.</h2>
          <p className="tm-body" style={{ marginTop: '14px', maxWidth: '64ch' }}>
            If any of these sound familiar, your resume is the bottleneck — not your career.
          </p>
          <div style={{ marginTop: '34px' }}><PainCards /></div>
          <p className="tm-body" style={{ marginTop: '30px', maxWidth: '70ch' }}>{TM_STAKES}</p>
        </div>
      </section>

      {/* 3 — guide + trust */}
      <section className="tm-sec">
        <div className="tm-wrap tmA-guide">
          <div>
            <span className="tm-eyebrow">Who’s behind this</span>
            <h2 className="tm-h2" style={{ marginTop: '12px' }}>We’ve read thousands of resumes like yours.</h2>
            <p className="tm-body" style={{ marginTop: '16px' }}>
              TailorMe is built by <strong>Res.Me</strong>, the technical resume writing
              team. We took how our writers actually work — read the posting first,
              re-position every line for it, check the result like a recruiter would —
              and built it into a pipeline you can run on any job, any time.
            </p>
            <div style={{ display: 'flex', gap: '10px', marginTop: '22px', flexWrap: 'wrap' }}>
              <span className="tm-pill tm-pill--line"><Ic n="pen-line" s={13} /> Professional resume writers</span>
              <span className="tm-pill tm-pill--line"><Ic n="sparkles" s={13} /> 3 specialist review agents</span>
              <span className="tm-pill tm-pill--line"><Ic n="lock" s={13} /> Encrypted at rest</span>
            </div>
          </div>
          <div className="tm-card tmA-guide-card">
            <Checklist />
          </div>
        </div>
      </section>

      {/* 4 — the plan */}
      <section className="tm-sec tm-tint--blue">
        <div className="tm-wrap">
          <h2 className="tm-h2" style={{ textAlign: 'center' }}>Three steps. One credit per application.</h2>
          <div style={{ marginTop: '36px' }}><PlanSteps /></div>
        </div>
      </section>

      {/* 5 — the transformation */}
      <section className="tm-sec">
        <div className="tm-wrap">
          <h2 className="tm-h2">From your resume to the job you want — in five steps</h2>
          <p className="tm-body" style={{ marginTop: '12px', maxWidth: '70ch' }}>
            One transformation, the way it happens in the product. Composite example drawn
            from common customer patterns — not an actual client resume.
          </p>

          <JourneyStepA num="1" eyebrow="I have a resume" title="Start with the resume you have today">
            <div className="tm-card tmA-resume-card">
              <div className="tmA-resume-head">
                <strong>Alex M. — Senior Software Engineer, 7 yrs</strong>
                <span className="tm-pill tm-pill--gray">Composite example</span>
              </div>
              <blockquote>“Responsible for developing and maintaining features for the web app using React and Node.js.”</blockquote>
              <blockquote>“Worked on bug fixes and performance improvements.”</blockquote>
              <blockquote>“Participated in code reviews and mentoring.”</blockquote>
              <p className="tm-small">Task-based · impact buried · 3 pages · reads like every other senior engineer</p>
            </div>
          </JourneyStepA>

          <JourneyStepA num="2" eyebrow="I want this job" title="Paste the posting you’re targeting">
            <div className="tm-card tmA-posting">
              <strong>Senior Platform Engineer — Nordpeak Systems</strong>
              <p className="tm-small">Copenhagen / Remote EU · posted this week</p>
              <div className="tmA-posting-tags">
                {TM_KEYWORDS.map((k) => <span key={k} className="tm-pill tm-pill--gray">{k}</span>)}
              </div>
              <div style={{ marginTop: '22px', maxWidth: '560px' }}><FitBars title="Fit, scored before you spend a credit" /></div>
            </div>
          </JourneyStepA>

          <JourneyStepA num="3" eyebrow="We tailor it to the job" title="Every line re-written for this posting">
            <BeforeAfter />
          </JourneyStepA>

          <JourneyStepA num="4" eyebrow="Agents review it" title="Actionable feedback, not a vague score">
            <p className="tm-body" style={{ marginBottom: '20px', maxWidth: '66ch' }}>
              Three specialist reviewers go through the draft line by line. Every item is a
              concrete change you can apply — included with every application.
            </p>
            <AgentCards />
          </JourneyStepA>

          <JourneyStepA num="5" eyebrow="Want a human pass?" title="Add a Res.Me expert review">
            <HumanReviewRow />
          </JourneyStepA>
        </div>
      </section>

      {/* 6 — success payoff */}
      <section className="tm-sec tm-tint--mint">
        <div className="tm-wrap" style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '56px', alignItems: 'center' }}>
          <div>
            <h2 className="tm-h2">What goes out the door</h2>
            <p className="tm-body" style={{ marginTop: '14px' }}>
              A compiled, inspected two-page resume and one-page cover letter — re-ranked
              for the posting, every claim scoped with real numbers, keywords aligned only
              where your experience backs them. It reads at your level, because it finally
              says what you actually did.
            </p>
            <div style={{ display: 'flex', gap: '10px', marginTop: '22px', flexWrap: 'wrap' }}>
              <span className="tm-pill tm-pill--mint"><Ic n="check" s={12} /> recruiter-ready</span>
              <span className="tm-pill tm-pill--mint"><Ic n="check" s={12} /> exactly 2 pages</span>
              <span className="tm-pill tm-pill--mint"><Ic n="check" s={12} /> ATS-aligned</span>
            </div>
          </div>
          <DocsRow />
        </div>
      </section>

      {/* 7 — pricing */}
      <section className="tm-sec">
        <div className="tm-wrap">
          <h2 className="tm-h2">Pricing</h2>
          <p className="tm-body" style={{ marginTop: '12px' }}>
            Pay per application. No subscription, credits never expire. Every application
            includes tailoring and the full agent review.
          </p>
          <div style={{ marginTop: '34px' }}><PricingCards emphasis={t.pricingEmphasis} /></div>
          <HumanReviewRow />
          <FreeNote />
        </div>
      </section>

      {/* 8 — FAQ */}
      <section className="tm-sec tm-tint--gray">
        <div className="tm-wrap--narrow">
          <h2 className="tm-h2">Questions, answered straight</h2>
          <div style={{ marginTop: '26px' }}><FaqList /></div>
        </div>
      </section>

      {/* 9 — final CTA + footer */}
      <section className="tm-sec">
        <div className="tm-wrap tm-cta">
          <h2 className="tm-h2">Your next application can be the strong one.</h2>
          <p className="tm-body">Upload your resume, paste the job, and see the difference on your own bullets. The first application is free.</p>
          <span className="tm-btn tm-btn--primary tm-btn--lg"><Ic n="sparkles" s={16} /> Get a free resume audit</span>
          <div style={{ marginTop: '40px' }}><TrustStrip /></div>
        </div>
      </section>
      <TMFooter />
    </div>
  );
}

window.DirectionA = DirectionA;
