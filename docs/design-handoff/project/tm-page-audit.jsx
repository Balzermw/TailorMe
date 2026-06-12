// tm-page-audit.jsx — "Get a free resume audit": clickable 3-step wizard.
// Step 1 upload+parse → Step 2 posting+fit score → Step 3 watermarked results + account gate.

const { useState, useEffect } = React;

// Per-dimension evidence for the fit score — what matched and what's missing.
const TMF_FIT_WHY = [
  { // Technical skills · 88
    plus: [
      'Node.js at scale — your checkout-migration bullet matches the posting\u2019s core requirement',
      'Kubernetes — you own deployment standards; named as required',
      'Distributed systems — strong overlap with the platform team\u2019s stack',
    ],
    minus: ['Observability appears 3× in the posting but 0× in your resume — tailoring will surface your Datadog work'],
  },
  { // Experience match · 80
    plus: [
      '7 years senior-level vs 5+ required',
      'Migration ownership maps directly to the role\u2019s \u201Cown our platform evolution\u201D mandate',
    ],
    minus: ['No formal platform-team title — your platform work is buried under a generic SWE heading'],
  },
  { // Culture fit · 74
    plus: [
      'Mentoring 6 engineers matches the posting\u2019s \u201Cgrow the team\u201D emphasis',
      'Code-review ownership signals the collaboration they ask for',
    ],
    minus: ['Little evidence of cross-team work in your current bullets — likely present, just unwritten'],
  },
  { // Career alignment · 90
    plus: [
      'Natural next step: your last 3 years trend toward platform and infrastructure work',
      'The role\u2019s scope matches the trajectory your bullets already show',
    ],
    minus: [],
  },
];

function Stepper({ step }) {
  const items = ['Your resume', 'The job', 'Agent audit'];
  return (
    <div className="tmF-stepper">
      {items.map((l, i) => (
        <React.Fragment key={l}>
          {i > 0 && <span className="tmF-stepper-sep"></span>}
          <span className={'tmF-stepper-item' + (i === step ? ' is-on' : '') + (i < step ? ' is-done' : '')}>
            <span className="tmF-stepper-num">{i < step ? <Ic n="check" s={12} /> : i + 1}</span> {l}
          </span>
        </React.Fragment>
      ))}
    </div>
  );
}

function StepUpload({ onNext }) {
  const [phase, setPhase] = useState('idle'); // idle → parsing → done
  useEffect(() => {
    if (phase === 'parsing') {
      const id = setTimeout(() => setPhase('done'), 1700);
      return () => clearTimeout(id);
    }
  }, [phase]);

  return (
    <div className="tm-card">
      {phase === 'idle' && (
        <div>
          <div className="tmF-drop" onClick={() => setPhase('parsing')}>
            <Ic n="upload" s={26} sw={1.6} />
            <b>Drop your resume here</b>
            <span>PDF or Word · parsed once, encrypted at rest</span>
          </div>
          <p className="tmF-or">or</p>
          <span className="tm-btn tm-btn--outline" style={{ width: '100%', justifyContent: 'center' }} onClick={() => setPhase('parsing')}>
            Try with the sample resume (Alex M.)
          </span>
        </div>
      )}
      {phase === 'parsing' && (
        <div className="tmF-parse">
          <p className="tmF-parse-line"><Ic n="check" s={14} /> Reading Resume_AlexM.pdf…</p>
          <p className="tmF-parse-line"><Ic n="check" s={14} /> Extracting roles, dates, and skills</p>
          <p className="tmF-parse-line"><Ic n="check" s={14} /> Finding the achievements buried in your bullets</p>
          <p className="tmF-parse-line"><Ic n="check" s={14} /> Profile ready</p>
        </div>
      )}
      {phase === 'done' && (
        <div className="tmF-profile2">
          <div className="tmF-profile2-id">
            <image-slot id="audit-client-photo" shape="circle" placeholder="" style={{ width: '64px', height: '64px' }}></image-slot>
            <div>
              <b>Alex Mercer</b>
              <span className="tm-small" style={{ display: 'block', marginTop: '2px' }}>Senior Software Engineer · 7 yrs · sample profile</span>
            </div>
            <span className="tm-pill tm-pill--mint" style={{ marginLeft: 'auto' }}><Ic n="check" s={12} /> parsed</span>
          </div>
          <div className="tmF-profile2-cols">
            <div className="tmF-p2-group">
              <p className="tmF-p2-label">What we extracted</p>
              <div className="tmF-p2-rows">
                <span className="tmF-p2-row"><Ic n="briefcase" s={15} /> <span><b>2</b> roles, 2014 – present</span></span>
                <span className="tmF-p2-row"><Ic n="list" s={15} /> <span><b>14</b> experience bullets</span></span>
                <span className="tmF-p2-row"><Ic n="trending-up" s={15} /> <span><b>3</b> bullets with metrics</span></span>
              </div>
            </div>
            <div className="tmF-p2-group">
              <p className="tmF-p2-label">Skills found <span className="tmF-p2-count">11</span></p>
              <div className="tmF-chips">
                {['React', 'Node.js', 'Kubernetes', 'PostgreSQL', 'Mentoring'].map((s) => (
                  <span key={s} className="tm-pill tm-pill--gray">{s}</span>
                ))}
                <span className="tm-pill tm-pill--line">+6 more</span>
              </div>
            </div>
          </div>
          <div className="tmF-profile2-foot">
            <span className="tm-btn tm-btn--primary" onClick={onNext}>Next — pick the job <Ic n="arrow-right" s={15} /></span>
          </div>
        </div>
      )}
    </div>
  );
}

function StepJob({ onNext }) {
  const [phase, setPhase] = useState('idle'); // idle → scoring → done
  const [text, setText] = useState('');
  const [w, setW] = useState([0, 0, 0, 0]);
  const [why, setWhy] = useState(0); // which dimension's evidence is open
  useEffect(() => {
    if (phase === 'scoring') {
      const a = setTimeout(() => setW(TM_SCORES.map((s) => s.v)), 250);
      const b = setTimeout(() => setPhase('done'), 1300);
      return () => { clearTimeout(a); clearTimeout(b); };
    }
  }, [phase]);

  const sample = 'https://nordpeak.io/careers/senior-platform-engineer';
  return (
    <div className="tm-card">
      <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, marginBottom: '8px' }}>Paste a job URL or the posting text</label>
      <textarea
        className="tmF-ta"
        value={text}
        placeholder="https://…  or paste the full posting"
        onChange={(e) => setText(e.target.value)}
      ></textarea>
      {phase === 'idle' && (
        <div className="tmF-actions" style={{ justifyContent: 'space-between' }}>
          <span className="tm-btn tm-btn--ghost" onClick={() => setText(sample)}>Use the sample posting</span>
          <span
            className="tm-btn tm-btn--primary"
            style={{ opacity: text ? 1 : 0.45, pointerEvents: text ? 'auto' : 'none' }}
            onClick={() => setPhase('scoring')}
          >
            Score my fit <Ic n="arrow-right" s={15} />
          </span>
        </div>
      )}
      {phase !== 'idle' && (
        <div style={{ marginTop: '24px' }}>
          <div className="tm-fit tmF-fit">
            <div className="tm-fit-head">
              <h3>Senior Platform Engineer — Nordpeak Systems</h3>
              {phase === 'done' && <span className="tm-pill tm-pill--mint">84 — strong fit</span>}
            </div>
            {TM_SCORES.map((s, i) => (
              <div key={s.l}>
                <div
                  className={'tm-fit-row tmF-why-row' + (phase === 'done' ? ' is-clickable' : '')}
                  onClick={() => phase === 'done' && setWhy(why === i ? -1 : i)}
                >
                  <label>{s.l}</label>
                  <div className="tm-fit-track"><div className="tm-fit-bar" style={{ width: w[i] + '%' }}></div></div>
                  <output>{phase === 'done' ? s.v : ''}</output>
                  {phase === 'done' && <span className={'tmF-why-toggle' + (why === i ? ' is-open' : '')}><Ic n="plus" s={13} /></span>}
                </div>
                {phase === 'done' && why === i && (
                  <div className="tmF-why">
                    {TMF_FIT_WHY[i].plus.map((p) => (
                      <p key={p} className="tmF-why-line is-plus"><Ic n="check" s={12} /> {p}</p>
                    ))}
                    {TMF_FIT_WHY[i].minus.map((m) => (
                      <p key={m} className="tmF-why-line is-minus"><Ic n="plus" s={12} style={{ transform: 'rotate(45deg)' }} /> {m}</p>
                    ))}
                  </div>
                )}
              </div>
            ))}
            <div className="tm-fit-pass">
              <label>Location & logistics</label>
              {phase === 'done'
                ? <span className="tm-small" style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', fontSize: '12.5px' }}><span className="tm-pill tm-pill--mint"><Ic n="check" s={12} /> pass</span> posting allows Remote EU — your profile lists Copenhagen</span>
                : <span className="tm-small">checking…</span>}
            </div>
          </div>
          {phase === 'done' && (
            <React.Fragment>
            <div className="tmF-verdict">
              <b>Why 84 — strong fit:</b> your platform work lines up with 4 of 5 dimensions.
              The weakest one — culture fit — isn&rsquo;t missing experience, it&rsquo;s missing
              evidence in your bullets. That&rsquo;s exactly what tailoring surfaces. Tap any
              dimension to see what we found.
            </div>
            <div className="tmF-actions">
              <span className="tm-btn tm-btn--primary" onClick={onNext}>Run my free audit <Ic n="arrow-right" s={15} /></span>
            </div>
            </React.Fragment>
          )}
        </div>
      )}
    </div>
  );
}

function StepResults() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div className="tm-card tmF-wm tmB-paper--doc tmB-paper" style={{ border: '0.5px solid var(--tm-border)' }}>
        <div className="tmB-pdoc-head">
          <span className="tmB-pdoc-avatar">AM</span>
          <p className="tmB-pdoc-name">Alex Mercer</p>
          <p className="tmB-pdoc-contact">Senior Platform Engineer · Copenhagen · alex.m@email.com</p>
        </div>
        <div className="tmB-pdoc-rule"></div>
        <p className="tmB-pdoc-sec">Experience</p>
        <p className="tmB-pdoc-bullet">Led migration of checkout to a <mark className="tm-k">distributed Node.js service</mark>, cutting p95 latency <mark className="tm-m">38%</mark> across 2.4M daily transactions.</p>
        <p className="tmB-pdoc-bullet">Mentored <mark className="tm-m">6 engineers</mark> through promotion cycles while owning <mark className="tm-k">Kubernetes</mark> deployment standards.</p>
      </div>
      <div className="tm-card" style={{ padding: '22px 24px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <span className="tmB-ev-head"><Ic n="sparkles" s={14} /> Reviewed by 3 trained specialist agents</span>
        <p className="tm-small" style={{ fontSize: '12.5px', marginTop: '-4px' }}>Each agent reads your draft as a different gatekeeper — the ATS parser, the recruiter, the hiring manager — and returns concrete fixes, not a score.</p>
        {TM_AGENTS.map((a) => (
          <p key={a.name} className="tmB-rq-item">
            <span className="tm-pill">{a.name}</span>
            {a.notes[0].txt}
          </p>
        ))}
      </div>
      <div className="tm-card tmF-michael">
        <img src="assets/michael.png" alt="Michael, head of Res.Me" />
        <div className="tmF-michael-body">
          <span className="tmF-michael-eyebrow"><Ic n="pen-line" s={13} /> Optional human pass</span>
          <h3>Want real human eyes on it? That&rsquo;s Michael.</h3>
          <p>
            The agents catch what a parser and a skim-read see. Michael — head of Res.Me,
            Certified Professional Resume Writer, 650+ resumes written — reads it like the
            hiring manager: he goes line by line through your final draft and adds
            positioning notes for this specific role. Back in your inbox within 48 hours.
          </p>
          <div className="tmF-michael-foot">
            <span className="tm-pill tm-pill--mint">+$49 per application</span>
            <span className="tm-small" style={{ fontSize: '12.5px' }}>Add it at checkout — or <a href="Coaching.html" style={{ color: 'var(--tm-blue-600)', textDecoration: 'none' }}>meet Michael first</a></span>
          </div>
        </div>
      </div>
      <div className="tm-card tmF-gate" style={{ padding: '30px' }}>
        <span className="tm-pill tm-pill--mint"><Ic n="check" s={12} /> your audit is ready</span>
        <h3>Create a free account to download it</h3>
        <p>The clean PDF, the cover letter, and the full line-by-line feedback report. Your first application is free — no card required.</p>
        <a className="tm-btn tm-btn--primary tm-btn--lg" href="Sign In.html"><Ic n="sparkles" s={16} /> Create free account</a>
        <p className="tm-small" style={{ fontSize: '12px' }}>Encrypted at rest · delete everything in one click</p>
      </div>
    </div>
  );
}

function AuditPage({ t }) {
  const [step, setStep] = useState(0);
  return (
    <div className="tm tmB tm--page" data-density={t.density} data-tints={t.tints ? 'on' : 'off'} data-screen-label="Free audit wizard">
      <TMNav active="" />
      <section className="tm-sec tmF-head" style={{ paddingBottom: 0 }}>
        <span className="tm-pill">Free agentic AI audit</span>
        <h1 className="tm-h1">See what tailoring does to your resume</h1>
        <p className="tm-body">
          Three steps, about two minutes. Your draft is reviewed by three specialist AI
          agents — trained on ATS parsing, impact, and role-fit — each returning
          line-level fixes. First application free, no card required.
        </p>
        <Stepper step={step} />
      </section>
      <section className="tm-sec" style={{ paddingTop: 0 }}>
        <div className="tmF-panel">
          {step === 0 && <StepUpload onNext={() => setStep(1)} />}
          {step === 1 && <StepJob onNext={() => setStep(2)} />}
          {step === 2 && <StepResults />}
          {step > 0 && step < 2 && (
            <p className="tm-small" style={{ textAlign: 'center', marginTop: '16px', cursor: 'pointer' }} onClick={() => setStep(step - 1)}>← back</p>
          )}
        </div>
      </section>
      <TMFooter />
    </div>
  );
}

function AuditApp() {
  const [t, setTweak] = useTweaks({ density: 'regular', tints: true });
  return (
    <React.Fragment>
      <AuditPage t={t} />
      <TweaksPanel>
        <TweakSection label="Layout" />
        <TweakRadio label="Density" value={t.density} options={['compact', 'regular', 'comfy']} onChange={(v) => setTweak('density', v)} />
        <TweakToggle label="Section tints" value={t.tints} onChange={(v) => setTweak('tints', v)} />
      </TweaksPanel>
    </React.Fragment>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<AuditApp />);
