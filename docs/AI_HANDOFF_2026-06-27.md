# TailorMe — AI session handoff (2026-06-27)

Handoff for the next Claude Code session on **TailorMe by Res.Me** — a resume-tailoring
SaaS. Read `CLAUDE.md` (durable rules) and `AGENTS.md` (Next.js 16 warning) FIRST, then this.
The previous full handoff is `docs/AI_HANDOFF_2026-06-22.md` — still useful for the rules
engine, telemetry, pricing, and architecture sections that haven't changed.

---

## 1. Repo state

- **Project root:** `C:\Users\rubbe\tailorcv`
- **App name (package.json):** `applyforme` — product/brand is **TailorMe by Res.Me**.
- **Stack:** Next.js 16 (App Router, Turbopack dev) · React 19 · TypeScript 5 · Tailwind v4 ·
  Supabase (auth + Postgres + RLS) · Stripe Checkout · OpenAI / Anthropic.
- **`main` is current:** PR [#3](https://github.com/Balzermw/TailorMe/pull/3) was **merged
  into `main`** on 2026-06-27 (merge commit on GitHub; squashed work = commit `d15ebcf`
  "Tailoring reliability, resume-parsing, and dashboard/audit/editor polish").
- **Local checkout:** still on branch `codex/dashboardprep` (the merged branch, left in
  place, not deleted). **Local refs are stale** — run `git fetch origin && git checkout main
  && git pull` to sync; `main` now contains everything below.
- **Working tree at handoff:** this handoff file is the only uncommitted change.

### Build / test / lint status (verified 2026-06-27, all green)

| Check | Command | Result |
|---|---|---|
| Typecheck | `npx tsc --noEmit` | ✅ exit 0 |
| Lint | `npm run lint` | ✅ exit 0 |
| Unit tests | `npx vitest run` | ✅ **150 passed / 150**, 21 files |
| Deploy | Vercel preview on PR #3 | ✅ Ready |

(Note: `npm run build` was NOT re-run this session — tsc/lint/vitest + Vercel preview were
the gates. Run a prod build if you touch build-time config.)

---

## 2. What changed this session (all now on `main`)

This session shipped on top of the large `codex/dashboardprep` branch (dashboard/audit/editor
polish + QA scaffolding that was already in the working tree). My verified contributions:

### Reliability
- **Tailoring no longer dead-ends on short resumes.** `runFull` (`src/lib/apply/pipeline.ts`)
  used to `throw` whenever fewer than `MIN_EDITOR_REWRITE_DIFFS` (3) verified before/after
  rewrites survived — so short / student resumes could *never* tailor, and the retry pressured
  the model to fabricate rewrites. It now **ships the draft whenever it genuinely differs from
  the source AND carries ≥1 verified change**; it only hard-fails when tailoring did
  effectively nothing (draft ≈ source, or 0 tracked diffs). It also skips the risky retry once
  a short resume is already tailored. The existing "0 rewrites → throw" test still passes.
- **Tailoring loader bar freeze fixed** (`src/app/applications/tailoring/tailoring-runner.tsx`).
  The progress ticker lived inside the run-once (StrictMode-guarded) effect, so React dev's
  mount→cleanup→mount cycle cleared the interval and the guard blocked re-creating it — the bar
  froze at 12% while the request ran. Moved the ticker to its **own** effect.

### Resume parsing — letter-spacing collapse (`src/lib/apply/parse.ts`)
- Styled templates letter-space names/headers; extraction surfaced `"M D M O N I R"`,
  `"S O F T W A R E   E N G I N E E R"`, `"J E S S I C A   H E D S T R O M"`.
- **PDF:** `despaceRun()` collapses a run whose text is entirely single letters (`"M O N I R"`)
  — word breaks live *between* runs (a standalone space run or x-gap), so collapsing within a
  run never merges words. Applied inside `columnToText`.
- **DOCX / .doc:** `collapseLetterSpacing()` post-pass on the extracted text; splits on wide
  (2+ space) gaps to preserve word boundaries, then drops inter-letter spaces.
- Applied at all `extractText` return paths. **+5 unit tests** in `parse.test.ts`.

### Audit summary (`src/app/audit/audit-wizard.tsx`, `StepSummary`)
- Verdict card now leads with the **final fit score** (`NN / 100` + tier pill via `fitTheme`).
- "What's strong" shows a **shortened real example** of an already-quantified bullet
  (`stats.sampleBullets.find(hasMetric)`, clipped to ~110 chars).

### Editor (`src/app/applications/[id]/edit/edit-editor.tsx` + `edit.css`)
- The experience **"Present" date toggle** is now a stable checkbox on its own row below the
  date inputs (no position shift); the end field swaps to a fixed-width mint "Present" chip.
  (This built on earlier in-session work: AI-tailored badge moved right, cover-letter review
  modal, review-progress icons.)

---

## 3. End-to-end QA done this session (7 real resumes)

Drove **7 real candidate resumes** (PII — `~/Downloads`, **never committed**) through the real
server pipeline (`/api/parse-resume` → `/api/apply` audit + full). All formats handled:
`.docx`, legacy `.doc` (word-extractor), `.pdf` (unpdf + positioned-run reconstruction).

| Resume | Format | Parse | Fit | Agents | Full tailor | Final name |
|---|---|:--:|:--:|:--:|:--:|---|
| Byron Kilbourne | docx | ✓ | 74 | 3 | ✓ 5 diffs | Byron F Kilbourne |
| Miguel Lara Chavez | docx | ✓ | 58 | 3 | ✓ 6 diffs | Miguel Lara Chavez |
| m_lampman | docx | ✓ | 52 | 3 | ✓ **2 diffs** | Candidate Name\* |
| Jessica Hedstrom | docx | ✓ | 80 | 3 | ✓ 5 diffs | Jessica Hedstrom |
| Jason Hanlon | **.doc** | ✓ | 67 | 3 | ✓ 6 diffs | Jason Hanlon |
| MD MONIR | **.pdf** | ✓ | 72 | 3 | ✓ 6 diffs | MD Monir |
| Kabir Ghai | **.pdf** | ✓ | 65 | 3 | ✓ 8 diffs | Kabir Ghai |

**Zero tailoring failures.** m_lampman delivered with only 2 diffs — proof the reliability fix
works on a real resume that would have hard-failed before. Confirmed upload→edit→maintain
end-to-end in the browser for MD MONIR (worst-case PDF; editor renders "MD Monir", editable).

\* m_lampman's file literally contains the placeholder text "CANDIDATE NAME" (never filled in).

QA harnesses live in the session scratchpad (NOT in the repo):
`…\scratchpad\parse-harness.mjs`, `phase2-harness.mjs` — run with the dev server up on :3000.

---

## 4. Open follow-ups / known issues (not addressed — candidates for next session)

1. **`verify: "unavailable"` on some full runs** (Jessica, Jason, MD MONIR) — the faithfulness
   verification step returned `unavailable` while others got `clean`/`corrected`. Likely
   dev cheap-model flakiness (`LLM_PROVIDER=openai` + cheap models in `.env.local`), not a
   delivery blocker. Worth confirming it's consistent in prod / investigating `verifyDoc`.
2. **Contact parsing edge:** MD MONIR's pipe-separated contact line (`… | United States |
   U.S. Citizen | LinkedIn`) put "United States, U.S. Citizen" into the city/state field.
   Cosmetic, editable. Contact parsing lives in `src/lib/apply/contact.ts`.
3. **Placeholder-name detection:** a resume with an unfilled "CANDIDATE NAME" placeholder
   sails through silently. Could surface a gentle "looks like a template placeholder" hint.
4. **DOCX header/textbox duplicate:** the de-duped header-extra still emits a uniform-collapsed
   copy (e.g. `"JESSICAHEDSTROM"`) ahead of the clean body line — cosmetic noise the LLM
   dedupes; left as-is. See the `extra` block in `extractText`.
5. **Loader latency is still real** — the bar now *moves*, but the premium-LLM full run is
   several sequential calls. If "feels long" recurs, trimming a pipeline stage is the lever.

---

## 5. Files touched this session (for quick orientation)

- `src/lib/apply/pipeline.ts` — `runFull` quality-gate → soft-deliver logic.
- `src/lib/apply/parse.ts` — `despaceRun`, `collapseLetterSpacing`, wired into `extractText`.
- `src/lib/apply/parse.test.ts` — +5 letter-spacing tests (14 total in file).
- `src/app/applications/tailoring/tailoring-runner.tsx` — ticker moved to own effect.
- `src/app/audit/audit-wizard.tsx` — verdict score + strong-bullet example in `StepSummary`.
- `src/app/applications/[id]/edit/edit-editor.tsx` + `edit.css` — DateRange "Present" redesign.
- `.gitignore` — added `.codex-*.log` / `.codex-net-probe.txt` (transient dev artifacts).

---

## 6. Instructions every future session MUST follow

- **Read `CLAUDE.md` + `AGENTS.md` first.** Next.js 16 differs from training data — read
  `node_modules/next/dist/docs/` before framework code.
- **Verify before "done":** `npx tsc --noEmit` + `npm run lint` + `npx vitest run`. Use the
  **`preview_*` tools** (not Bash, not Chrome MCP) for anything visible in the browser.
- **PII:** the real resumes under `~/Downloads` are PII — **never commit them**; keep test
  harnesses in the scratchpad. Telemetry privacy invariant still holds (no résumé/PII content).
- **Git:** do NOT push `main` directly; work on a feature branch and only commit/push/merge
  when the user asks. Migrations are applied by the USER in Supabase (no-op in demo mode).
- **No em dashes in user-facing copy.** Turbopack serves stale `globals.css` after edits —
  stop preview, `rm -rf .next`, restart (component CSS HMRs fine).
- **Demo/anonymous mode is first-class:** keys absent → simulated (Supabase→localStorage,
  Stripe→demo, LLM→pipeline still runs on cheap models in dev). Don't add auth gates to the
  scratch/audit funnel.
