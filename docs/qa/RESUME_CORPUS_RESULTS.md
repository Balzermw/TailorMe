# Synthetic Resume Corpus Results

Run:

```bash
npm run test:e2e:resume-corpus
```

Current committed harness generates at least five synthetic resumes covering:

- ATS-style plain resume
- Long platform-engineering resume
- Short career-switcher resume
- Table-heavy Markdown resume
- Heavily formatted/contact-rich text resume
- Runtime-generated DOCX
- Runtime-generated PDF

Results are produced by Playwright in `test-results/` and summarized in the HTML report.

Current status:

- `npm run test:e2e:resume-corpus` passed against the committed synthetic corpus.
- The table-heavy Markdown fixture uncovered a parser quality limitation: it is stable and completes, but the candidate name is not recovered and the app displays `Your resume`.
- Real resume corpus testing remains opt-in and was not run on this branch without a private `REAL_RESUME_CORPUS_DIR`.
