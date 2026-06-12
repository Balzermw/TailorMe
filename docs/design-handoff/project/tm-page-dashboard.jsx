// tm-page-dashboard.jsx — TailorMe user dashboard.
// Interactive: filter chips, sort, detail drawer, simulated live pipeline run,
// Michael review tracking, credits + empty state (tweak).

const { useState, useEffect } = React;

const TMD_PIPE_STAGES = ['Parse', 'Fit', 'Draft', 'Review', 'Compile', 'Done'];

const TMD_APPS = [
  { id: 'nordpeak', co: 'Nordpeak Systems', role: 'Senior Platform Engineer', fit: 84, tier: 'strong', status: 'ready', date: 'Today', michael: 'none' },
  { id: 'lumengrid', co: 'Lumen Grid', role: 'Staff Backend Engineer', fit: null, tier: null, status: 'running', date: 'Today', michael: 'none' },
  { id: 'helio', co: 'Helio Analytics', role: 'Senior Software Engineer', fit: 76, tier: 'good', status: 'michael', date: 'Yesterday', michael: 'reviewing' },
  { id: 'brightcart', co: 'Brightcart', role: 'Engineering Manager', fit: 58, tier: 'moderate', status: 'scored', date: 'Jun 8', michael: 'none' },
  { id: 'vantora', co: 'Vantora', role: 'Senior Frontend Engineer', fit: 41, tier: 'weak', status: 'scored', date: 'Jun 6', michael: 'none' },
];

const TMD_STATUS = {
  ready: { dot: 'ok', label: 'Reviewed — ready to download' },
  running: { dot: 'run', label: 'Running' },
  michael: { dot: 'wait', label: 'Michael reviewing — returns in ~36h' },
  scored: { dot: 'idle', label: 'Scored only — no credit spent' },
};

function FitCell({ fit, tier }) {
  if (fit == null) return <span className="tm-small" style={{ fontSize: '12.5px' }}>scoring…</span>;
  const cls = tier === 'strong' || tier === 'good' ? 'is-mint' : tier === 'weak' ? 'is-weak' : '';
  return (
    <div className="tmD-fit">
      <div className="tmD-fit-track"><div className={'tmD-fit-bar ' + cls} style={{ width: fit + '%' }}></div></div>
      <output>{fit}</output>
    </div>
  );
}

function RunningPipe({ stage }) {
  return (
    <div className="tmD-pipe">
      {TMD_PIPE_STAGES.slice(0, 5).map((s, i) => (
        <i key={s} className={i < stage ? 'done' : i === stage ? 'now' : ''}>{i < stage ? '✓ ' : ''}{s}</i>
      ))}
    </div>
  );
}

function Drawer({ app, onClose }) {
  const st = TMD_STATUS[app.status];
  return (
    <div className="tm-card tmD-drawer">
      <div className="tmD-drawer-head">
        <div>
          <b>{app.role}</b>
          <span>{app.co} · {app.date}</span>
        </div>
        <span className="tmD-drawer-x" onClick={onClose}><Ic n="plus" s={18} style={{ transform: 'rotate(45deg)' }} /></span>
      </div>
      <div className="tmD-status"><span className={'tmD-status-dot ' + st.dot}></span> {st.label}</div>

      {app.fit != null && (
        <React.Fragment>
          <p className="tmD-drawer-sec">Fit breakdown</p>
          <div className="tm-fit">
            {TM_SCORES.map((s, i) => (
              <div key={s.l} className="tm-fit-row">
                <label>{s.l}</label>
                <div className="tm-fit-track"><div className="tm-fit-bar" style={{ width: Math.max(20, s.v - (84 - app.fit)) + '%' }}></div></div>
                <output>{Math.max(20, s.v - (84 - app.fit))}</output>
              </div>
            ))}
          </div>
        </React.Fragment>
      )}

      {app.status === 'ready' && (
        <React.Fragment>
          <p className="tmD-drawer-sec">Agent notes (top fixes)</p>
          {TM_AGENTS.map((a) => (
            <p key={a.name} className="tmB-rq-item" style={{ fontSize: '12.5px' }}>
              <span className="tm-pill">{a.name}</span>
              {a.notes[0].txt}
            </p>
          ))}
          <p className="tmD-drawer-sec">Files</p>
          <div className="tmD-files">
            <span className="tmB-ev-file"><Ic n="file-text" s={15} /> <span>Resume_{app.co.split(' ')[0]}.pdf</span> <span className="ok"><Ic n="check" s={11} /> 2 pages</span></span>
            <span className="tmB-ev-file"><Ic n="file-text" s={15} /> <span>Cover_{app.co.split(' ')[0]}.pdf</span> <span className="ok"><Ic n="check" s={11} /> 1 page</span></span>
          </div>
          <span className="tm-btn tm-btn--primary" style={{ justifyContent: 'center' }}><Ic n="download" s={15} /> Download both</span>
        </React.Fragment>
      )}

      {app.status === 'scored' && (
        <React.Fragment>
          <p className="tmD-drawer-sec">Next step</p>
          <p className="tm-small">
            {app.tier === 'weak'
              ? 'Weak fit — the score suggests skipping this one and saving your credit for a stronger match.'
              : 'Scored without spending a credit. Run the full tailoring when you\u2019re ready.'}
          </p>
          <span className={'tm-btn ' + (app.tier === 'weak' ? 'tm-btn--outline' : 'tm-btn--primary')} style={{ justifyContent: 'center' }}>
            Tailor my resume — 1 credit
          </span>
        </React.Fragment>
      )}

      {app.status !== 'scored' && (
        <div className={'tmD-michael' + (app.michael === 'reviewing' ? ' is-active' : '')}>
          <img src="assets/michael.png" alt="" />
          <div style={{ flex: 1 }}>
            <b>{app.michael === 'reviewing' ? 'Michael is reviewing this one' : 'Add Michael\u2019s expert review'}</b>
            <span>{app.michael === 'reviewing' ? 'In queue since yesterday · returns in ~36h' : 'Line-by-line pass · 48h turnaround'}</span>
          </div>
          {app.michael === 'none' && <span className="tm-pill tm-pill--mint">+$49</span>}
          {app.michael === 'reviewing' && <span className="tm-pill tm-pill--mint"><Ic n="check" s={12} /> added</span>}
        </div>
      )}
    </div>
  );
}

const TMD_DOCS = [
  { name: 'Resume_Nordpeak.pdf', kind: 'Tailored resume', co: 'Nordpeak Systems · Senior Platform Engineer', pages: '2 pages', date: 'Today', fit: 84 },
  { name: 'Cover_Nordpeak.pdf', kind: 'Cover letter', co: 'Nordpeak Systems · Senior Platform Engineer', pages: '1 page', date: 'Today', fit: 84 },
  { name: 'Resume_Helio.pdf', kind: 'Tailored resume', co: 'Helio Analytics · Senior Software Engineer', pages: '2 pages', date: 'Yesterday', fit: 76 },
  { name: 'Cover_Helio.pdf', kind: 'Cover letter', co: 'Helio Analytics · Senior Software Engineer', pages: '1 page', date: 'Yesterday', fit: 76 },
  { name: 'Alex_Mercer_master.pdf', kind: 'Master resume', co: 'Your uploaded original — every application starts here', pages: '3 pages', date: 'Jun 2', fit: null },
];

function DocumentsView() {
  return (
    <div className="tmD-docs">
      {TMD_DOCS.map((d) => (
        <div key={d.name} className="tm-card tmD-doc">
          <span className="tmD-doc-thumb">
            <Ic n="file-text" s={22} sw={1.5} />
          </span>
          <span className="tmD-doc-body">
            <b>{d.name}</b>
            <span>{d.kind} · {d.pages} · {d.date}</span>
            <span className="tmD-doc-co">{d.co}</span>
          </span>
          <span className="tmD-doc-side">
            {d.fit != null
              ? <span className="tm-pill tm-pill--mint">{d.fit} fit</span>
              : <span className="tm-pill tm-pill--gray">original</span>}
            <span className="tm-btn tm-btn--outline tm-btn--sm"><Ic n="download" s={13} /> Download</span>
          </span>
        </div>
      ))}
    </div>
  );
}

function DashboardPage({ t }) {
  const [filter, setFilter] = useState('all');
  const [sort, setSort] = useState('date');
  const [view, setView] = useState('apps'); // apps | docs
  const [openId, setOpenId] = useState('nordpeak');
  const [runStage, setRunStage] = useState(1);
  const session = tmGetSession();

  // simulated live run
  useEffect(() => {
    const id = setInterval(() => setRunStage((s) => (s >= 4 ? 1 : s + 1)), 2200);
    return () => clearInterval(id);
  }, []);

  if (!session) {
    return (
      <div className="tm tmB tm--page" data-density={t.density} data-tints={t.tints ? 'on' : 'off'} data-screen-label="Dashboard — signed out">
        <TMNav active="Dashboard" />
        <section className="tm-sec">
          <div className="tm-wrap">
            <div className="tm-card tmD-empty" style={{ marginTop: '12px' }}>
              <Ic n="lock" s={30} sw={1.5} style={{ color: 'var(--tm-blue-600)' }} />
              <h2>Sign in to see your applications</h2>
              <p>Your tailored resumes, cover letters, and agent feedback live here — sign in to pick up where you left off.</p>
              <a className="tm-btn tm-btn--primary tm-btn--lg" href="Sign In.html">Sign in</a>
            </div>
          </div>
        </section>
        <TMFooter />
      </div>
    );
  }

  if (t.userState === 'new') {
    return (
      <div className="tm tmB tm--page" data-density={t.density} data-tints={t.tints ? 'on' : 'off'} data-screen-label="Dashboard — new user">
        <TMNav active="Dashboard" />
        <section className="tm-sec">
          <div className="tm-wrap">
            <div className="tmD-head">
              <h1>Welcome to TailorMe</h1>
              <div className="tmD-head-right">
                <span className="tmD-credits"><Ic n="sparkles" s={14} /> <b>1 free application</b></span>
              </div>
            </div>
            <div className="tm-card tmD-empty" style={{ marginTop: '28px' }}>
              <Ic n="file-text" s={34} sw={1.4} style={{ color: 'var(--tm-blue-600)' }} />
              <h2>Run your first application — it&rsquo;s free</h2>
              <p>Upload your resume once, paste the job you want, and see the tailored result with full agent feedback. No card required.</p>
              <a className="tm-btn tm-btn--primary tm-btn--lg" href="Free Audit.html"><Ic n="sparkles" s={16} /> Start my free application</a>
            </div>
          </div>
        </section>
        <TMFooter />
      </div>
    );
  }

  const filtered = TMD_APPS.filter((a) => {
    if (filter === 'all') return true;
    if (filter === 'strong') return a.tier === 'strong' || a.tier === 'good';
    if (filter === 'ready') return a.status === 'ready';
    if (filter === 'michael') return a.michael !== 'none';
    return true;
  });
  const sorted = [...filtered].sort((a, b) => (sort === 'fit' ? (b.fit || 0) - (a.fit || 0) : 0));
  const openApp = TMD_APPS.find((a) => a.id === openId && sorted.some((s) => s.id === a.id));

  return (
    <div className="tm tmB tm--page" data-density={t.density} data-tints={t.tints ? 'on' : 'off'} data-screen-label="Dashboard">
      <TMNav active="Dashboard" />
      <section className="tm-sec">
        <div className="tm-wrap">
          <div className="tmD-head">
            <div>
              <h1>Your applications</h1>
              <p className="tm-small" style={{ marginTop: '4px' }}>Signed in as {session.name} · {session.email}</p>
            </div>
            <div className="tmD-head-right">
              <span className="tmD-credits"><b>7 credits</b> · <a href="Buy Credits.html">buy more</a></span>
              <a className="tm-btn tm-btn--primary" href="Free Audit.html"><Ic n="plus" s={15} /> New application</a>
              <a className="tm-btn tm-btn--outline" href="Settings.html">Settings</a>
            </div>
          </div>

          <div className="tmD-tabs">
            <span className={'tmD-tab' + (view === 'apps' ? ' is-on' : '')} onClick={() => setView('apps')}>Applications <i>{TMD_APPS.length}</i></span>
            <span className={'tmD-tab' + (view === 'docs' ? ' is-on' : '')} onClick={() => setView('docs')}>Documents <i>{TMD_DOCS.length}</i></span>
          </div>

          {view === 'docs' ? (
            <DocumentsView />
          ) : (
          <React.Fragment>
          <div className="tmD-filters">
            {[['all', 'All'], ['strong', 'Strong fits'], ['ready', 'Ready'], ['michael', 'With Michael']].map(([k, l]) => (
              <span key={k} className={'tmD-chip' + (filter === k ? ' is-on' : '')} onClick={() => { setFilter(k); }}>{l}</span>
            ))}
            <span className="tmD-sort">
              sort by
              <span className={sort === 'date' ? 'is-on' : ''} onClick={() => setSort('date')}>date</span>
              <span className={sort === 'fit' ? 'is-on' : ''} onClick={() => setSort('fit')}>fit</span>
            </span>
          </div>

          <div className={'tmD-layout' + (openApp ? ' has-drawer' : '')} style={{ marginTop: '4px' }}>
            <div className="tmD-list">
              {sorted.map((a) => {
                const st = TMD_STATUS[a.status];
                return (
                  <div key={a.id} className={'tm-card tmD-row' + (openId === a.id ? ' is-open' : '')} onClick={() => setOpenId(a.id)}>
                    <span className="tmD-row-co"><b>{a.role}</b><span>{a.co}</span></span>
                    <FitCell fit={a.fit} tier={a.tier} />
                    {a.status === 'running'
                      ? <RunningPipe stage={runStage} />
                      : <span className="tmD-status"><span className={'tmD-status-dot ' + st.dot}></span> {st.label}</span>}
                    <span className="tmD-row-date">{a.date}</span>
                  </div>
                );
              })}
              {sorted.length === 0 && (
                <div className="tm-card tmD-empty"><p>Nothing matches this filter.</p></div>
              )}
            </div>
            {openApp && <Drawer app={openApp} onClose={() => setOpenId(null)} />}
          </div>
          </React.Fragment>
          )}
        </div>
      </section>
      <TMFooter />
    </div>
  );
}

function DashboardApp() {
  const [t, setTweak] = useTweaks({ density: 'regular', tints: true, userState: 'midsearch' });
  return (
    <React.Fragment>
      <DashboardPage t={t} />
      <TweaksPanel>
        <TweakSection label="State" />
        <TweakRadio
          label="User"
          value={t.userState}
          options={[{ value: 'midsearch', label: 'mid-search' }, { value: 'new', label: 'new user' }]}
          onChange={(v) => setTweak('userState', v)}
        />
        <TweakSection label="Layout" />
        <TweakRadio label="Density" value={t.density} options={['compact', 'regular', 'comfy']} onChange={(v) => setTweak('density', v)} />
        <TweakToggle label="Section tints" value={t.tints} onChange={(v) => setTweak('tints', v)} />
      </TweaksPanel>
    </React.Fragment>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<DashboardApp />);
