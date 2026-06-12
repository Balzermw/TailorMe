// tm-page-forgot.jsx — forgot password flow.

const { useState } = React;

function ForgotPage({ t }) {
  const [sent, setSent] = useState(false);
  return (
    <div className="tm tmB tm--page" data-density={t.density} data-tints={t.tints ? 'on' : 'off'} data-screen-label="Forgot password">
      <TMNav active="" />
      <section className="tm-sec" style={{ minHeight: 'calc(100vh - 260px)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div className="tmS-card">
          {!sent ? (
            <div className="tm-card" style={{ padding: '32px' }}>
              <h1 style={{ fontSize: '24px', fontWeight: 500, letterSpacing: '-0.01em' }}>Reset your password</h1>
              <p className="tm-small" style={{ marginTop: '8px', marginBottom: '22px' }}>
                Enter the email you signed up with and we&rsquo;ll send you a reset link.
              </p>
              <div className="tmS-field">
                <label>Email</label>
                <input className="tmS-input" type="email" placeholder="you@email.com" />
              </div>
              <span className="tm-btn tm-btn--primary" style={{ width: '100%', justifyContent: 'center', marginTop: '6px' }} onClick={() => setSent(true)}>
                Send reset link
              </span>
              <p className="tmS-note"><a href="Sign In.html" style={{ color: 'var(--tm-blue-600)', textDecoration: 'none' }}>← Back to sign in</a></p>
            </div>
          ) : (
            <div className="tm-card tmF-gate" style={{ padding: '36px 32px' }}>
              <span className="tm-pill tm-pill--mint"><Ic n="check" s={12} /> sent</span>
              <h3>Check your inbox</h3>
              <p>If an account exists for that email, a reset link is on its way. It expires in 30 minutes.</p>
              <p className="tm-small" style={{ fontSize: '12.5px' }}>
                Nothing arriving? Check spam, or <a href="Contact.html" style={{ color: 'var(--tm-blue-600)', textDecoration: 'none' }}>contact us</a>.
              </p>
              <a className="tm-btn tm-btn--outline" href="Sign In.html">Back to sign in</a>
            </div>
          )}
        </div>
      </section>
      <TMFooter />
    </div>
  );
}

function ForgotApp() {
  const [t, setTweak] = useTweaks({ density: 'regular', tints: true });
  return (
    <React.Fragment>
      <ForgotPage t={t} />
      <TweaksPanel>
        <TweakSection label="Layout" />
        <TweakRadio label="Density" value={t.density} options={['compact', 'regular', 'comfy']} onChange={(v) => setTweak('density', v)} />
        <TweakToggle label="Section tints" value={t.tints} onChange={(v) => setTweak('tints', v)} />
      </TweaksPanel>
    </React.Fragment>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<ForgotApp />);
