// tm-page-pricing.jsx — TailorMe pricing page, framed by use case.

const TMP_PACKS = [
  {
    use: 'Testing the waters', name: 'Starter', price: '$19', apps: '5 applications', per: '$3.80',
    desc: 'For a handful of roles you really want — not a spray-and-pray run.',
    who: ['You\u2019re employed, but a few dream postings caught your eye', 'You want to see what tailoring does before committing'],
  },
  {
    use: 'Actively searching', name: 'Job hunt', price: '$49', apps: '15 applications', per: '$3.27',
    desc: 'For a real search: several quality applications a week, each one tailored.',
    who: ['You\u2019re applying every week and the generic resume isn\u2019t converting', 'You want every application reviewed before it goes out'],
    popular: true,
  },
  {
    use: 'Career switch or full campaign', name: 'All in', price: '$99', apps: '40 applications', per: '$2.48',
    desc: 'For changing roles, industries, or cities — casting wide without going generic.',
    who: ['You\u2019re repositioning and every posting needs a different story', 'You\u2019d rather buy once and never think about credits again'],
    value: true,
  },
];

const TMP_INCLUDES = [
  ['target', 'Fit score before you commit'],
  ['file-text', 'Tailored resume + cover letter'],
  ['sparkles', 'Three-agent line-level review'],
  ['shield-check', 'Compiled, inspected 2-page PDF'],
];

const TMP_GUIDE = [
  { q: 'I just want to try it.', a: ['Start with the ', { b: 'free audit' }, ' — your first application costs nothing, no card required.'] },
  { q: 'I\u2019m applying to a few specific roles.', a: [{ b: 'Starter' }, ' covers five targeted applications. Quality over volume.'] },
  { q: 'I\u2019m in a full-on search.', a: [{ b: 'Job hunt' }, ' is the sweet spot — and ', { b: 'All in' }, ' if you\u2019re switching careers or casting wide.'] },
];

const TMP_FAQS = [
  { q: 'Do credits expire?', a: 'Never. Buy a pack, use it across your whole search — this month or next year. No subscription to cancel, no API keys to manage.' },
  { q: 'What counts as one application?', a: 'One job posting: fit score, tailored resume + cover letter, the full three-agent review, and the compiled PDFs. Re-runs against the same posting don\u2019t cost extra credits.' },
  { q: 'Can I see the result before spending a credit?', a: 'Yes — every run shows a watermarked preview free. The credit unlocks the clean download.' },
  { q: 'What\u2019s the refund policy?', a: 'If you\u2019re not happy, contact us within 30 days and we\u2019ll refund any unused credits in full. [Placeholder — confirm final policy.]' },
  { q: 'What does Michael\u2019s review add?', a: 'A line-by-line pass from the head of Res.Me — Certified Professional Resume Writer, 650+ resumes written — with positioning notes for your target role, within 48 hours. +$49 on any application.' },
];

function PricingFaq() {
  return (
    <div className="tm-faq">
      {TMP_FAQS.map((f, i) => (
        <details key={f.q} className="tm-faq-item" open={i === 0}>
          <summary>{f.q} <Ic n="plus" s={16} /></summary>
          <p>{f.a}</p>
        </details>
      ))}
    </div>
  );
}

function PricingPage({ t }) {
  return (
    <div className="tm tmB tm--page" data-density={t.density} data-tints={t.tints ? 'on' : 'off'} data-screen-label="Pricing page">
      <TMNav active="Pricing" />

      <section className="tm-sec tmP-head">
        <span className="tm-pill">Pricing</span>
        <h1 className="tm-h1">Pay per application. That&rsquo;s it.</h1>
        <p className="tm-body">
          No subscription, no monthly fee, credits never expire. Every application gets
          the full pipeline — the packs only differ in how many you need.
        </p>
      </section>

      <section className="tm-sec" style={{ paddingTop: 'calc(var(--sy) * 0.5)' }}>
        <div className="tm-wrap">
          <div className="tmP-packs">
            {TMP_PACKS.map((p) => {
              const em = (t.pricingEmphasis === 'popular' && p.popular) || (t.pricingEmphasis === 'value' && p.value);
              const chip = t.pricingEmphasis === 'popular' && p.popular ? 'Most popular' : t.pricingEmphasis === 'value' && p.value ? 'Best value' : null;
              return (
                <div key={p.name} className={'tm-card tmP-pack' + (chip ? ' has-chip' : '') + (em ? ' is-em' : '')}>
                  <span className="tm-pill tmP-pack-chip">{chip || '\u00A0'}</span>
                  <span className="tmP-pack-use">{p.use}</span>
                  <span className="tmP-pack-name">{p.name}</span>
                  <span className="tmP-pack-price"><strong>{p.price}</strong><span>{p.apps}</span></span>
                  <span className="tmP-pack-per"><b>{p.per}</b> per application</span>
                  <p className="tmP-pack-desc">{p.desc}</p>
                  <div className="tmP-pack-who">
                    {p.who.map((w) => <span key={w}><Ic n="check" s={13} /> {w}</span>)}
                  </div>
                  <a className={'tm-btn ' + (em ? 'tm-btn--primary' : 'tm-btn--outline')} href="Buy Credits.html">Buy {p.name.toLowerCase()}</a>
                </div>
              );
            })}
          </div>
          <p className="tmP-refund"><Ic n="shield-check" s={15} /> Not happy? Unused credits refunded in full within 30 days.</p>
          <FreeNote />
        </div>
      </section>

      <section className="tm-sec tm-tint--blue">
        <div className="tm-wrap">
          <div className="tmP-includes">
            <span className="tmP-includes-label">Every application includes</span>
            {TMP_INCLUDES.map(([ic, l]) => (
              <span key={l} className="tmP-include"><Ic n={ic} s={15} /> {l}</span>
            ))}
          </div>
        </div>
      </section>

      <section className="tm-sec">
        <div className="tm-wrap">
          <h2 className="tm-h2">Which pack is right for me?</h2>
          <div className="tmP-guide" style={{ marginTop: '26px' }}>
            {TMP_GUIDE.map((g) => (
              <div key={g.q} className="tm-card tmP-guide-item">
                <q>{g.q}</q>
                <p>{g.a.map((part, i) => typeof part === 'string' ? part : <b key={i}>{part.b}</b>)}</p>
              </div>
            ))}
          </div>
          <HumanReviewRow />
        </div>
      </section>

      <section className="tm-sec tm-tint--gray">
        <div className="tm-wrap--narrow">
          <h2 className="tm-h2">Pricing questions</h2>
          <div style={{ marginTop: '22px' }}><PricingFaq /></div>
        </div>
      </section>

      <section className="tm-sec">
        <div className="tm-wrap tm-cta">
          <h2 className="tm-h2">Start with the free one.</h2>
          <p className="tm-body">Your first application is a free audit — see what tailoring does to your own bullets before buying anything.</p>
          <a className="tm-btn tm-btn--primary tm-btn--lg" href="Free Audit.html"><Ic n="sparkles" s={16} /> Get a free resume audit</a>
          <div style={{ marginTop: '34px' }}><TrustStrip /></div>
        </div>
      </section>
      <TMFooter />
    </div>
  );
}

function PricingApp() {
  const [t, setTweak] = useTweaks({ density: 'regular', tints: true, pricingEmphasis: 'popular' });
  return (
    <React.Fragment>
      <PricingPage t={t} />
      <TweaksPanel>
        <TweakSection label="Layout" />
        <TweakRadio label="Density" value={t.density} options={['compact', 'regular', 'comfy']} onChange={(v) => setTweak('density', v)} />
        <TweakToggle label="Section tints" value={t.tints} onChange={(v) => setTweak('tints', v)} />
        <TweakSection label="Pricing" />
        <TweakRadio
          label="Emphasis"
          value={t.pricingEmphasis}
          options={[{ value: 'popular', label: 'popular' }, { value: 'equal', label: 'equal' }, { value: 'value', label: 'value' }]}
          onChange={(v) => setTweak('pricingEmphasis', v)}
        />
      </TweaksPanel>
    </React.Fragment>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<PricingApp />);
