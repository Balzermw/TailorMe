# QA Test Environment

## Runtime

- Local Node: `v24.13.0`
- Local npm: `11.6.2`
- Package manager: npm, using `package-lock.json`
- Next.js: `16.2.9`
- React: `19.2.4`

The repo does not define an `engines` field. Use Node 20+ at minimum; this machine is currently running Node 24.

## Install

```bash
npm install
npx playwright install
```

## Boot Locally

```bash
npm run dev
```

The E2E suite starts the app automatically through Playwright `webServer`.
It owns port `3100` by default. Stop any existing process on that port before running E2E, or set both `E2E_BASE_URL` and `E2E_WEB_SERVER_COMMAND` for a different local port.

## Unit Tests

```bash
npm test
npm run rules:validate
npm run rules:test
```

## E2E Tests

```bash
npm run test:e2e
npm run test:e2e:smoke
npm run test:e2e:routes
npm run test:e2e:controls
npm run test:e2e:resume-corpus
npm run test:e2e:a11y
```

The normal E2E scripts force safe demo/test behavior by overriding local AI, Supabase, Stripe, and LaTeX env vars to blank values. This prevents accidental live provider calls or writes to live data.

## Environment Variables

Safe test values are in `.env.e2e.example`.

Never commit:

- `.env.local`
- `.env.e2e.local`
- service role keys
- AI provider keys
- Stripe secrets
- real resume corpus files

E2E defaults:

- `E2E_TEST_MODE=1`
- `RUN_LIVE_AI_E2E=0`
- `RUN_REAL_RESUME_CORPUS=0`
- `CAPTURE_REAL_RESUME_SCREENSHOTS=0`
- `RATE_LIMIT_DISABLED=1`
- `CREDITS_DISABLED=1`

## Data Seeding And Reset

Prepare synthetic fixtures:

```bash
npm run e2e:seed
```

Remove local Playwright/result artifacts:

```bash
npm run e2e:reset
```

Synthetic runtime fixtures are generated under `tests/e2e/fixtures/resumes/` from `tests/e2e/helpers/fixtures.ts`. Private real resumes are never copied into the repo.

## Supabase/Auth

Supabase is optional. Default E2E blanks `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`, so the app runs in demo/localStorage mode. Auth-required flows should be tested separately with explicit local credentials and non-production data.

## Stripe/Payments

Stripe is optional. Default E2E blanks Stripe secrets. Checkout/payment-like flows should be mocked or verified as navigation/error handling unless an explicit live payment QA environment is provided.

## AI Calls

AI calls are mocked or forced into app demo behavior by default. Live AI testing must opt in:

```bash
RUN_LIVE_AI_E2E=1 npm run test:e2e -- --grep @live-ai
```

Do not send real resumes to live AI providers without explicit approval.

Strict live real-resume runs should also require live parsing:

```powershell
$env:RUN_LIVE_AI_E2E="1"
$env:RUN_REAL_RESUME_CORPUS="1"
$env:REQUIRE_LIVE_AI_PARSE="1"
$env:REAL_RESUME_MIN_QUALITY_SCORE="85"
$env:REAL_RESUME_BATCH_START="175"
$env:REAL_RESUME_BATCH_LIMIT="10"
$env:REAL_RESUME_REPORT_SUFFIX="live-paid-strict-v2-175-185"
npx.cmd playwright test --project=chromium tests/e2e/specs/real-resume-corpus.spec.ts --grep "@real-corpus"
```

## Real Resume Corpus

Real corpus tests are opt-in only:

```bash
$env:RUN_REAL_RESUME_CORPUS="1"
$env:REAL_RESUME_CORPUS_DIR="C:\path\to\private\resume-corpus"
npm run test:e2e:real-corpus
```

Batching:

```bash
$env:REAL_RESUME_BATCH_START="0"
$env:REAL_RESUME_BATCH_LIMIT="50"
npm run test:e2e:real-corpus
```

Filters:

```bash
$env:REAL_RESUME_FILTER_TYPE="pdf"
$env:REAL_RESUME_FILTER_CATEGORY="multi-column"
npm run test:e2e:real-corpus
```

## Sensitive Artifacts

These may contain sensitive data if real-resume mode is enabled and should remain local:

- `test-results/`
- `playwright-report/`
- `tests/e2e/results/`
- traces, videos, screenshots

Real-resume screenshots/videos/traces are disabled by default. Reports use anonymized IDs and omit raw filenames, file paths, parsed text, and generated resume text.
Commit only the anonymized Markdown reports under `docs/qa/`; keep `tests/e2e/results/` JSON local.
