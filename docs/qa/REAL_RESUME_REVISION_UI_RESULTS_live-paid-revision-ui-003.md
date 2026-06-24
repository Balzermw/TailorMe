# Real Resume Revision UI Results

Private corpus revision reports are anonymized. Raw filenames, resume text, parsed JSON, screenshots, and edited resume content are intentionally omitted.

- Total: 5
- Passed: 3
- Failed: 1
- Skipped: 1

| ID | Type | Category | Status | Stage | Diffs | Reviewed | Suggestions | Error |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| rr-02a4a2db9f6e | docx | uncategorized | passed | print | 5 | 3/5 changes reviewed | 2->1 |  |
| rr-02afc7757002 | docx | uncategorized | skipped | full-tailor | 0 |  |  | Not enough bullet diffs to exercise accept/reject/edit (0). |
| rr-02bfdd681001 | pdf | uncategorized | passed | print | 5 | 3/5 changes reviewed | 2->1 |  |
| rr-02c353eff26a | docx | uncategorized | passed | print | 5 | 3/5 changes reviewed | 2->1 |  |
| rr-0331601c4b52 | pdf | uncategorized | failed | save-reload |  |  |  | [2mexpect([22m[31mlocator[39m[2m).[22mtoHaveAttribute[2m([22m[32mexpected[39m[2m)[22m failed  Locator: getByTestId('revision-edit-0-4') Expected: [32m"true"[39m Timeout: 10000ms Error: element(s) not found  |
