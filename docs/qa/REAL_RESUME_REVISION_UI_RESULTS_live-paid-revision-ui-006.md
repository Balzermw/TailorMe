# Real Resume Revision UI Results

Private corpus revision reports are anonymized. Raw filenames, resume text, parsed JSON, screenshots, and edited resume content are intentionally omitted.

- Total: 20
- Passed: 8
- Failed: 9
- Skipped: 3

| ID | Type | Category | Status | Stage | Diffs | Reviewed | Suggestions | Error |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| rr-047e2fa482d7 | pdf | uncategorized | failed | save-reload |  |  |  | rewrites 5/5, sim 0.571, coverage 1; [2mexpect([22m[31mlocator[39m[2m).[22mtoHaveAttribute[2m([22m[32mexpected[39m[2m)[22m failed  Locator: getByTestId('revision-edit-0-4') Expected: [32m"true"[39m Timeout: |
| rr-048288df0b6d | pdf | uncategorized | passed | print | 5 | 3/5 changes reviewed | 2->1 | rewrites 5/5, sim 0.353, coverage 1 |
| rr-04a05ba56ba3 | docx | uncategorized | passed | print | 5 | 3/5 changes reviewed | 2->1 | rewrites 5/5, sim 0.515, coverage 1 |
| rr-04c134e89cd9 | docx | uncategorized | failed | full-tailor | 0 |  |  | rewrites 0/1, sim 0.13, coverage 0; Paid tailoring did not produce measurable AI rewrite evidence. |
| rr-04f8b1e994c1 | pdf | uncategorized | skipped | full-tailor | 2 |  |  | rewrites 1/1, sim 0.367, coverage 2; Not enough bullet diffs to exercise accept/reject/edit (2). |
| rr-050b358e2567 | pdf | uncategorized | passed | print | 5 | 3/5 changes reviewed | 2->1 | rewrites 5/5, sim 0.676, coverage 1 |
| rr-052a1ccf1a8e | docx | uncategorized | failed | full-tailor | 0 |  |  | rewrites 0/0, sim 0.432, coverage 0; Paid tailoring did not produce measurable AI rewrite evidence. |
| rr-05bfe5a972a8 | docx | uncategorized | failed | full-tailor | 0 |  |  | rewrites 0/0, sim 0.093, coverage 0; Paid tailoring did not produce measurable AI rewrite evidence. |
| rr-05ead7d18a12 | docx | uncategorized | failed | full-tailor |  |  |  | Full tailoring failed at 500: Tailoring failed: The tailoring step returned an incomplete document. Please try again. |
| rr-06624afb9a8e | docx | uncategorized | failed | full-tailor |  |  |  | Full tailoring failed at 500: Tailoring failed: The tailoring step returned an incomplete document. Please try again. |
| rr-06650bf73937 | docx | uncategorized | passed | print | 3 | 3/3 changes reviewed | 2->1 | rewrites 1/3, sim 0.428, coverage 1 |
| rr-06fcbc463a2a | pdf | uncategorized | passed | print | 5 | 3/5 changes reviewed | 2->1 | rewrites 5/5, sim 0.486, coverage 1 |
| rr-07c3e6a32ba3 | pdf | uncategorized | failed | full-tailor | 0 |  |  | rewrites 0/0, sim 0.545, coverage 0; Paid tailoring did not produce measurable AI rewrite evidence. |
| rr-089802acb4c2 | docx | uncategorized | passed | print | 3 | 3/3 changes reviewed | 2->1 | rewrites 2/4, sim 0.445, coverage 0.75 |
| rr-089c53610bbd | docx | uncategorized | failed | full-tailor | 2 |  |  | rewrites 0/3, sim 0.359, coverage 0.667; Paid tailoring did not produce measurable AI rewrite evidence. |
| rr-08b526fbcb59 | pdf | uncategorized | passed | print | 5 | 3/5 changes reviewed | 2->1 | rewrites 2/4, sim 0.763, coverage 1.25 |
| rr-08c355393799 | pdf | uncategorized | skipped | full-tailor | 1 |  |  | rewrites 1/1, sim 0.437, coverage 1; Not enough bullet diffs to exercise accept/reject/edit (1). |
| rr-0913504720b1 | docx | uncategorized | passed | print | 5 | 3/5 changes reviewed | 2->1 | rewrites 4/5, sim 0.643, coverage 1 |
| rr-0927b56c9fac | pdf | uncategorized | skipped | parse |  |  |  | Expected unsupported-file rejection shown. |
| rr-092cef260622 | pdf | uncategorized | failed | full-tailor | 0 |  |  | rewrites 0/0, sim 0.34, coverage 0; Paid tailoring did not produce measurable AI rewrite evidence. |
