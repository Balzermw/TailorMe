// tm-shared.jsx — TailorMe v2: icons, copy data, shared components.
// All icon paths are from Lucide (lucide.dev, MIT / ISC license), inlined for offline reliability.

const TM_ICONS = {
  'check': '<path d="M20 6 9 17l-5-5"/>',
  'circle-check': '<circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/>',
  'arrow-right': '<path d="M5 12h14"/><path d="m12 5 7 7-7 7"/>',
  'arrow-down': '<path d="M12 5v14"/><path d="m19 12-7 7-7-7"/>',
  'upload': '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" x2="12" y1="3" y2="15"/>',
  'download': '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" x2="12" y1="15" y2="3"/>',
  'search': '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>',
  'trending-up': '<polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/>',
  'target': '<circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/>',
  'file-text': '<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="M10 9H8"/><path d="M16 13H8"/><path d="M16 17H8"/>',
  'clipboard-list': '<rect width="8" height="4" x="8" y="2" rx="1" ry="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><path d="M12 11h4"/><path d="M12 16h4"/><path d="M8 11h.01"/><path d="M8 16h.01"/>',
  'sparkles': '<path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/><path d="M5 3v4"/><path d="M19 17v4"/><path d="M3 5h4"/><path d="M17 19h4"/>',
  'lock': '<rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
  'trash-2': '<path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/><line x1="10" x2="10" y1="11" y2="17"/><line x1="14" x2="14" y1="11" y2="17"/>',
  'shield-check': '<path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1 1 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/><path d="m9 12 2 2 4-4"/>',
  'play': '<polygon points="6 3 20 12 6 21 6 3"/>',
  'user-check': '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><polyline points="16 11 18 13 22 9"/>',
  'pen-line': '<path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/>',
  'plus': '<path d="M5 12h14"/><path d="M12 5v14"/>',
  'link': '<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>',
  'eye': '<path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/>',
  'briefcase': '<rect width="20" height="14" x="2" y="6" rx="2"/><path d="M16 20V4a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/>',
  'list': '<path d="M3 12h.01"/><path d="M3 18h.01"/><path d="M3 6h.01"/><path d="M8 12h13"/><path d="M8 18h13"/><path d="M8 6h13"/>',
};

function Ic({ n, s = 18, sw = 2, style, className }) {
  return (
    <svg
      className={className}
      style={style}
      width={s}
      height={s}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={sw}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      dangerouslySetInnerHTML={{ __html: TM_ICONS[n] || '' }}
    ></svg>
  );
}

/* ---------------- copy & data ---------------- */

const TM_HEADLINES = {
  stronger: { pre: 'Your experience is ', em: 'stronger', post: ' than your resume makes it look.' },
  shows: { pre: 'Same experience. A resume that ', em: 'finally shows it', post: '.' },
  tasklist: { pre: 'Your resume reads like a task list. ', em: 'Your work isn\u2019t.', post: '' },
};

function TMHeadline({ id, className }) {
  const h = TM_HEADLINES[id] || TM_HEADLINES.stronger;
  return (
    <h1 className={'tm-h1 ' + (className || '')}>
      {h.pre}<em>{h.em}</em>{h.post}
    </h1>
  );
}

const TM_PAINS = [
  { q: 'My strong work reads like a task list.', d: 'Seven years of real impact, written like a job description.' },
  { q: 'I apply everywhere and hear nothing.', d: 'The same resume goes to forty postings \u2014 and silence comes back from most of them.' },
  { q: 'Recruiters don\u2019t see my value.', d: 'They skim for the role they\u2019re filling. A generic resume makes them do the translation \u2014 they won\u2019t.' },
];

const TM_STAKES = 'None of this means your experience is weak. It means your resume is doing a poor job of translating it \u2014 and every application it goes out on undersells you to someone who explained their impact better.';

const TM_PLAN = [
  { icon: 'upload', t: 'Upload your resume once', d: 'We build a structured profile from it \u2014 skills, experience, the achievements buried in your bullets.' },
  { icon: 'clipboard-list', t: 'Paste the job you want', d: 'A URL or the raw posting text. We score your fit across five dimensions before you spend a credit.' },
  { icon: 'download', t: 'Download resume + feedback', d: 'A tailored, compiled two-page PDF and cover letter, plus line-level fixes from three specialist reviewers.' },
];

const TM_BULLETS = [
  {
    before: '\u201CResponsible for developing and maintaining features for the web app using React and Node.js.\u201D',
    after: ['\u201CLed migration of checkout to a ', { k: 'distributed Node.js service' }, ', cutting p95 latency ', { m: '38%' }, ' across ', { m: '2.4M daily transactions' }, '.\u201D'],
  },
  {
    before: '\u201CParticipated in code reviews and mentoring.\u201D',
    after: ['\u201CMentored ', { m: '6 engineers' }, ' through promotion cycles while owning ', { k: 'Kubernetes' }, ' deployment standards.\u201D'],
  },
];

const TM_KEYWORDS = ['Distributed systems', 'Node.js at scale', 'Kubernetes', 'Observability', 'Mentorship'];

const TM_AGENTS = [
  {
    icon: 'search', name: 'ATS & keywords',
    notes: [
      { t: 'fix', txt: 'Posting names observability 3\u00D7 \u2014 your resume names it 0\u00D7. Add your Datadog dashboard work.' },
      { t: 'polish', txt: 'Kubernetes only appears in your skills list. Surface it in an experience bullet.' },
    ],
  },
  {
    icon: 'trending-up', name: 'Impact & metrics',
    notes: [
      { t: 'fix', txt: '\u201CMentored junior engineers\u201D \u2014 how many, over how long? Add team scope.' },
      { t: 'polish', txt: 'The migration bullet needs a baseline: what was p95 latency before?' },
    ],
  },
  {
    icon: 'target', name: 'Role-fit',
    notes: [
      { t: 'fix', txt: 'This role is 80% backend/platform. Move distributed-systems work above the frontend section.' },
      { t: 'polish', txt: 'Cut the 2014 PHP role to one line \u2014 it isn\u2019t pulling weight for this target.' },
    ],
  },
];

const TM_SCORES = [
  { l: 'Technical skills', v: 88 },
  { l: 'Experience match', v: 80 },
  { l: 'Culture fit', v: 74 },
  { l: 'Career alignment', v: 90 },
];

const TM_CHECKS = [
  { t: 'Evaluate fit', d: 'Five dimensions scored against your profile before a single word is drafted.' },
  { t: 'Tailor resume + cover letter', d: 'Content re-ranked by relevance to this posting, cut to fit exactly 2 pages.' },
  { t: 'Specialist agent review', d: 'ATS, impact, and role-fit agents critique every claim and flag concrete fixes.' },
  { t: 'Compile & inspect PDF', d: 'Rendered, visually checked for page breaks and orphans, fixed, re-rendered.' },
];

const TM_TERM_LINES = [
  { c: 'arr', t: '\u2192 parsing posting: Senior Platform Engineer \u2014 Nordpeak Systems' },
  { c: 'arr', t: '\u2192 scoring 5 dimensions against your profile\u2026 84/100 \u2014 strong fit' },
  { c: 'arr', t: '\u2192 tailoring Resume_Nordpeak.tex: re-ranking bullets for platform emphasis' },
  { c: 'arr', t: '\u2192 relevance cut: trimmed 4 low-signal bullets to land on exactly 2 pages' },
  { c: 'arr', t: '\u2192 ATS agent: posting names observability 3\u00D7, resume 0\u00D7 \u2014 flagging' },
  { c: 'ed', t: '\u270E edit: \u201Cmaintained web app features\u201D \u2192 \u201Cled checkout migration to distributed Node.js service\u201D' },
  { c: 'ed', t: '\u270E edit: added Datadog observability work to the platform section' },
  { c: 'arr', t: '\u2192 impact agent: \u201Cmentored engineers\u201D needs scope\u2026 added \u201C6 engineers\u201D' },
  { c: 'arr', t: '\u2192 compiling\u2026 2 pages, no orphaned entries, page breaks clean' },
  { c: 'ok', t: '\u2713 tailored resume + feedback report ready' },
];

const TM_PRICING = [
  { name: 'Starter', price: '$19', apps: '5 applications', per: '$3.80 each' },
  { name: 'Job hunt', price: '$49', apps: '15 applications', per: '$3.27 each', popular: true },
  { name: 'All in', price: '$99', apps: '40 applications', per: '$2.48 each', value: true },
];

const TM_FAQS = [
  { q: 'Is this just keyword stuffing?', a: 'No. Keywords only get added where your experience actually supports them \u2014 the real work is re-positioning: re-ranking your bullets for the role, translating tasks into impact, and cutting what isn\u2019t pulling weight.' },
  { q: 'Will this get me interviews?', a: 'We don\u2019t promise interviews or jobs \u2014 nobody honestly can. What we promise is a resume that\u2019s interview-ready: tailored to the posting, aligned with how ATS systems parse it, and reviewed line by line.' },
  { q: 'How is this different from a template or a chatbot?', a: 'Templates change how your resume looks; chatbots rewrite in one generic pass. TailorMe rewrites for one specific posting, runs three specialist reviewers over the draft, and compiles an inspected two-page PDF \u2014 with the reasoning shown.' },
  { q: 'What happens to my resume data?', a: 'It\u2019s encrypted at rest, never used to train models, and you can delete everything with one click. GDPR-aligned by design.' },
  { q: 'What does the human review add?', a: 'A professional Res.Me writer goes through your final draft line by line and adds positioning notes for your target role, within 48 hours. It\u2019s optional \u2014 every application already includes the full agent review. +$49 per application.' },
  { q: 'Do credits expire?', a: 'Never. Buy a pack, use it across your whole search \u2014 this month or next year. No subscription, no API keys.' },
];

const TM_TRUST = [
  { icon: 'lock', t: 'Your resume is encrypted at rest' },
  { icon: 'trash-2', t: 'Delete everything in one click' },
  { icon: 'shield-check', t: 'GDPR compliant by design' },
];

const TM_PIPE = ['Parse posting', 'Evaluate fit', 'Draft (LaTeX)', 'Agent review', 'Apply edits', 'Compile & inspect', 'Verify'];

/* ---------------- shared components ---------------- */

function Rich({ parts }) {
  return (
    <React.Fragment>
      {parts.map((p, i) =>
        typeof p === 'string' ? p : <mark key={i} className={p.k ? 'tm-k' : 'tm-m'}>{p.k || p.m}</mark>
      )}
    </React.Fragment>
  );
}

/* ---------------- simulated session (login demo) ---------------- */

const TM_SESSION_KEY = 'tm_session_v1';

function tmGetSession() {
  try { return JSON.parse(localStorage.getItem(TM_SESSION_KEY)); } catch (e) { return null; }
}

function tmSignIn(email, name) {
  const cleanEmail = (email || '').trim() || 'alex.m@email.com';
  const guess = cleanEmail.split('@')[0].split(/[._-]/).map((p) => p.charAt(0).toUpperCase() + p.slice(1)).join(' ');
  const s = { email: cleanEmail, name: name || guess || 'Alex Mercer', at: Date.now() };
  localStorage.setItem(TM_SESSION_KEY, JSON.stringify(s));
  return s;
}

function tmSignOut() {
  localStorage.removeItem(TM_SESSION_KEY);
}

function tmInitials(name) {
  return (name || 'A M').split(/\s+/).slice(0, 2).map((p) => p.charAt(0).toUpperCase()).join('');
}

function TMNav({ active = 'Home' }) {
  const session = tmGetSession();
  const links = [
    ['Home', 'TailorMe Homepage Final.html'],
    ['Pricing', 'Pricing.html'],
    ['Coaching', 'Coaching.html'],
  ];
  return (
    <header className="tm-nav">
      <a className="tm-nav-brand" href="TailorMe Homepage Final.html" style={{ textDecoration: 'none', color: 'inherit' }}>
        <img src="assets/resme-logomark.png" alt="Res.Me logomark" />
        <span className="tm-nav-name">TailorMe</span>
        <span className="tm-nav-by">by Res.Me</span>
      </a>
      <nav className="tm-nav-links">
        {links.map(([l, href]) => (
          <a key={l} href={href} className={l === active ? 'is-active' : ''}>{l}</a>
        ))}
        {!session && <a href="Sign In.html">Sign in</a>}
        {!session && <a className="tm-btn tm-btn--primary tm-btn--sm" href="Free Audit.html">Get a free resume audit</a>}
        {session && <a href="Dashboard.html" className={active === 'Dashboard' ? 'is-active' : ''}>Dashboard</a>}
        {session && (
          <a className="tm-nav-user" href="Settings.html" title={session.email}>
            <span className="tm-nav-avatar">{tmInitials(session.name)}</span>
            {session.name}
          </a>
        )}
        {session && (
          <a
            href="TailorMe Homepage Final.html"
            onClick={() => tmSignOut()}
          >Sign out</a>
        )}
      </nav>
    </header>
  );
}

function PainCards() {
  return (
    <div className="tm-pains">
      {TM_PAINS.map((p) => (
        <div key={p.q} className="tm-card tm-pain">
          <q>{p.q}</q>
          <p>{p.d}</p>
        </div>
      ))}
    </div>
  );
}

function PlanSteps({ inCards = true }) {
  return (
    <div className="tm-plan">
      {TM_PLAN.map((s, i) => (
        <div key={s.t} className={'tm-plan-step' + (inCards ? ' tm-card' : '')}>
          <span className="tm-plan-ic"><Ic n={s.icon} s={19} /></span>
          <h3>{i + 1}. {s.t}</h3>
          <p>{s.d}</p>
        </div>
      ))}
    </div>
  );
}

function BeforeAfter({ showKeywords = true }) {
  return (
    <div>
      <div className="tm-ba">
        <div className="tm-card tm-ba-card tm-ba-card--before">
          <span className="tm-pill tm-pill--gray tm-ba-label">Before</span>
          {TM_BULLETS.map((b, i) => <p key={i}>{b.before}</p>)}
        </div>
        <div className="tm-ba-arrow"><Ic n="arrow-right" s={20} /></div>
        <div className="tm-card tm-ba-card tm-ba-card--after">
          <span className="tm-pill tm-ba-label">After — tailored to Nordpeak</span>
          {TM_BULLETS.map((b, i) => <p key={i}><Rich parts={b.after} /></p>)}
        </div>
      </div>
      {showKeywords && (
        <div className="tm-keywords">
          <span className="tm-keywords-label">Keyword alignment:</span>
          {TM_KEYWORDS.map((k) => (
            <span key={k} className="tm-pill tm-pill--mint"><Ic n="check" s={12} /> {k}</span>
          ))}
        </div>
      )}
    </div>
  );
}

function AgentCards() {
  return (
    <div className="tm-agents">
      {TM_AGENTS.map((a) => (
        <div key={a.name} className="tm-card tm-agent">
          <span className="tm-agent-ic"><Ic n={a.icon} s={20} /></span>
          <h3>{a.name} agent</h3>
          {a.notes.map((n, i) => (
            <p key={i} className="tm-agent-note">
              <span className={'tm-tag tm-tag--' + n.t}>{n.t}</span>
              {n.txt}
            </p>
          ))}
        </div>
      ))}
    </div>
  );
}

function FitBars({ title = 'Fit score' }) {
  return (
    <div className="tm-fit">
      <div className="tm-fit-head">
        <h3>{title}</h3>
        <span className="tm-pill tm-pill--mint">84 — strong fit</span>
      </div>
      {TM_SCORES.map((s) => (
        <div key={s.l} className="tm-fit-row">
          <label>{s.l}</label>
          <div className="tm-fit-track"><div className="tm-fit-bar" style={{ width: s.v + '%' }}></div></div>
          <output>{s.v}</output>
        </div>
      ))}
      <div className="tm-fit-pass">
        <label>Location & logistics</label>
        <span className="tm-pill tm-pill--mint" style={{ justifySelf: 'start' }}><Ic n="check" s={12} /> pass</span>
      </div>
    </div>
  );
}

function DocsRow() {
  return (
    <div className="tm-docs">
      {[{ n: 'Resume_Nordpeak.pdf', m: '2 pages, inspected' }, { n: 'Cover_Nordpeak.pdf', m: '1 page, inspected' }].map((d) => (
        <div key={d.n} className="tm-card tm-doc">
          <span className="tm-doc-ic"><Ic n="file-text" s={26} sw={1.6} /></span>
          <span className="tm-doc-name">{d.n}</span>
          <span className="tm-doc-meta"><Ic n="check" s={12} /> {d.m}</span>
        </div>
      ))}
    </div>
  );
}

function TerminalPanel({ lines = TM_TERM_LINES }) {
  return (
    <div className="tm-term">
      {lines.map((l, i) => (
        <div key={i} className="tm-term-line"><span className={l.c}>{l.t}</span></div>
      ))}
    </div>
  );
}

function Checklist() {
  return (
    <div className="tm-checks">
      {TM_CHECKS.map((c) => (
        <div key={c.t} className="tm-check">
          <span className="tm-check-ic"><Ic n="check" s={13} /></span>
          <div>
            <h4>{c.t}</h4>
            <p>{c.d}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

function HumanReviewRow() {
  return (
    <div className="tm-card tm-human">
      <img className="tm-human-photo" src="assets/michael.png" alt="Michael, head of Res.Me" />
      <div className="tm-human-body">
        <h3>Add Michael’s expert review</h3>
        <p>Michael — head of Res.Me, Certified Professional Resume Writer, 650+ resumes
        written — goes through your final draft line by line and adds positioning notes
        for your target role. Back in your inbox within 48 hours.</p>
      </div>
      <div className="tm-human-price">
        <strong>+$49</strong>
        <span>per application</span>
      </div>
    </div>
  );
}

function PricingCards({ emphasis = 'popular' }) {
  return (
    <div className="tm-pricing">
      {TM_PRICING.map((p) => {
        const em = (emphasis === 'popular' && p.popular) || (emphasis === 'value' && p.value);
        const chip = emphasis === 'popular' && p.popular ? 'Most popular' : emphasis === 'value' && p.value ? 'Best value' : null;
        return (
          <div key={p.name} className={'tm-card tm-price-card' + (chip ? ' has-chip' : '') + (em ? (emphasis === 'value' ? ' is-em is-em--mint' : ' is-em') : '')}>
            <span className={'tm-pill' + (emphasis === 'value' && chip ? ' tm-pill--mint' : '')}>{chip || '\u00A0'}</span>
            <span className="tm-price-name">{p.name}</span>
            <span className="tm-price-num">{p.price}</span>
            <span className="tm-price-meta">{p.apps} · {p.per}</span>
            <a className={'tm-btn ' + (em ? 'tm-btn--primary' : 'tm-btn--outline')} href="Buy Credits.html">Buy credits</a>
          </div>
        );
      })}
    </div>
  );
}

function PricingTable({ emphasis = 'popular' }) {
  return (
    <div className="tm-price-table">
      {TM_PRICING.map((p) => {
        const em = (emphasis === 'popular' && p.popular) || (emphasis === 'value' && p.value);
        const chip = emphasis === 'popular' && p.popular ? 'Most popular' : emphasis === 'value' && p.value ? 'Best value' : null;
        return (
          <div key={p.name} className={'tm-price-trow' + (em ? (emphasis === 'value' ? ' is-em is-em--mint' : ' is-em') : '')}>
            <span className="tm-price-tname">{p.name} {chip && <span className={'tm-pill' + (emphasis === 'value' ? ' tm-pill--mint' : '')}>{chip}</span>}</span>
            <span className="tm-price-tcell">{p.apps}</span>
            <span className="tm-price-tcell">{p.per}</span>
            <span className="tm-price-tprice">{p.price}</span>
            <a className={'tm-btn tm-btn--sm ' + (em ? 'tm-btn--primary' : 'tm-btn--outline')} style={{ justifySelf: 'end' }} href="Buy Credits.html">Buy credits</a>
          </div>
        );
      })}
    </div>
  );
}

function FreeNote() {
  return (
    <p className="tm-small" style={{ textAlign: 'center', marginTop: '28px' }}>
      Every new account starts with <span className="tm-m">1 free application</span> — that’s your free resume audit. No card required.
    </p>
  );
}

function FaqList({ cols = false, openFirst = true }) {
  return (
    <div className={'tm-faq' + (cols ? ' tm-faq--cols' : '')}>
      {TM_FAQS.map((f, i) => (
        <details key={f.q} className="tm-faq-item" open={openFirst && i === 0}>
          <summary>{f.q} <Ic n="plus" s={16} /></summary>
          <p>{f.a}</p>
        </details>
      ))}
    </div>
  );
}

function TrustStrip() {
  return (
    <div className="tm-trust">
      {TM_TRUST.map((t) => (
        <span key={t.t} className="tm-trust-item"><Ic n={t.icon} s={16} /> {t.t}</span>
      ))}
    </div>
  );
}

function TMFooter() {
  return (
    <footer className="tm-footer">
      <span className="tm-footer-brand">
        <img src="assets/resme-logomark.png" alt="" />
        TailorMe — a Res.Me product
      </span>
      <span className="tm-footer-links">
        <a href="Privacy.html">Privacy</a><a href="Terms.html">Terms</a><a href="Contact.html">Contact</a>
      </span>
    </footer>
  );
}

Object.assign(window, {
  Ic, TM_ICONS, TM_HEADLINES, TMHeadline,
  tmGetSession, tmSignIn, tmSignOut, tmInitials,
  TM_PAINS, TM_STAKES, TM_PLAN, TM_BULLETS, TM_KEYWORDS, TM_AGENTS, TM_SCORES,
  TM_CHECKS, TM_TERM_LINES, TM_PRICING, TM_FAQS, TM_TRUST, TM_PIPE,
  Rich, TMNav, PainCards, PlanSteps, BeforeAfter, AgentCards, FitBars, DocsRow,
  TerminalPanel, Checklist, HumanReviewRow, PricingCards, PricingTable, FreeNote,
  FaqList, TrustStrip, TMFooter,
});
