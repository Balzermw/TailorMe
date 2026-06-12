// tm-direction-c.jsx — Direction C: "Big type, human voice".
// Oversized editorial type, generous air, empathetic copy. The transformation is
// the centerpiece; everything else stays quiet around it.

function HeroArtC() {
  return (
    <div className="tm-card tmC-swap" aria-hidden="true">
      <span className="tmC-swap-label">one line, rewritten</span>
      <p className="tmC-line tmC-line--before">
        “Responsible for developing and maintaining features for the web app using React and Node.js.”
      </p>
      <p className="tmC-line tmC-line--after">
        “Led migration of checkout to a <mark className="tm-k">distributed Node.js service</mark>,
        cutting p95 latency <mark className="tm-m">38%</mark>.”
      </p>
    </div>
  );
}

function DirectionC({ t }) {
  return (
    <div className="tm tmC" data-density={t.density} data-tints={t.tints ? 'on' : 'off'} data-screen-label="Direction C — big type, human voice">
      <TMNav />

      {/* 1 — hero */}
      <section className="tm-sec tmC-hero">
        <div className="tm-wrap">
          <span className="tm-eyebrow">TailorMe — resume tailoring by Res.Me</span>
          <div className="tmC-hero-row" style={{ marginTop: '24px' }}>
            <div>
              <TMHeadline id={t.headline} />
              <p className="tm-body">
                You’ve done the work. We make it read that way — tailored to the one job
                you want, reviewed line by line, never padded with hype.
              </p>
              <div className="tmC-hero-ctas">
                <span className="tm-btn tm-btn--primary tm-btn--lg">Get a free resume audit</span>
                <span className="tm-btn tm-btn--ghost">See a real transformation <Ic n="arrow-down" s={15} /></span>
              </div>
              <p className="tm-small" style={{ marginTop: '14px' }}>First application free · no card required</p>
            </div>
            <HeroArtC />
          </div>
        </div>
      </section>

      {/* 2 — problem as pull-quotes */}
      <section className="tm-sec tm-tint--gray">
        <div className="tm-wrap">
          <span className="tm-eyebrow">We hear this every week</span>
          <div className="tmC-pains" style={{ marginTop: '28px' }}>
            <p className="tmC-pain">“My strong work <strong>reads like a task list</strong>.”</p>
            <p className="tmC-pain">“I apply everywhere and <strong>hear nothing back</strong>.”</p>
            <p className="tmC-pain">“Recruiters <strong>don’t see my value</strong>.”</p>
          </div>
          <p className="tm-body" style={{ marginTop: '36px', maxWidth: '64ch' }}>{TM_STAKES}</p>
        </div>
      </section>

      {/* 3 — guide */}
      <section className="tm-sec">
        <div className="tm-wrap--narrow">
          <h2 className="tm-h2">We’ve read thousands of resumes like yours.</h2>
          <p className="tm-body" style={{ marginTop: '20px' }}>
            TailorMe is built by <strong>Res.Me</strong>, the technical resume writing team.
            The pipeline works the way our writers do: read the posting first, re-position
            every line for it, then check the result like a recruiter would. Three
            specialist reviewers on every application — and a human writer whenever you
            want one.
          </p>
          <div style={{ display: 'flex', gap: '10px', marginTop: '26px', flexWrap: 'wrap' }}>
            <span className="tm-pill tm-pill--line"><Ic n="pen-line" s={13} /> Professional resume writers</span>
            <span className="tm-pill tm-pill--line"><Ic n="sparkles" s={13} /> 3 specialist review agents</span>
            <span className="tm-pill tm-pill--line"><Ic n="lock" s={13} /> Encrypted at rest</span>
          </div>
        </div>
      </section>

      {/* 4 — plan, big numerals */}
      <section className="tm-sec tm-tint--blue">
        <div className="tm-wrap">
          <h2 className="tm-h2">The plan is short.</h2>
          <div className="tmC-bignum" style={{ marginTop: '40px' }}>
            {TM_PLAN.map((s, i) => (
              <div key={s.t} className="tmC-bignum-step">
                <i>0{i + 1}</i>
                <h3>{s.t}</h3>
                <p>{s.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 5 — the transformation, centered */}
      <section className="tm-sec">
        <div className="tm-wrap">
          <h2 className="tm-h2" style={{ textAlign: 'center' }}>The same seven years. Rewritten.</h2>
          <p className="tm-body" style={{ textAlign: 'center', margin: '16px auto 0', maxWidth: '58ch' }}>
            Alex M., Senior Software Engineer — a composite example, tailored to a Senior
            Platform Engineer posting at Nordpeak Systems.
          </p>
          <div className="tmC-ba" style={{ marginTop: '44px' }}>
            <div className="tm-card tm-ba-card tm-ba-card--before">
              <span className="tm-pill tm-pill--gray tm-ba-label">Before</span>
              {TM_BULLETS.map((b, i) => <p key={i}>{b.before}</p>)}
            </div>
            <span className="tmC-ba-arrow"><Ic n="arrow-down" s={24} /></span>
            <div className="tm-card tm-ba-card tm-ba-card--after">
              <span className="tm-pill tm-ba-label">After — tailored to Nordpeak</span>
              {TM_BULLETS.map((b, i) => <p key={i}><Rich parts={b.after} /></p>)}
            </div>
          </div>
          <div className="tm-keywords" style={{ justifyContent: 'center' }}>
            <span className="tm-keywords-label">Keyword alignment:</span>
            {TM_KEYWORDS.map((k) => (
              <span key={k} className="tm-pill tm-pill--mint"><Ic n="check" s={12} /> {k}</span>
            ))}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '64px', alignItems: 'center', marginTop: 'calc(var(--sy) * 0.8)' }}>
            <div className="tmC-stat">
              <strong>84</strong>
              <div>
                <h3 className="tm-h3">strong fit</h3>
                <p className="tm-small" style={{ marginTop: '6px' }}>
                  Scored across five dimensions — technical, experience, culture, career
                  alignment, logistics — before a single word was drafted.
                </p>
              </div>
            </div>
            <div className="tmC-quotes">
              <span className="tm-eyebrow">What the reviewers said</span>
              {TM_AGENTS.map((a) => (
                <p key={a.name} className="tmC-quote">
                  <span className={'tm-pill ' + (a.notes[0].t === 'fix' ? '' : 'tm-pill--mint')}>{a.name}</span>
                  {a.notes[0].txt}
                </p>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* 6 — success payoff */}
      <section className="tm-sec tm-tint--mint">
        <div className="tm-wrap--narrow" style={{ textAlign: 'center' }}>
          <h2 className="tm-h2">It finally says what you actually did.</h2>
          <p className="tm-body" style={{ margin: '18px auto 0', maxWidth: '56ch' }}>
            Two inspected pages, re-ranked for the posting, every claim scoped with real
            numbers. Recruiter-ready — no guarantees, no hype, just your work translated.
          </p>
          <div style={{ display: 'flex', gap: '10px', marginTop: '24px', justifyContent: 'center', flexWrap: 'wrap' }}>
            <span className="tm-pill tm-pill--mint"><Ic n="check" s={12} /> recruiter-ready</span>
            <span className="tm-pill tm-pill--mint"><Ic n="check" s={12} /> exactly 2 pages</span>
            <span className="tm-pill tm-pill--mint"><Ic n="check" s={12} /> ATS-aligned</span>
          </div>
        </div>
      </section>

      {/* 7 — pricing */}
      <section className="tm-sec">
        <div className="tm-wrap">
          <h2 className="tm-h2" style={{ textAlign: 'center' }}>Pay per application. That’s it.</h2>
          <p className="tm-body" style={{ textAlign: 'center', margin: '14px auto 0', maxWidth: '50ch' }}>
            No subscription, no API keys, credits never expire.
          </p>
          <div style={{ marginTop: '40px', maxWidth: '980px', marginLeft: 'auto', marginRight: 'auto' }}>
            <PricingCards emphasis={t.pricingEmphasis} />
          </div>
          <p className="tm-body" style={{ textAlign: 'center', marginTop: '32px', maxWidth: '54ch', marginLeft: 'auto', marginRight: 'auto' }}>
            Want human eyes on it? Add a Res.Me writer’s line-by-line pass to any
            application for <strong>+$49</strong>, returned within 48 hours.
          </p>
          <FreeNote />
        </div>
      </section>

      {/* 8 — FAQ */}
      <section className="tm-sec tm-tint--gray">
        <div className="tm-wrap--narrow">
          <h2 className="tm-h2">Fair questions</h2>
          <div style={{ marginTop: '28px' }}><FaqList /></div>
        </div>
      </section>

      {/* 9 — CTA + footer */}
      <section className="tm-sec">
        <div className="tm-wrap tm-cta">
          <h2 className="tm-h2" style={{ fontSize: 'calc(var(--h2) + 10px)' }}>Show them what you’re made of.</h2>
          <p className="tm-body">The first application is free — see the difference on your own bullets.</p>
          <span className="tm-btn tm-btn--primary tm-btn--lg">Get a free resume audit</span>
          <div style={{ marginTop: '44px' }}><TrustStrip /></div>
        </div>
      </section>
      <TMFooter />
    </div>
  );
}

window.DirectionC = DirectionC;
