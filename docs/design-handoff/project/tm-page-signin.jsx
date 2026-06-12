// tm-page-signin.jsx — Sign in / create account.

const { useState } = React;

function GoogleMark() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
      <path fill="#4285F4" d="M23.5 12.27c0-.85-.08-1.66-.22-2.45H12v4.64h6.45a5.52 5.52 0 0 1-2.39 3.62v3h3.87c2.26-2.09 3.57-5.16 3.57-8.81Z"></path>
      <path fill="#34A853" d="M12 24c3.24 0 5.96-1.07 7.93-2.91l-3.87-3a7.24 7.24 0 0 1-10.8-3.81H1.27v3.1A12 12 0 0 0 12 24Z"></path>
      <path fill="#FBBC05" d="M5.26 14.28a7.2 7.2 0 0 1 0-4.56v-3.1H1.27a12 12 0 0 0 0 10.76l3.99-3.1Z"></path>
      <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.43-3.43A11.97 11.97 0 0 0 1.27 6.62l3.99 3.1A7.16 7.16 0 0 1 12 4.75Z"></path>
    </svg>
  );
}

function LinkedInMark() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" aria-hidden="true">
      <path fill="#0A66C2" d="M20.45 20.45h-3.55v-5.57c0-1.33-.03-3.04-1.85-3.04-1.86 0-2.14 1.45-2.14 2.94v5.67H9.35V9h3.41v1.56h.05a3.74 3.74 0 0 1 3.37-1.85c3.6 0 4.27 2.37 4.27 5.46v6.28ZM5.34 7.43a2.06 2.06 0 1 1 0-4.12 2.06 2.06 0 0 1 0 4.12ZM7.12 20.45H3.56V9h3.56v11.45ZM22.22 0H1.77C.79 0 0 .77 0 1.73v20.54C0 23.23.79 24 1.77 24h20.45c.98 0 1.78-.77 1.78-1.73V1.73C24 .77 23.2 0 22.22 0Z"></path>
    </svg>
  );
}

function SignInPage({ t }) {
  const [mode, setMode] = useState('signup'); // signup | signin
  const [email, setEmail] = useState('');
  const session = tmGetSession();

  const go = (name) => {
    tmSignIn(email, name);
    window.location.href = 'Dashboard.html';
  };

  return (
    <div className="tm tmB tm--page" data-density={t.density} data-tints={t.tints ? 'on' : 'off'} data-screen-label="Sign in">
      <TMNav active="" />
      <div className="tmS-wrap">
        <div className="tmS-side">
          <img src="assets/resme-logomark.png" alt="" style={{ width: '40px' }} />
          <h2>Your experience is stronger than your resume makes it look.</h2>
          <span className="tm-pill tm-pill--mint" style={{ alignSelf: 'flex-start' }}><Ic n="sparkles" s={13} /> Your first application is free</span>
          <div className="tmB-creds">
            {[
              'No card required to start',
              'Fit scored before you spend anything',
              'Three specialist agents on every application',
              'Encrypted at rest · delete everything in one click',
            ].map((c) => <span key={c} className="tmB-cred"><Ic n="check" s={12} /> {c}</span>)}
          </div>
        </div>
        <div className="tmS-main">
          <div className="tmS-card">
            <div className="tmS-tabs">
              <span className={'tmS-tab' + (mode === 'signup' ? ' is-on' : '')} onClick={() => setMode('signup')}>Create account</span>
              <span className={'tmS-tab' + (mode === 'signin' ? ' is-on' : '')} onClick={() => setMode('signin')}>Sign in</span>
            </div>

            <div className="tmS-oauth">
              <span className="tm-btn tm-btn--outline" onClick={() => go('Alex Mercer')}><GoogleMark /> Continue with Google</span>
              <span className="tm-btn tm-btn--outline" onClick={() => go('Alex Mercer')}><LinkedInMark /> Continue with LinkedIn</span>
            </div>

            <div className="tmS-div">or with email</div>

            <div className="tmS-field">
              <label>Email</label>
              <input className="tmS-input" type="email" placeholder="you@email.com" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div className="tmS-field">
              <label>Password</label>
              <input className="tmS-input" type="password" placeholder={mode === 'signup' ? 'At least 8 characters' : 'Your password'} />
            </div>

            <span className="tm-btn tm-btn--primary" style={{ width: '100%', justifyContent: 'center', marginTop: '6px' }} onClick={() => go(null)}>
              {mode === 'signup' ? 'Create free account' : 'Sign in'}
            </span>

            {session && (
              <p className="tmS-note" style={{ marginTop: '12px' }}>
                Already signed in as <b style={{ fontWeight: 500 }}>{session.name}</b> — <a href="Dashboard.html" style={{ color: 'var(--tm-blue-600)', textDecoration: 'none' }}>go to your dashboard</a>
              </p>
            )}

            <p className="tmS-note" style={{ visibility: mode === 'signin' ? 'visible' : 'hidden' }}><a href="Forgot Password.html" style={{ color: 'var(--tm-blue-600)', textDecoration: 'none' }}>Forgot your password?</a></p>
            <p className="tmS-note">
              By continuing you agree to the <a href="Terms.html" style={{ color: 'var(--tm-blue-600)', textDecoration: 'none' }}>terms</a> and <a href="Privacy.html" style={{ color: 'var(--tm-blue-600)', textDecoration: 'none' }}>privacy policy</a>.
            </p>
          </div>
        </div>
      </div>
      <TMFooter />
    </div>
  );
}

function SignInApp() {
  const [t, setTweak] = useTweaks({ density: 'regular', tints: true });
  return (
    <React.Fragment>
      <SignInPage t={t} />
      <TweaksPanel>
        <TweakSection label="Layout" />
        <TweakRadio label="Density" value={t.density} options={['compact', 'regular', 'comfy']} onChange={(v) => setTweak('density', v)} />
        <TweakToggle label="Section tints" value={t.tints} onChange={(v) => setTweak('tints', v)} />
      </TweaksPanel>
    </React.Fragment>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<SignInApp />);
