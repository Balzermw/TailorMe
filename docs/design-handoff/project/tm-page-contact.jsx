// tm-page-contact.jsx — contact page.

const { useState } = React;

function ContactPage({ t }) {
  const [sent, setSent] = useState(false);
  return (
    <div className="tm tmB tm--page" data-density={t.density} data-tints={t.tints ? 'on' : 'off'} data-screen-label="Contact">
      <TMNav active="" />
      <section className="tm-sec">
        <div className="tm-wrap" style={{ display: 'grid', gridTemplateColumns: '1fr 1.2fr', gap: '56px', alignItems: 'start', maxWidth: '1000px' }}>
          <div>
            <h1 style={{ fontSize: 'clamp(30px, 3.4vw, 40px)', fontWeight: 500, letterSpacing: '-0.02em' }}>Contact us</h1>
            <p className="tm-body" style={{ marginTop: '14px' }}>
              Questions about an application, credits, your data, or coaching with Michael —
              we answer everything within one business day.
            </p>
            <div className="tmB-creds" style={{ marginTop: '26px' }}>
              <span className="tmB-cred"><Ic n="check" s={12} /> support@res.me [placeholder address]</span>
              <span className="tmB-cred"><Ic n="check" s={12} /> Data requests answered within 30 days (GDPR)</span>
              <span className="tmB-cred"><Ic n="check" s={12} /> Coaching scheduling handled by Michael directly</span>
            </div>
          </div>
          {!sent ? (
            <div className="tm-card" style={{ padding: '30px' }}>
              <div className="tmS-field">
                <label>Name</label>
                <input className="tmS-input" type="text" placeholder="Your name" />
              </div>
              <div className="tmS-field">
                <label>Email</label>
                <input className="tmS-input" type="email" placeholder="you@email.com" />
              </div>
              <div className="tmS-field">
                <label>What&rsquo;s this about?</label>
                <select className="tmS-input" defaultValue="An application">
                  <option>An application</option>
                  <option>Credits or billing</option>
                  <option>My data (export / deletion)</option>
                  <option>Coaching with Michael</option>
                  <option>Something else</option>
                </select>
              </div>
              <div className="tmS-field">
                <label>Message</label>
                <textarea className="tmF-ta" placeholder="How can we help?"></textarea>
              </div>
              <span className="tm-btn tm-btn--primary" style={{ width: '100%', justifyContent: 'center', marginTop: '6px' }} onClick={() => setSent(true)}>
                Send message
              </span>
            </div>
          ) : (
            <div className="tm-card tmF-gate" style={{ padding: '40px 32px' }}>
              <span className="tm-pill tm-pill--mint"><Ic n="check" s={12} /> sent</span>
              <h3>Thanks — we&rsquo;ve got it</h3>
              <p>You&rsquo;ll hear back within one business day. For urgent data requests, mention &ldquo;GDPR&rdquo; in your subject line.</p>
              <a className="tm-btn tm-btn--outline" href="TailorMe Homepage Final.html">Back to home</a>
            </div>
          )}
        </div>
      </section>
      <TMFooter />
    </div>
  );
}

function ContactApp() {
  const [t, setTweak] = useTweaks({ density: 'regular', tints: true });
  return (
    <React.Fragment>
      <ContactPage t={t} />
      <TweaksPanel>
        <TweakSection label="Layout" />
        <TweakRadio label="Density" value={t.density} options={['compact', 'regular', 'comfy']} onChange={(v) => setTweak('density', v)} />
        <TweakToggle label="Section tints" value={t.tints} onChange={(v) => setTweak('tints', v)} />
      </TweaksPanel>
    </React.Fragment>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<ContactApp />);
