// tm-page-settings.jsx — account settings: master profile, credits, security, data controls.

const { useState } = React;

function SettingsPage({ t }) {
  const [del, setDel] = useState('idle'); // idle → confirm → done
  const [exported, setExported] = useState(false);
  const session = tmGetSession();
  const email = (session && session.email) || 'alex.m@email.com';

  return (
    <div className="tm tmB tm--page" data-density={t.density} data-tints={t.tints ? 'on' : 'off'} data-screen-label="Account settings">
      <TMNav active="Dashboard" />
      <section className="tm-sec">
        <div className="tm-wrap--narrow">
          <h1 style={{ fontSize: 'clamp(28px, 3vw, 36px)', fontWeight: 500, letterSpacing: '-0.02em' }}>Account settings</h1>

          {/* master profile */}
          <div className="tm-card tmSet-card">
            <div className="tmSet-head">
              <h2>Master profile</h2>
              <span className="tm-pill tm-pill--mint"><Ic n="check" s={12} /> parsed</span>
            </div>
            <p className="tm-small">The structured profile every application starts from. Re-upload anytime — tailoring always uses the latest version.</p>
            <div className="tmF-profile2-id" style={{ marginTop: '6px' }}>
              <span className="tmC-tst-avatar" style={{ width: '44px', height: '44px' }}>AM</span>
              <div>
                <b style={{ fontSize: '15px', fontWeight: 500 }}>Alex Mercer</b>
                <span className="tm-small" style={{ display: 'block' }}>Senior Software Engineer · 2 roles · 14 bullets · 11 skills</span>
              </div>
              <span className="tm-btn tm-btn--outline tm-btn--sm" style={{ marginLeft: 'auto' }}><Ic n="upload" s={14} /> Re-upload resume</span>
            </div>
          </div>

          {/* credits */}
          <div className="tm-card tmSet-card">
            <div className="tmSet-head">
              <h2>Credits</h2>
            </div>
            <div className="tmSet-row">
              <span><b style={{ fontWeight: 500 }}>7 credits</b> remaining · credits never expire</span>
              <a className="tm-btn tm-btn--outline tm-btn--sm" href="Buy Credits.html">Buy more</a>
            </div>
          </div>

          {/* security */}
          <div className="tm-card tmSet-card">
            <div className="tmSet-head">
              <h2>Sign-in &amp; security</h2>
            </div>
            <div className="tmSet-row">
              <span>{email} · password sign-in</span>
              <a className="tm-btn tm-btn--outline tm-btn--sm" href="Forgot Password.html">Change password</a>
            </div>
          </div>

          {/* data & privacy */}
          <div className="tm-card tmSet-card">
            <div className="tmSet-head">
              <h2>Data &amp; privacy</h2>
              <span className="tm-pill tm-pill--gray"><Ic n="lock" s={12} /> encrypted at rest</span>
            </div>
            <div className="tmSet-row">
              <span>Download everything we hold about you — profile, documents, feedback.</span>
              {!exported
                ? <span className="tm-btn tm-btn--outline tm-btn--sm" onClick={() => setExported(true)}>Export my data</span>
                : <span className="tm-pill tm-pill--mint"><Ic n="check" s={12} /> export emailed</span>}
            </div>
            <div className="tmSet-row tmSet-row--danger">
              {del === 'idle' && (
                <React.Fragment>
                  <span>Permanently delete your profile, resumes, documents, and history.</span>
                  <span className="tm-btn tm-btn--outline tm-btn--sm tmSet-danger-btn" onClick={() => setDel('confirm')}><Ic n="trash-2" s={14} /> Delete everything</span>
                </React.Fragment>
              )}
              {del === 'confirm' && (
                <React.Fragment>
                  <span><b style={{ fontWeight: 500 }}>This is immediate and irreversible.</b> Your 7 unused credits will be refunded.</span>
                  <span style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    <span className="tm-btn tm-btn--outline tm-btn--sm" onClick={() => setDel('idle')}>Cancel</span>
                    <span className="tm-btn tm-btn--sm tmSet-danger-fill" onClick={() => setDel('done')}>Yes, delete everything</span>
                  </span>
                </React.Fragment>
              )}
              {del === 'done' && (
                <span className="tm-pill tm-pill--gray"><Ic n="check" s={12} /> deleted — your data is gone (demo state, <span style={{ textDecoration: 'underline', cursor: 'pointer' }} onClick={() => setDel('idle')}>reset</span>)</span>
              )}
            </div>
          </div>
        </div>
      </section>
      <TMFooter />
    </div>
  );
}

function SettingsApp() {
  const [t, setTweak] = useTweaks({ density: 'regular', tints: true });
  return (
    <React.Fragment>
      <SettingsPage t={t} />
      <TweaksPanel>
        <TweakSection label="Layout" />
        <TweakRadio label="Density" value={t.density} options={['compact', 'regular', 'comfy']} onChange={(v) => setTweak('density', v)} />
        <TweakToggle label="Section tints" value={t.tints} onChange={(v) => setTweak('tints', v)} />
      </TweaksPanel>
    </React.Fragment>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<SettingsApp />);
