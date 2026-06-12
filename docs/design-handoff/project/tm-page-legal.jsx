// tm-page-legal.jsx — Privacy + Terms (kind set via window.TM_LEGAL in the HTML shell).

const TM_PRIVACY = {
  title: 'Privacy policy',
  updated: 'Last updated June 2026 · placeholder draft — requires legal review before publishing',
  sections: [
    ['What we collect', 'Your account email, the resume you upload, job postings you paste, and the documents the pipeline produces for you. Payment details go directly to Stripe — we never see your card number.'],
    ['How your resume data is used', 'Only to run your applications: parsing your profile, tailoring documents, and generating reviewer feedback. Your resume data is never used to train AI models and never shared with employers or third parties.'],
    ['Encryption & storage', 'Resume data is encrypted at rest. Documents are stored so you can re-download past applications; you can delete any application — or everything — at any time.'],
    ['One-click deletion', 'Account settings include a single control that permanently deletes your profile, uploaded resumes, generated documents, and feedback history. Deletion is immediate and irreversible.'],
    ['GDPR', 'We are GDPR-aligned by design: you can export your data, correct it, or erase it. For data requests, contact us — we respond within 30 days.'],
    ['Cookies & analytics', 'We use essential cookies for sign-in sessions and minimal, privacy-respecting analytics to understand product usage. No advertising trackers.'],
  ],
};

const TM_TERMS = {
  title: 'Terms of service',
  updated: 'Last updated June 2026 · placeholder draft — requires legal review before publishing',
  sections: [
    ['The service', 'TailorMe by Res.Me tailors your resume and cover letter to specific job postings, reviews them with specialist AI agents, and offers optional human expert review. You keep full ownership of your documents.'],
    ['Credits', 'One credit runs one application against one job posting, including re-runs against that same posting. Credits are purchased in packs, never expire, and are tied to your account. There is no subscription.'],
    ['Refunds', 'Unused credits are refundable in full within 30 days of purchase. Used credits and completed human reviews are non-refundable. [Placeholder — confirm final policy.]'],
    ['No employment guarantees', 'TailorMe improves how your experience is presented. We do not and cannot guarantee interviews, job offers, response rates, or salary outcomes — and we make no claims of bypassing applicant tracking systems.'],
    ['Acceptable use', 'Use TailorMe only with your own resume and truthful information. The service must not be used to fabricate experience, credentials, or identities.'],
    ['Human review', 'The optional expert review is performed by a Res.Me professional within the stated turnaround (typically 48 hours) and consists of editorial feedback on your documents.'],
    ['Changes', 'We may update these terms; material changes will be announced by email at least 14 days in advance.'],
  ],
};

function LegalPage({ t }) {
  const doc = window.TM_LEGAL === 'terms' ? TM_TERMS : TM_PRIVACY;
  return (
    <div className="tm tmB tm--page" data-density={t.density} data-tints={t.tints ? 'on' : 'off'} data-screen-label={doc.title}>
      <TMNav active="" />
      <section className="tm-sec">
        <div className="tm-wrap--narrow">
          <h1 style={{ fontSize: 'clamp(30px, 3.4vw, 40px)', fontWeight: 500, letterSpacing: '-0.02em' }}>{doc.title}</h1>
          <p className="tm-small" style={{ marginTop: '10px' }}>{doc.updated}</p>
          <div className="tmL-doc">
            {doc.sections.map(([h, body]) => (
              <div key={h} className="tmL-sec">
                <h2>{h}</h2>
                <p>{body}</p>
              </div>
            ))}
          </div>
          <div className="tm-card" style={{ padding: '20px 24px', marginTop: '40px', display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap' }}>
            <Ic n="shield-check" s={18} style={{ color: 'var(--tm-mint-600)', flexShrink: 0 }} />
            <p className="tm-small" style={{ flex: 1, minWidth: '240px' }}>Questions about your data or these terms?</p>
            <a className="tm-btn tm-btn--outline tm-btn--sm" href="Contact.html">Contact us</a>
          </div>
        </div>
      </section>
      <TMFooter />
    </div>
  );
}

function LegalApp() {
  const [t, setTweak] = useTweaks({ density: 'regular', tints: true });
  return (
    <React.Fragment>
      <LegalPage t={t} />
      <TweaksPanel>
        <TweakSection label="Layout" />
        <TweakRadio label="Density" value={t.density} options={['compact', 'regular', 'comfy']} onChange={(v) => setTweak('density', v)} />
        <TweakToggle label="Section tints" value={t.tints} onChange={(v) => setTweak('tints', v)} />
      </TweaksPanel>
    </React.Fragment>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<LegalApp />);
