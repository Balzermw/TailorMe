# Result Quality Checks

## Automated For Synthetic Fixtures

- Candidate name is preserved when the source contains one.
- At least one role title is preserved.
- At least one employer is preserved.
- Critical skills from fixture metadata appear in output.
- Education is preserved when fixture metadata includes it.
- Output is non-empty.
- Placeholder/debug content is rejected: `Lorem ipsum`, `[Company]`, `[Date]`, `TBD`, `undefined`, `null`, `NaN`, `TODO`, `Error`, raw JSON, and internal agent/debug text.

Current caveat: the table-heavy Markdown fixture parses without crashing, but the candidate name is not recovered. Treat this as a parser quality backlog item before using table-heavy fixtures as strict identity-preservation gates.

## Automated For Real-Resume Corpus

- The app does not crash.
- Individual file failures do not stop the batch.
- Parse success/failure is reported by anonymized ID.
- Raw filenames, file paths, resume text, parsed JSON, and screenshots are omitted by default.
- Telemetry payloads are checked for obvious PII patterns.
- Strict live mode sets `REQUIRE_LIVE_AI_PARSE=1`, so a paid OpenAI run fails fast instead of silently falling back to local parsing.
- Strict v2 quality requires all three agent sections, actionable guidance, role-specific target keyword coverage, gap specificity, resume-grounded language, metric guidance, section coverage, a concrete fix example, low boilerplate, no placeholder/debug text, no PII, and low similarity to prior outputs in the same batch.
- The default strict v2 minimum quality score is 85.
- Free-audit results that provide concrete fix guidance but no full before/after rewrite pair are capped at 88 because the full rewrite pair is a paid-tailoring artifact.
- Results below the configured minimum score are marked with `quality_score_below_min` even when no single named content issue fires.

## Manual/Follow-Up

- Subjective AI quality remains partly manual unless a deterministic mock fixture defines exact expectations.
- Live AI mode should create QA reports and fail on structure, privacy, hallucination-like placeholders/debug leaks, excessive templating, or below-min quality scores.
- PDF/DOCX visual formatting should be reviewed on representative successful exports after a compiler/export environment is available.
