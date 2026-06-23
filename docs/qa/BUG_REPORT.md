# Bug Report Template

Bug ID:

Title:

Severity:

Priority:

Status:

Environment:

Browser:

Viewport:

Route:

Affected control:

Test file:

Synthetic fixture or real-resume anonymized ID:

Reproduction steps:

Expected result:

Actual result:

Screenshots/videos/traces:

Console errors:

Network errors:

Server logs:

Suspected files:

User impact:

Privacy impact:

Regression risk:

Suggested fix:

Retest steps:

## Active Findings

No active P1 findings after the unsupported-extension upload fix.

## Resolved In This Branch

### QA-P1-001

Bug ID: QA-P1-001

Title: `/api/parse-resume` accepts unsupported extensions when bytes decode as text

Severity: P1 / Critical

Priority: P1

Status: Fixed in this branch

Environment: local Playwright E2E, `E2E_TEST_MODE=1`

Browser: Chromium/API request

Route: `/api/parse-resume`

Test file: `tests/e2e/specs/negative-edge-cases.spec.ts`

Synthetic fixture or real-resume anonymized ID: generated `.exe` text fixture

Reproduction steps:

1. Submit a multipart upload directly to `/api/parse-resume` with filename `resume.exe`.
2. Use text bytes that look like a resume.

Expected result: API rejects the request with a 4xx unsupported file type response.

Actual result before fix: API parsed the text content successfully.

User impact: direct API clients can bypass browser file-picker extension filtering.

Privacy impact: no leak observed, but server-side validation is weaker than UI validation.

Fix applied: validate allowed filename extensions in `/api/parse-resume` before parser dispatch.

Retest steps: run `npx playwright test --project=chromium tests/e2e/specs/negative-edge-cases.spec.ts --grep "unsupported resume file"`.

### QA-P2-002

Bug ID: QA-P2-002

Title: Homepage overflows horizontally at tablet viewport width

Severity: P2 / Major

Priority: P2

Status: Fixed in this branch

Environment: local Playwright E2E, `E2E_TEST_MODE=1`

Browser: Chromium, Firefox, WebKit, mobile Chromium tablet viewport

Viewport: 768 x 1024

Route: `/`

Test file: `tests/e2e/specs/responsive.spec.ts`

Expected result: document horizontal overflow is no more than 16px.

Actual result before fix: homepage produced roughly 300px of horizontal overflow at tablet width.

Suspected files: `src/app/globals.css`

Suggested fix applied: collapse the homepage hero and agent-card grid earlier, use `minmax(0, 1fr)`, and constrain card children from forcing grid overflow.

Retest steps: `npx playwright test --grep "@responsive"` and `npm run test:e2e` both pass.

### QA-P1-003

Bug ID: QA-P1-003

Title: Live-AI E2E could silently pass with local parser fallback

Severity: P1 / Critical

Priority: P1

Status: Fixed in this branch

Environment: strict live real-resume E2E, `RUN_LIVE_AI_E2E=1`

Route: `/api/parse-resume`

Test file: `tests/e2e/specs/real-resume-corpus.spec.ts`

Expected result: live paid runs fail when the configured AI provider cannot parse the resume.

Actual result before fix: local fallback parsing could produce a successful UI path even when the live provider was unreachable.

Suggested fix applied: `REQUIRE_LIVE_AI_PARSE=1` makes `/api/parse-resume` return a controlled 502 if live AI parsing fails.

Retest steps: strict paid batches `125-135`, `135-145`, `145-155`, `155-165`, and `165-175` passed from a network-enabled PowerShell session; sandboxed no-network runs fail cleanly at parse.

### QA-P1-004

Bug ID: QA-P1-004

Title: Audit output could expose contact details from uploaded resumes

Severity: P1 / Critical

Priority: P1

Status: Fixed in this branch

Environment: real-resume audit flow

Affected control: agent-audit output

Expected result: public audit output omits names, emails, phones, street addresses, LinkedIn URLs, and raw contact lines.

Actual result before fix: early strict quality batches flagged possible PII in review text.

Suggested fix applied: public audit and parser outputs now redact contact details and filter contact-like fallback evidence lines.

Retest steps: strict paid live batches report no `possible_pii_in_review_text` issues.

### QA-P2-005

Bug ID: QA-P2-005

Title: Oversized resume uploads did not fail early enough

Severity: P2 / Major

Priority: P2

Status: Fixed in this branch

Environment: resume upload flow

Affected control: resume file input

Expected result: oversized uploads show a readable max-size error before attempting a full parse.

Actual result before fix: oversized real files could wait for parse/network handling before producing an error.

Suggested fix applied: client-side upload guard rejects files over 8 MB, and Next proxy body size was raised so bypassed uploads receive a controlled application error.

Retest steps: `tests/e2e/specs/negative-edge-cases.spec.ts` verifies oversized files are rejected before upload request.

## Severity Definitions

- P0 / Blocker: core flow cannot complete, data loss, security/privacy leak, real resume content committed, secrets leak, or common action crashes the app.
- P1 / Critical: upload/generation/export/payment broken, severe accessibility blocker, common PDF/DOCX parsing failure, infinite loading, or real-resume artifact written to a public/shared report.
- P2 / Major: important control broken with workaround, bad validation, significant formatting issue, incomplete agent result, partial parser issues.
- P3 / Minor: copy issue, small layout issue, weak loading state, non-blocking UX issue, readable but weak error.
- P4 / Polish: cosmetic improvement.
