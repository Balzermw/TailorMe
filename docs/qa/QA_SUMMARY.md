# QA Summary

## Scope

This branch adds a reproducible Playwright E2E harness for ResMe/TailorMe with route inventory, control inventory, synthetic resume corpus coverage, opt-in private real-resume corpus support, diagnostics, redaction, accessibility checks, responsive checks, telemetry privacy checks, core resume workflow tests, and strict live-AI real-resume acceptance reports.

## Routes Inventoried

Run:

```bash
npm run qa:inventory:routes
```

Outputs:

- `docs/qa/route-inventory.md`
- `docs/qa/route-inventory.json`

## Controls Inventoried

Run:

```bash
npm run qa:inventory:controls
```

Outputs:

- `docs/qa/ACCEPTANCE_MATRIX.md`
- `docs/qa/acceptance-matrix.md`
- `docs/qa/acceptance-matrix.csv`
- `docs/qa/acceptance-matrix.json`

## Automated Tests Added

- Route smoke tests
- Control inventory generation
- Core upload-based resume flow
- Start-from-scratch flow
- Job targeting flow
- Ada/Max/Remy agent-review flow
- Resume editor flow
- PDF/print export flow
- Synthetic resume corpus flow
- Opt-in private real-resume corpus runner
- Negative upload/API failure cases
- Critical accessibility scans
- Responsive checks
- Telemetry privacy check

## Verification Completed

- `npm test` passed: 112 tests.
- `npm run lint` passed.
- `npx tsc --noEmit` passed.
- `npm run qa:inventory:routes` passed and inventoried 47 routes.
- `npm run qa:inventory:controls` passed and generated the acceptance matrix.
- `npm run e2e:seed` passed and prepared seven synthetic resume fixtures.
- `npm run test:e2e:smoke` passed.
- `npm run test:e2e:controls` passed.
- `npm run test:e2e:resume-corpus` passed.
- `npm run test:e2e:a11y` passed.
- `npm run test:e2e` passed across Chromium, Firefox, WebKit, mobile Chromium, and tablet projects: 275 passed, 5 skipped.
- Responsive checks passed for mobile, tablet, and desktop viewports across all Playwright projects.
- Chromium critical workflow checks passed; the unsupported-upload validation bug is now covered by a passing negative test.
- Strict paid OpenAI real-resume batches passed with live parsing required:
  - `live-paid-strict-125-135`: 10 passed, 0 failed, 0 skipped.
  - `live-paid-strict-135-145`: 10 passed, 0 failed, 0 skipped.
  - `live-paid-strict-v2-145-155`: 10 passed, 0 failed, 0 skipped, minimum quality score 85.
  - `live-paid-strict-v2-155-165`: 10 passed, 0 failed, 0 skipped, minimum quality score 85.
  - `live-paid-strict-v2-165-175`: 10 passed, 0 failed, 0 skipped, minimum quality score 85.
- Current strict paid OpenAI total: 50 passed, 0 failed, 0 skipped.

## Bugs And Quality Findings

- Fixed in this branch: `QA-P1-001`, `/api/parse-resume` now rejects unsupported extensions server-side before parsing.
- Fixed in this branch: the homepage had tablet-width horizontal overflow from the hero/report preview and agent-card grid. The landing CSS now collapses those sections earlier and constrains grid children.
- Parser quality caveat: the table-heavy Markdown synthetic resume parses without crashing, but the candidate name is lost and the UI falls back to `Your resume`.
- Fixed in this branch: `metadataBase` is set from `NEXT_PUBLIC_APP_URL`, so social metadata does not fall back to localhost when the production URL is configured.
- Strict v2 quality scoring caps free-audit results at 88 when the audit gives concrete fix guidance but not a full before/after rewrite pair. This is expected because full rewrite examples are reserved for the paid tailoring flow.

## Manual Areas Remaining

- Full subjective quality review of more live AI output outside the strict 125-175 corpus window
- Production auth/Supabase flows with seeded test accounts
- Stripe Checkout in a real Stripe test account
- PDF visual comparison when a safe compile service is available
- Large private corpus execution and triage

## Privacy Safeguards

- Live AI disabled by default.
- Real-resume corpus disabled by default.
- Real resumes loaded only from `REAL_RESUME_CORPUS_DIR`.
- Real-resume screenshots/videos/traces disabled by default.
- Real-resume reports use anonymized IDs.
- Strict live-AI reports commit only anonymized aggregate rows and quality signals, not raw resume text, parsed JSON, filenames, local paths, screenshots, videos, or traces.
- Diagnostics redact email, phone, LinkedIn URLs, local paths, secrets, long resume-like text, and raw payloads.
- Telemetry requests are intercepted in tests and checked for PII patterns.

## Current Known Gaps

- The branch adds the harness and representative tests. The strict paid OpenAI run currently covers 50 private real resumes from the 125-175 batch window; earlier windows include local/fallback and pre-v2 quality runs. Remaining corpus windows should continue in 10-file paid batches.
- Real auth and payment paths require explicit safe test credentials.
- DOCX/PDF parser coverage uses generated synthetic files; additional malformed/password-protected/image-only files remain backlog items.
- Concurrent independent Playwright commands can collide on `next build`; run one Playwright command at a time, or run one full Playwright invocation that owns its web server.
- The full E2E suite intentionally skips the control-inventory writer outside desktop Chromium and skips the desktop Pricing nav-link assertion on the phone project because those controls are not visible in the phone nav.

## Recommended Next QA Branch

After this branch lands, create a focused bug-fix branch for failures discovered by the first full private-corpus run, with artifacts kept local and bugs filed from `docs/qa/BUG_REPORT.md`.
