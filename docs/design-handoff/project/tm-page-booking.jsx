// tm-page-booking.jsx — book a coaching session with Michael.

const { useState } = React;

const TMBK_PKGS = [
  { id: 'rewrite', name: 'Resume rewrite', price: '$149', meta: 'Full rewrite · 2 revision rounds · 5-day turnaround' },
  { id: 'cover', name: 'Rewrite + cover letter', price: '$199', meta: 'Adds cover letter + LinkedIn pass', popular: true },
  { id: 'full', name: 'Full coaching', price: '$299', meta: 'Adds two 45-min sessions + 30 days of follow-up' },
];

const TMBK_DAYS = [
  { d: 'Mon Jun 15', slots: ['10:00', '14:00'] },
  { d: 'Tue Jun 16', slots: ['09:00', '11:30', '16:00'] },
  { d: 'Wed Jun 17', slots: ['13:00'] },
  { d: 'Thu Jun 18', slots: ['10:30', '15:00'] },
];

function BookingPage({ t }) {
  const [pkg, setPkg] = useState('cover');
  const [slot, setSlot] = useState(null);
  const [booked, setBooked] = useState(false);
  const sel = TMBK_PKGS.find((p) => p.id === pkg);

  return (
    <div className="tm tmB tm--page" data-density={t.density} data-tints={t.tints ? 'on' : 'off'} data-screen-label="Book a session">
      <TMNav active="Coaching" />
      <section className="tm-sec tmF-head" style={{ paddingBottom: 0 }}>
        <span className="tm-pill">Coaching</span>
        <h1 className="tm-h1">Book a session with Michael</h1>
        <p className="tm-body">Pick a package and an intro slot. Times are placeholders — final scheduling is confirmed by email.</p>
      </section>

      <section className="tm-sec">
        <div className="tm-wrap tmCR-layout" style={{ maxWidth: '1000px', margin: '0 auto' }}>
          {!booked ? (
            <React.Fragment>
              <div>
                <p className="tmF-p2-label" style={{ marginBottom: '10px' }}>1 · Choose a package</p>
                <div className="tmCR-packs">
                  {TMBK_PKGS.map((p) => (
                    <div key={p.id} className={'tm-card tmCR-pack' + (pkg === p.id ? ' is-sel' : '')} onClick={() => setPkg(p.id)}>
                      <span className="tmCR-radio"></span>
                      <span>
                        <span className="tmCR-pack-name">{p.name} {p.popular && <span className="tm-pill" style={{ marginLeft: '8px' }}>Most popular</span>}</span>
                        <span className="tmCR-pack-meta" style={{ display: 'block' }}>{p.meta}</span>
                      </span>
                      <span className="tmCR-pack-price">{p.price}</span>
                    </div>
                  ))}
                </div>
                <p className="tmF-p2-label" style={{ margin: '26px 0 10px' }}>2 · Pick an intro slot (30 min, free)</p>
                <div className="tmBK-days">
                  {TMBK_DAYS.map((day) => (
                    <div key={day.d} className="tmBK-day">
                      <span className="tmBK-day-label">{day.d}</span>
                      <div className="tmBK-slots">
                        {day.slots.map((s) => {
                          const key = day.d + ' ' + s;
                          return (
                            <span key={key} className={'tmD-chip' + (slot === key ? ' is-on' : '')} onClick={() => setSlot(key)}>{s}</span>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="tm-card tmCR-sum">
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                  <img className="tm-human-photo" src="assets/michael.png" alt="Michael" style={{ width: '44px', height: '44px' }} />
                  <div>
                    <b style={{ fontSize: '14.5px', fontWeight: 500, display: 'block' }}>Michael</b>
                    <span className="tm-small" style={{ fontSize: '12px' }}>Head of Res.Me · CPRW</span>
                  </div>
                </div>
                <div className="tmCR-row"><span>Package</span><b>{sel.name}</b></div>
                <div className="tmCR-row"><span>Intro call</span><b>{slot || 'pick a slot'}</b></div>
                <div className="tmCR-row tmCR-row--total"><span>Due today</span><b>$0</b></div>
                <p className="tm-small" style={{ fontSize: '12px', marginTop: '4px' }}>You only pay ({sel.price}) after the intro call, if you go ahead.</p>
                <span
                  className="tm-btn tm-btn--primary"
                  style={{ width: '100%', justifyContent: 'center', marginTop: '14px', opacity: slot ? 1 : 0.45, pointerEvents: slot ? 'auto' : 'none' }}
                  onClick={() => setBooked(true)}
                >
                  Book intro call
                </span>
              </div>
            </React.Fragment>
          ) : (
            <div className="tm-card tmF-gate" style={{ padding: '40px 32px', gridColumn: '1 / -1', maxWidth: '520px', margin: '0 auto' }}>
              <span className="tm-pill tm-pill--mint"><Ic n="check" s={12} /> booked</span>
              <h3>You&rsquo;re on Michael&rsquo;s calendar</h3>
              <p>{slot} · 30-minute intro call for {sel.name}. A confirmation email with the meeting link is on its way.</p>
              <a className="tm-btn tm-btn--outline" href="Coaching.html">Back to coaching</a>
            </div>
          )}
        </div>
      </section>
      <TMFooter />
    </div>
  );
}

function BookingApp() {
  const [t, setTweak] = useTweaks({ density: 'regular', tints: true });
  return (
    <React.Fragment>
      <BookingPage t={t} />
      <TweaksPanel>
        <TweakSection label="Layout" />
        <TweakRadio label="Density" value={t.density} options={['compact', 'regular', 'comfy']} onChange={(v) => setTweak('density', v)} />
        <TweakToggle label="Section tints" value={t.tints} onChange={(v) => setTweak('tints', v)} />
      </TweaksPanel>
    </React.Fragment>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<BookingApp />);
