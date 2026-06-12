// tm-page-credits.jsx — Buy credits: pack selection + Michael add-on + order summary.

const { useState } = React;

const TMCR_PACKS = [
  { id: 'starter', name: 'Starter', apps: 5, price: 19, per: '$3.80' },
  { id: 'jobhunt', name: 'Job hunt', apps: 15, price: 49, per: '$3.27', popular: true },
  { id: 'allin', name: 'All in', apps: 40, price: 99, per: '$2.48' },
];

function CreditsPage({ t }) {
  const [sel, setSel] = useState('jobhunt');
  const [addon, setAddon] = useState(false);
  const [paid, setPaid] = useState(false);
  const pack = TMCR_PACKS.find((p) => p.id === sel);
  const total = pack.price + (addon ? 49 : 0);

  return (
    <div className="tm tmB tm--page" data-density={t.density} data-tints={t.tints ? 'on' : 'off'} data-screen-label="Buy credits">
      <TMNav active="Pricing" />

      <section className="tm-sec tmF-head" style={{ paddingBottom: 0 }}>
        <span className="tm-pill tmCR-balance"><Ic n="file-text" s={13} /> Your balance: 1 free application</span>
        <h1 className="tm-h1">Buy credits</h1>
        <p className="tm-body">One credit = one application: fit score, tailored resume + cover letter, full agent review. Credits never expire.</p>
      </section>

      <section className="tm-sec">
        <div className="tm-wrap tmCR-layout">
          <div>
            <div className="tmCR-packs">
              {TMCR_PACKS.map((p) => (
                <div key={p.id} className={'tm-card tmCR-pack' + (sel === p.id ? ' is-sel' : '')} onClick={() => setSel(p.id)}>
                  <span className="tmCR-radio"></span>
                  <span>
                    <span className="tmCR-pack-name">{p.name} {p.popular && <span className="tm-pill" style={{ marginLeft: '8px' }}>Most popular</span>}</span>
                    <span className="tmCR-pack-meta" style={{ display: 'block' }}>{p.apps} applications · {p.per} each</span>
                  </span>
                  <span className="tmCR-pack-price">${p.price}</span>
                </div>
              ))}
            </div>

            <div
              className={'tm-card tmCR-addon' + (addon ? ' is-sel' : '')}
              style={{ marginTop: '22px' }}
              onClick={() => setAddon(!addon)}
            >
              <span className="tmCR-check">{addon && <Ic n="check" s={13} />}</span>
              <img className="tm-human-photo" src="assets/michael.png" alt="" style={{ width: '44px', height: '44px' }} />
              <div style={{ flex: 1 }}>
                <b style={{ fontSize: '14.5px', fontWeight: 500, display: 'block' }}>Add Michael’s expert review to my next application</b>
                <span className="tm-small" style={{ fontSize: '12.5px' }}>Line-by-line pass from the head of Res.Me · 48-hour turnaround</span>
              </div>
              <span className="tmCR-pack-price" style={{ fontSize: '17px' }}>+$49</span>
            </div>
          </div>

          {paid ? (
          <div className="tm-card tmCR-sum tmF-gate" style={{ alignItems: 'center' }}>
            <span className="tm-pill tm-pill--mint"><Ic n="check" s={12} /> payment complete</span>
            <h3>{pack.apps} credits added</h3>
            <p>Your balance is now {pack.apps + 1} applications{addon ? ', with Michael\u2019s review queued for the next one' : ''}.</p>
            <a className="tm-btn tm-btn--primary" href="Dashboard.html">Go to dashboard</a>
            <span className="tm-small" style={{ fontSize: '12px', cursor: 'pointer', textDecoration: 'underline' }} onClick={() => setPaid(false)}>reset demo</span>
          </div>
          ) : (
          <div className="tm-card tmCR-sum">
            <h3>Order summary</h3>
            <div className="tmCR-row"><span>{pack.name} — {pack.apps} applications</span><b>${pack.price}</b></div>
            {addon && <div className="tmCR-row"><span>Michael’s expert review × 1</span><b>$49</b></div>}
            <div className="tmCR-row"><span>Credits expire</span><b>Never</b></div>
            <div className="tmCR-row tmCR-row--total"><span>Total</span><b>${total}</b></div>
            <div className="tmCR-payfield"><Ic n="lock" s={15} /> Card number · MM/YY · CVC</div>
            <span className="tm-btn tm-btn--primary" style={{ width: '100%', justifyContent: 'center', marginTop: '14px' }} onClick={() => setPaid(true)}>
              Pay ${total}
            </span>
            <p className="tmCR-paynote"><Ic n="shield-check" s={13} /> Secured by Stripe · unused credits refundable for 30 days</p>
          </div>
          )}
        </div>
      </section>
      <TMFooter />
    </div>
  );
}

function CreditsApp() {
  const [t, setTweak] = useTweaks({ density: 'regular', tints: true });
  return (
    <React.Fragment>
      <CreditsPage t={t} />
      <TweaksPanel>
        <TweakSection label="Layout" />
        <TweakRadio label="Density" value={t.density} options={['compact', 'regular', 'comfy']} onChange={(v) => setTweak('density', v)} />
        <TweakToggle label="Section tints" value={t.tints} onChange={(v) => setTweak('tints', v)} />
      </TweaksPanel>
    </React.Fragment>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<CreditsApp />);
