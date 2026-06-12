# TailorMe — by Res.Me

Your experience is stronger than your resume makes it look. Paste the job you want; we tailor your resume to it, run specialist AI reviewer agents over every line (ATS/keywords, impact/metrics, role fit), and offer a paid Res.Me human expert review (+$49/application). Pay per application with credit packs; first application is the free audit.

Positioning is driven by the ResMe customer-profile research (`Resume Research From Client Data/Summarized/`): flagship homepage persona is RESME-P01 (Senior Software Engineer, 19% of dataset, ~77% of customers senior+). Homepage walks the 5-step journey: I have a resume → I want this job → we tailor it → agents give actionable feedback → optional human review. Copy guardrails: no guaranteed interviews/jobs/ATS-bypass claims; transformation examples are labeled composites, never real client resumes.

A Res.Me product (sub-brand of Res.Me, Technical Resume Writing). Web repackaging of the [ai-job-search](https://github.com/Balzermw/ai-job-search-resme) Claude Code workflow.

Brand: Res.Me blue `#4373db`, green `#2dbd8b`, light gray `#eceef0`. Logo mark recreated as inline SVG in `src/components/logo.tsx` — replace with official assets in `public/` when available.

## Status

- [x] Landing page (hero before/after, auto-playing pipeline demo, pricing, trust strip)
- [ ] Auth + profile storage (Supabase)
- [ ] Stripe credit packs + ledger
- [ ] Onboarding: CV upload → profile extraction
- [ ] Apply pipeline (fit score → draft → reviewer → compile/inspect PDF)
- [ ] Watermarked preview + credit-gated download
- [ ] Application tracker
- [ ] GDPR: consent, retention, one-click erasure

## Architecture decisions

- **Pricing:** credit packs ($19/5, $49/15, $99/40), no BYOK, no subscription. One free run per new account, paywall on the PDF download (watermarked preview free).
- **Cost guardrails (required before launch):** Sonnet 4.6 as default model, reviewer capped at one research pass, PDF compile loop capped at 2 iterations. Target ≤$1.50 inference cost per run.
- **v1 scope:** no job scraping/aggregation, no upskill reports — users paste a job URL or text.
- **Backend:** Claude API vs. Managed Agents still open; Managed Agents favored because the compile-and-inspect LaTeX loop runs unchanged in a session container.

## Development

```bash
npm install
npm run dev
```

Copy `.env.example` to `.env.local` and fill in keys as integrations land.
