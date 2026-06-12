// tm-page-flows.jsx — internal site map + user flow walkthroughs.

const TMFL_PAGES = [
  {
    group: 'Marketing', pages: [
      ['TailorMe Homepage Final.html', 'Home', 'The 9-section story: problem → guide → plan → proof → pricing → FAQ'],
      ['Pricing.html', 'Pricing', 'Use-case packs, includes strip, Michael add-on, pricing FAQ'],
      ['Coaching.html', 'Coaching', 'Michael\u2019s page: about, packages, testimonials'],
      ['Transformation.html', 'Transformation', 'Case study: posting, fit score, before/after docs, agent notes'],
    ],
  },
  {
    group: 'Product flows', pages: [
      ['Free Audit.html', 'Free audit', '3-step wizard: upload → job → agent audit (conversion path)'],
      ['Sign In.html', 'Sign in', 'Create account / sign in, OAuth, free-application hook'],
      ['Forgot Password.html', 'Forgot password', 'Reset link request + sent state'],
      ['Dashboard.html', 'Dashboard', 'Applications list, fit triage, drawer, live run, credits'],
      ['Buy Credits.html', 'Buy credits', 'Pack selection, Michael add-on, payment + success state'],
      ['Settings.html', 'Settings', 'Master profile, credits, security, export + one-click delete'],
      ['Book Session.html', 'Book session', 'Coaching packages + free intro slot picker'],
    ],
  },
  {
    group: 'Support & legal', pages: [
      ['Privacy.html', 'Privacy', 'Data handling, encryption, GDPR (placeholder draft)'],
      ['Terms.html', 'Terms', 'Credits, refunds, no-guarantee clause (placeholder draft)'],
      ['Contact.html', 'Contact', 'Topic form + sent state, GDPR response promise'],
    ],
  },
];

const TMFL_FLOWS = [
  {
    name: 'A · First application — skeptic to download',
    who: 'New visitor, burned out on silence. Converts via the free audit.',
    steps: [
      ['Home', 'TailorMe Homepage Final.html', 'Lands on hero, scrolls the proof'],
      ['Transformation', 'Transformation.html', '"See a real transformation" — believes it'],
      ['Free audit', 'Free Audit.html', 'Uploads resume, pastes a job, sees 84'],
      ['Sign in', 'Sign In.html', 'Creates account to download'],
      ['Dashboard', 'Dashboard.html', 'First application, ready to send'],
    ],
  },
  {
    name: 'B · Active searcher — triage and buy',
    who: 'Mid-search senior engineer applying weekly. Spends credits only on strong fits.',
    steps: [
      ['Sign in', 'Sign In.html', 'Returns to the tool'],
      ['Dashboard', 'Dashboard.html', 'Scores 3 postings free — one is weak, skips it'],
      ['Free audit', 'Free Audit.html', 'Runs the 84-fit posting as a new application'],
      ['Buy credits', 'Buy Credits.html', 'Out of credits — grabs Job hunt $49'],
      ['Dashboard', 'Dashboard.html', 'Downloads, marks the run done'],
    ],
  },
  {
    name: 'C · Adding the human expert',
    who: 'High-stakes application. Wants Michael\u2019s eyes before sending.',
    steps: [
      ['Dashboard', 'Dashboard.html', 'Opens the application drawer'],
      ['Buy credits', 'Buy Credits.html', 'Adds Michael\u2019s review (+$49) at checkout'],
      ['Dashboard', 'Dashboard.html', 'Tracker: "Michael reviewing — returns in ~36h"'],
      ['Dashboard', 'Dashboard.html', 'Notes returned, final PDF downloaded'],
    ],
  },
  {
    name: 'D · Coaching client',
    who: 'Wants the full human service, not per-application AI.',
    steps: [
      ['Home', 'TailorMe Homepage Final.html', 'Sees "by Res.Me", checks who\u2019s behind it'],
      ['Coaching', 'Coaching.html', 'Reads about Michael, picks a package'],
      ['Book session', 'Book Session.html', 'Books the free 30-min intro slot'],
      ['Free audit', 'Free Audit.html', 'Meanwhile tries TailorMe on one posting'],
    ],
  },
  {
    name: 'E · Privacy-first user',
    who: 'Won\u2019t upload a resume anywhere without checking the data story.',
    steps: [
      ['Privacy', 'Privacy.html', 'Encrypted at rest, no AI training, one-click delete'],
      ['Free audit', 'Free Audit.html', 'Satisfied — runs the free audit'],
      ['Settings', 'Settings.html', 'Later: exports data, tests the delete control'],
      ['Contact', 'Contact.html', 'GDPR question answered within 30 days'],
    ],
  },
];

function FlowsPage({ t }) {
  return (
    <div className="tm tmB tm--page" data-density={t.density} data-tints="off" data-screen-label="Site map and flows">
      <TMNav active="" />
      <section className="tm-sec tmF-head" style={{ paddingBottom: 0 }}>
        <span className="tm-pill tm-pill--gray">Internal — design reference, not a product page</span>
        <h1 className="tm-h1">Site map &amp; user flows</h1>
        <p className="tm-body">Every page in the mockup, grouped by role, plus five walkthroughs. Every card and step is clickable.</p>
      </section>

      <section className="tm-sec">
        <div className="tm-wrap">
          <h2 className="tm-h2">Coverage — 14 pages, all active</h2>
          {TMFL_PAGES.map((g) => (
            <div key={g.group} style={{ marginTop: '30px' }}>
              <p className="tmF-p2-label">{g.group} <span className="tmF-p2-count">{g.pages.length}</span></p>
              <div className="tmFL-grid">
                {g.pages.map(([href, name, desc]) => (
                  <a key={href} className="tm-card tmFL-page" href={href}>
                    <span className="tmFL-page-head">
                      <b>{name}</b>
                      <span className="tm-pill tm-pill--mint"><Ic n="check" s={11} /> active</span>
                    </span>
                    <span>{desc}</span>
                  </a>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="tm-sec tm-tint--gray" style={{ background: 'var(--tm-gray)' }}>
        <div className="tm-wrap">
          <h2 className="tm-h2">Five user flows</h2>
          <p className="tm-body" style={{ marginTop: '10px', maxWidth: '64ch' }}>
            Each step links to the live page so you can walk the journey exactly as a user would.
          </p>
          {TMFL_FLOWS.map((f) => (
            <div key={f.name} className="tm-card tmFL-flow">
              <div className="tmFL-flow-head">
                <h3>{f.name}</h3>
                <p>{f.who}</p>
              </div>
              <div className="tmFL-steps">
                {f.steps.map(([label, href, desc], i) => (
                  <React.Fragment key={i}>
                    {i > 0 && <span className="tmFL-arrow"><Ic n="arrow-right" s={15} /></span>}
                    <a className="tmFL-step" href={href}>
                      <span className="tmFL-step-num">{i + 1}</span>
                      <b>{label}</b>
                      <span>{desc}</span>
                    </a>
                  </React.Fragment>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>
      <TMFooter />
    </div>
  );
}

function FlowsApp() {
  const [t, setTweak] = useTweaks({ density: 'regular' });
  return (
    <React.Fragment>
      <FlowsPage t={t} />
      <TweaksPanel>
        <TweakSection label="Layout" />
        <TweakRadio label="Density" value={t.density} options={['compact', 'regular', 'comfy']} onChange={(v) => setTweak('density', v)} />
      </TweaksPanel>
    </React.Fragment>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<FlowsApp />);
