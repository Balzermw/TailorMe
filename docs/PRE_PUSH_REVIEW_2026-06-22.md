# Pre-push self-review — `ui-review-polish` (2026-06-22)

Companion to `docs/AI_HANDOFF_2026-06-22.md` (task #5). This is the final review of the
**18 commits ahead of `origin/ui-review-polish`** before they're pushed + opened as a PR.

## Verdict: ✅ APPROVED to push — no blockers

No secrets, no PII, no telemetry privacy violations, no debug leftovers in app code, no
conflict markers, migrations are RLS-correct, admin routes are gated. tsc / lint / tests /
build are all green. Three **minor, non-blocking** follow-ups noted at the bottom.

## Scope reviewed

- **Range:** `origin/ui-review-polish..HEAD` = commits `65ac9d7` → `b9e363c` (18 commits).
- **Size:** 73 files, **+7,089 / −668**.
- **Content:** telemetry redesign + AI-run instrumentation, SECURITY DEFINER hardening, AI
  cost doc, pricing refresh + checkout add-ons + `orders` table, `/admin/orders` view,
  code-review fixes, the resume-rules engine (foundation → deterministic eval → wire-in →
  safe telemetry), the dashboard rebuild, and the handoff docs.

## What was checked, and the result

| Area | How it was checked | Result |
|---|---|---|
| **Secrets in diff** | grep added lines for `sk-…`, `sk_live/test`, `whsec_`, `eyJ…` (JWT), `AKIA…`, PEM headers | ✅ none |
| **Sensitive files** | `--name-only` filter for `.env`, `/Downloads/`, `*.docx/*.pdf`, `store.json` | ✅ none staged |
| **Debug/dead code** | grep added `src` lines for `console.log/debug`, `debugger`, `.only(`, `fdescribe`, `@ts-ignore/nocheck`, `eslint-disable`, `FIXME/XXX` | ✅ the only 2 `console.log`s are in **test files** (`ruleLab.test.ts`, `rulesValidate.test.ts`) — intentional Rule Lab output |
| **Telemetry privacy invariant** | grep every added `track()` call + scan for `resumeText/jobText/evidence/snippet/summary/bullet` in event payloads | ✅ all `track()` payloads are safe primitives (counts, ids, location, device, choice). The feedback `stats: funnel` is counts-only. `evidenceSnippet` flows **only** into `proofPoints` returned to the user's own editor — never into telemetry |
| **Admin gating** | read `lib/admin.ts`, `api/admin/rule-lab`, `api/admin/orders/[id]` | ✅ email allowlist, empty = nobody (safe default), server-side re-check on every route; rule-lab open only in dev; order id validated as positive integer (the earlier NaN bug is fixed) |
| **Migrations 0006/0007** | read both | ✅ `orders` has RLS on, own-row SELECT only, writes are service-role-only; CHECK uses idempotent drop-then-add; 0007's name set is a strict superset of 0006's; no résumé/job content stored |
| **Conflict markers** | grep added lines for `<<<<<<< / ======= / >>>>>>>` | ✅ none |
| **Oversized/accidental files** | `--numstat` sorted | ✅ largest is the intended 2,159-line vendored `resme_master_rules.json` |
| **tsc / lint / tests / build** | ran all four at HEAD−1 (`d568b3f`); HEAD adds docs only | ✅ tsc 0 · lint 0 · **103/103 tests** · `next build` exit 0 |

## Minor, non-blocking follow-ups

1. **Stale `TODO` comment in `supabase/migrations/0006_pricing.sql` (lines 21–22).** It says
   "TODO: build an admin view that lists orders where (expert_feedback or human_revision) and
   fulfillment_status='pending'." — but commit `e4fed57` already built exactly that
   (`/admin/orders`). The migration is **not yet applied**, so the comment can be safely
   corrected. Cosmetic only. **(Resolved in this review — comment corrected.)**
2. **Cached feedback path omits funnel `stats`.** `api/resume/feedback/route.ts:114` returns
   `{ proofPoints, cached: true }` with no `stats`, so repeat (cache-hit) views don't fire
   `resume_feedback_suggestions_surfaced` with real counts. Result: that event under-reports on
   repeat views. Not a bug; fix only if surfaced-rate accuracy matters.
3. **Detector coverage is partial (≈13/79 rules).** Already documented in the handoff §10 #3 —
   noted here so the reviewer doesn't read it as a diff defect.

## Push checklist (for the rooted tailorcv session)

- [ ] `git push -u origin ui-review-polish` (only after the user green-lights — handoff rule).
- [ ] Open the PR; paste this verdict + the handoff §2 summary as the description.
- [ ] **Migrations are NOT applied by pushing.** At deploy time the user must run `0006` + `0007`
      in Supabase, set `ADMIN_EMAILS`, and toggle leaked-password protection (handoff §5/§10 #1).
- [x] Follow-up #1 (one-line comment fix in `0006`) applied in this review.
