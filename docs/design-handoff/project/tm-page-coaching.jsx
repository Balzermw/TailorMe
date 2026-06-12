// tm-page-coaching.jsx — Coaching page for Michael, TailorMe flat style.
// Inspired by resme.cloud/coaching (hero + about + steps + packages + transformations),
// re-set in the TailorMe sub-brand. Package tiers are PLACEHOLDERS.

const TMC_PKGS = [
  {
    name: 'Resume rewrite', price: '$149',
    items: ['Full rewrite of your resume by Michael', 'Positioning for one target role', '2 revision rounds', '5-day turnaround'],
  },
  {
    name: 'Rewrite + cover letter', price: '$199', popular: true,
    items: ['Everything in Resume rewrite', 'Tailored cover letter', 'LinkedIn headline + summary pass', '2 revision rounds'],
  },
  {
    name: 'Full coaching', price: '$299',
    items: ['Everything in Rewrite + cover letter', 'Two 45-minute 1-on-1 sessions', 'Interview positioning notes', '30 days of follow-up questions'],
  },
];

const TMC_TSTS = [
  { q: 'Michael turned seven years of \u201Cresponsibilities\u201D into a story about impact. I finally sound like the engineer I am.', who: 'S.K.', role: 'Senior Software Engineer', note: 'Labeled composite' },
  { q: 'The line-by-line notes were worth it alone — every bullet got sharper and I understood why.', who: 'J.R.', role: 'Cloud Infrastructure Lead', note: 'Labeled composite' },
  { q: 'I\u2019d been rewriting my own resume for months. One session re-framed the whole thing.', who: 'M.T.', role: 'Professional Services Manager', note: 'Labeled composite' },
];

function CoachingPage({ t }) {
  return (
    <div className="tm tmB tm--page" data-density={t.density} data-tints={t.tints ? 'on' : 'off'} data-screen-label="Coaching page">
      <TMNav active="Coaching" />

      {/* hero */}
      <section className="tm-sec">
        <div className="tm-wrap tmC-hero2">
          <div>
            <span className="tm-pill">1-on-1 coaching</span>
            <h1 className="tm-h1">Professional resume coaching with Michael</h1>
            <p className="tm-body">
              The head of Res.Me, working on your resume directly — positioning your story
              for the roles you actually want, line by line.
            </p>
            <div className="tmC-hero2-ctas">
              <a className="tm-btn tm-btn--primary tm-btn--lg" href="Book Session.html">Book a session</a>
              <a className="tm-btn tm-btn--outline tm-btn--lg" href="#packages">See packages</a>
            </div>
            <div className="tmC-hero2-rating">
              <span className="tmC-rating-num">4.8/5</span>
              <span className="tmC-rating-sub">across 200+ reviews · 650+ resumes written · 15+ years</span>
            </div>
          </div>
          <div className="tmC-photo-wrap">
            <img className="tmC-photo" src="assets/michael.png" alt="Michael, head of Res.Me" />
            <span className="tmC-photo-badge"><Ic n="shield-check" s={14} /> Fiverr Top Rated Pro</span>
          </div>
        </div>
      </section>

      {/* about */}
      <section className="tm-sec tm-tint--gray">
        <div className="tm-wrap tmC-about">
          <div>
            <h2 className="tm-h2">Hi, I&rsquo;m Michael.</h2>
            <p className="tm-body" style={{ marginTop: '14px' }}>
              I&rsquo;ve spent fifteen years helping technical professionals explain their
              work to the people who hire them. Most resumes I see undersell the candidate
              — strong work written as a task list. My job is the translation: finding the
              impact in what you&rsquo;ve done and positioning it for the role you want next.
            </p>
            <p className="tm-body" style={{ marginTop: '12px' }}>
              I built TailorMe&rsquo;s pipeline around how I work. Coaching is the
              full-strength version: you and me, your resume, your target roles.
            </p>
          </div>
          <div className="tm-card" style={{ padding: '26px 28px' }}>
            <div className="tmB-creds">
              {[
                'Certified Professional Resume Writer (CPRW)',
                '15+ years of experience in technical hiring',
                '650+ resumes written for senior candidates',
                'Fiverr Top Rated Pro \u00b7 4.8/5 across 200+ reviews',
                'Head of Res.Me \u2014 the team behind TailorMe',
              ].map((c) => <span key={c} className="tmB-cred"><Ic n="check" s={12} /> {c}</span>)}
            </div>
          </div>
        </div>
      </section>

      {/* how it works */}
      <section className="tm-sec">
        <div className="tm-wrap">
          <h2 className="tm-h2">How coaching works</h2>
          <div className="tmC-steps" style={{ marginTop: '26px' }}>
            {[
              ['01', 'Share your story', 'Send your current resume and the roles you\u2019re targeting. Michael reads both before you ever meet.'],
              ['02', 'Craft & perfect', 'Rewrite, restructure, re-position — together. Every change explained, so the thinking sticks.'],
              ['03', 'Ready to stand out', 'You leave with documents that read at your level, and the positioning to talk about them.'],
            ].map(([n, h, d]) => (
              <div key={n} className="tm-card tmC-step">
                <i>{n}</i>
                <h3>{h}</h3>
                <p>{d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* packages */}
      <section className="tm-sec tm-tint--blue" id="packages">
        <div className="tm-wrap">
          <h2 className="tm-h2">Choose your package</h2>
          <p className="tm-body" style={{ marginTop: '10px', maxWidth: '60ch' }}>
            Placeholder tiers — final scope and pricing to be confirmed.
          </p>
          <div className="tmC-pkgs" style={{ marginTop: '28px' }}>
            {TMC_PKGS.map((p) => (
              <div key={p.name} className={'tm-card tmC-pkg' + (p.popular ? ' has-chip is-em' : '')}>
                <span className="tm-pill tm-pill--mint tmC-pkg-chip">Most popular</span>
                <span className="tmC-pkg-name">{p.name}</span>
                <span className="tmC-pkg-price"><strong>{p.price}</strong><span>one time</span></span>
                <div className="tmC-pkg-items">
                  {p.items.map((it) => <span key={it}><Ic n="check" s={13} /> {it}</span>)}
                </div>
                <a className={'tm-btn ' + (p.popular ? 'tm-btn--primary' : 'tm-btn--outline')} href="Book Session.html">Choose {p.name.toLowerCase()}</a>
              </div>
            ))}
          </div>
          <div className="tm-card tmC-band" style={{ marginTop: 'var(--g)' }}>
            <img className="tm-human-photo" src="assets/michael.png" alt="" />
            <div className="tmC-band-body">
              <h3>Already using TailorMe?</h3>
              <p>Add Michael&rsquo;s line-by-line review to any application for +$49 — no package needed. 48-hour turnaround.</p>
            </div>
            <a className="tm-btn tm-btn--outline" href="Dashboard.html">Add to an application</a>
          </div>
        </div>
      </section>

      {/* testimonials */}
      <section className="tm-sec">
        <div className="tm-wrap">
          <h2 className="tm-h2">What clients say</h2>
          <div className="tmC-tsts" style={{ marginTop: '26px' }}>
            {TMC_TSTS.map((tst) => (
              <div key={tst.who} className="tm-card tmC-tst">
                <q>{tst.q}</q>
                <div className="tmC-tst-who">
                  <span className="tmC-tst-avatar">{tst.who.replace(/\./g, '').slice(0, 2)}</span>
                  <span><b>{tst.who} — {tst.role}</b><span>{tst.note}</span></span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="tm-sec tm-tint--gray">
        <div className="tm-wrap tm-cta">
          <h2 className="tm-h2">Work with Michael directly.</h2>
          <p className="tm-body">Or start smaller — run a free TailorMe audit and add his review when you&rsquo;re ready.</p>
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', justifyContent: 'center' }}>
            <a className="tm-btn tm-btn--primary tm-btn--lg" href="Book Session.html">Book a session</a>
            <a className="tm-btn tm-btn--outline tm-btn--lg" href="Free Audit.html">Try TailorMe free</a>
          </div>
          <div style={{ marginTop: '34px' }}><TrustStrip /></div>
        </div>
      </section>
      <TMFooter />
    </div>
  );
}

function CoachingApp() {
  const [t, setTweak] = useTweaks({ density: 'regular', tints: true });
  return (
    <React.Fragment>
      <CoachingPage t={t} />
      <TweaksPanel>
        <TweakSection label="Layout" />
        <TweakRadio label="Density" value={t.density} options={['compact', 'regular', 'comfy']} onChange={(v) => setTweak('density', v)} />
        <TweakToggle label="Section tints" value={t.tints} onChange={(v) => setTweak('tints', v)} />
      </TweaksPanel>
    </React.Fragment>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<CoachingApp />);
