# TailorMe — AI session handoff (2026-06-22)

Handoff for the next Claude Code session on **TailorMe by Res.Me** — a resume-tailoring
SaaS. This captures repo state, decisions, and what to do next so a fresh session can
pick up cold. Read `CLAUDE.md` (durable rules) first, then this.

---

## 1. Repo state

- **Project root:** `C:\Users\rubbe\tailorcv`
- **App name (package.json):** `applyforme` — product/brand is **TailorMe by Res.Me**.
- **Stack:** Next.js **16.2.9** (App Router, Turbopack dev) · React **19.2.4** · TypeScript 5 ·
  Tailwind v4 · Supabase (auth + Postgres + RLS) · Stripe Checkout · OpenAI / Anthropic.
- **Current branch:** `ui-review-polish`
- **Working tree:** clean (nothing staged/unstaged).
- **Sync state:** **17 commits AHEAD of `origin/ui-review-polish` — NOT pushed.** A push +
  PR is a deliberate pending decision (see §10), not an oversight.
- **HEAD:** `d568b3f` — "Shrink dashboard header buttons to --sm to match the other buttons".

### Build / test / lint status (verified 2026-06-22, all green)

| Check | Command | Result |
|---|---|---|
| Typecheck | `npx tsc --noEmit` | ✅ exit 0, no errors |
| Lint | `npm run lint` | ✅ exit 0, no warnings |
| Unit tests | `npm test` (vitest) | ✅ **103 passed / 103**, 17 files |
| Prod build | `npm run build` | ✅ exit 0, all routes compiled |

**No known failing tests or build errors.** See §8 for runtime/known-issue notes.

---

## 2. What changed in the last ~2 weeks

The repo went from "initial pages" to a working two-path product with telemetry, pricing,
and a rules engine. Major workstreams, newest first:

**Dashboard rebuild to the handoff mockup** (`20effef`, `575df16`, `ccd573c`, `f26604c`, `d568b3f`)
- Replaced stage-progress rings with **score bars** + inline status. Resumes build
  dynamically while the user waits, so the only "waiting" UI is the Michael (human) handoff.
- Added gear icon by Settings, pen by Edit; base-resume hub card; filter pills + sort.
- Matched the mockup's extracted `tm-dash.css` value-by-value (layout ratio, base-resume
  card, header). Header buttons shrunk to `tm-btn--sm` (39px) to match the other buttons.
- Fixed an invisible score-bar fill (`display:block` + `min-width`) and made the tailoring
  progress bar **crawl asymptotically to ~92%** instead of freezing at the last step.

**Resume-rules engine** (`d06846d`, `96c5a3b`, `d82589a`, `065339d`, `2a99786`) — see §3.
- JSON-driven rule catalog (79 Grok rules) → canonical model → findings → dedupe → rank →
  cap → UI. Deterministic-only (zero new LLM). Wired live into `/api/resume/feedback`.
- Safe, content-free funnel telemetry + a `/api/admin/rule-lab` debug route.

**Pricing refresh + admin fulfillment** (`1d74d11`, `e4fed57`, `adf1769`)
- New plans (Starter $29/5, Job Hunt $69/15, Campaign $129/35) + human add-ons (Expert
  Feedback +$79, Human Revision +$149, white-glove $225+). Central config in `lib/packs.ts`.
- Checkout add-ons, `orders` table + metadata, `/admin/orders` view, code-review fixes.

**Telemetry foundation** (`b86b721`, `65ac9d7`, `a899673`, `d127186`, `156bb73`)
- `product_events` (client UI events via `track()` → `/api/events`, allowlist + DB CHECK +
  sanitize) and `ai_runs` (server cost/cache via `withAiRun`/`logCachedRun`).
- Hardened SECURITY DEFINER functions (linter 0028/0029). AI cost model doc.

**Resume editor + two-path workflow** (the M1–M3 + gaps run: `cbcffe6`…`d628203`, plus the
editor/template commits `eaf3c82`…`93679e8`)
- Build-from-scratch path (`/resume/new`), base-resume editor (`/resume/edit`), paste-import
  (`/resume/import`), "Target a job" from a base resume, dashboard hub grouping versions.
- Reusable `EditEditor`, résumé template engine (classic/modern styles + picker), "Review my
  edits" AI pass, Projects + Certifications sections, content-hash feedback caching.

**Earlier foundation** (`7768aec`…`c7db7fa`): real Supabase/Stripe/LLM integrations, AI resume
parse, posting URL scraping (SSRF-safe), 2-page clamp, model tiering, abuse guardrails,
faithfulness verification, doctrine grounding, security/trust pages, Calendly booking.

Diff over the window: **~16,000 insertions across ~160 files.**

---

## 3. Architecture & product decisions (the ones that constrain future work)

1. **One normalized resume shape: `TailoredDoc`.** Both paths (upload + build-from-scratch)
   converge on it. `resumes` table = base-resume store (`doc jsonb` + `source`);
   `applications` = tailored-version store (`result.doc`, `resume_id` links to base).
   We **reused/extended the existing model** rather than the spec's separate
   ResumeProfile/ResumeVersion/JobTarget tables.

2. **Demo mode is first-class.** Any service whose keys are absent runs simulated:
   Supabase→localStorage mock, Stripe→demo success animation, LLM→simulated pipeline. The
   **anonymous funnel must keep working** — don't add auth/Supabase gates to scratch/audit
   paths, and don't assume a DB row exists.

3. **Telemetry privacy invariant (non-negotiable):** telemetry NEVER stores résumé content,
   job-description text, PII, or evidence snippets — only counts, ids, categories, and safe
   primitives. Enforced three ways: client `ALLOWED_EVENTS` allowlist + `sanitizeProps`
   (`lib/telemetry-events.ts`), a Postgres CHECK constraint on `product_events`, and
   service-role-only writes (`lib/supabase/admin.ts` `getServiceSupabase`).

4. **A rule is NOT automatically a customer suggestion.** The rules engine has 79 internal
   rules but surfaces a focused, capped set (free ≤5, paid ≤10, ≤2/category, ≤3 formatting,
   min confidence 0.6). Caps live in `resumeFeedbackConfig.ts`.

5. **The existing feedback is LLM-generated, not a static list.** `parseResume` emits
   `ProofPoint[]` + three agents (Ada/Max/Remy). So the Grok rules became the canonical
   **catalog**, and legacy LLM findings are tagged with `canonicalIssueId` (= Grok `rule_id`)
   so they **dedupe** against rule-derived findings instead of double-surfacing.

6. **`templated` flag.** For docs rendered with our own template, the engine drops
   TEMPLATE_OWNED categories (formatting/ats/readability) — the template owns those, so
   flagging them is a false positive. Mirrors `parseResume`'s flag. The upload-parse path
   keeps those findings (genuine there).

7. **Deterministic-first.** The whole rules pipeline runs with **zero new LLM calls**; a
   bounded, cached LLM pass for subjective rules is config-flagged and **not yet built**.

8. **Pricing single-source-of-truth = `lib/packs.ts`.** Checkout uses Stripe Price IDs from
   env when set, else inline `price_data`. Do not hardcode prices elsewhere.

9. **Model tiering for cost.** Cheap model (`gpt-4.1-mini`) for free/internal score + review
   steps; stronger model for quality-sensitive tailoring. ~85% of AI cost is the free funnel
   (a score step fires per visitor) — the biggest lever is the score-step model.

---

## 4. Files & directories that matter

**Rules engine — `src/lib/resume-rules/`**
- `data/resme_master_rules.json` (79 rules) + `data/resume_ui_feedback.json` (output reference).
- `resumeAdviceRule.types.ts` — canonical types (`ResumeAdviceRule`, `ResumeRuleFinding`, `ResumeUiFeedback`).
- `grokResumeRule.schema.ts` — hand-rolled validator (no zod in repo).
- `normalizeGrokResumeRule.ts` — Grok→canonical (category/agent maps; `canonicalIssueId=rule_id`).
- `loadGrokResumeRules.ts` (memoized) · `stableId.ts` (FNV-1a) · `resumeFeedbackConfig.ts` (caps/flags).
- `extractLatexResumeSections.ts` (deLatex KEEPS brace content) · `evaluateLatexResumeRules.ts` (13 detectors).
- `legacyCriteriaAdapter.ts` (ProofPoint→canonicalIssueId) · `dedupeResumeFindings.ts` · `rankResumeFindings.ts` · `surfaceResumeSuggestions.ts` · `toResumeUiFeedback.ts`.
- `evaluateResumeRules.ts` — orchestrator (returns content-free funnel stats).
- Tests + `__fixtures__/weak-resume.tex`.

**Pricing & telemetry**
- `src/lib/packs.ts` — plans, add-ons, `buildCheckout()`.
- `src/lib/telemetry-events.ts` — allowlist + sanitizer. `src/lib/track.ts` — client `track()`.
- `src/lib/apply/ai-telemetry.ts` — `withAiRun`/`logCachedRun`. `src/lib/supabase/admin.ts` — `getServiceSupabase`.
- `src/lib/admin.ts` — admin-email gate. `src/app/api/events/route.ts` — event ingest.

**Resume pipeline / editor**
- `src/lib/apply/pipeline.ts` — `parseResume`, agents, tailoring run.
- `src/lib/apply/latex.ts` — `renderResumeTex`, `clampToTwoPages`, `normalizeSkills`.
- `src/lib/apply/contact.ts`, `serialize.ts` (`docToResumeText`), `sanitize-doc.ts`, `template.ts`, `templates.ts`.
- `src/app/applications/[id]/edit/edit-editor.tsx` — the reusable editor (1300+ lines).
- `src/app/applications/tailoring/tailoring-runner.tsx` — the crawling-progress runner.

**Routes (App Router)**
- `src/app/audit/audit-wizard.tsx` — start chooser + upload + score flow (1300+ lines).
- `src/app/resume/{new,edit,import,print}/` — scratch builder, base editor, paste-import, print.
- `src/app/dashboard/{dashboard-live,dashboard-client,dashboard-bits}.tsx` — live + demo dashboard.
- `src/app/pricing/`, `src/app/buy-credits/`, `src/app/admin/orders/`.
- API: `src/app/api/{apply,checkout,events,resume/*,admin/*,stripe/webhook}/route.ts`.

**Config / docs**
- `CLAUDE.md` (durable rules) → imports `AGENTS.md` (Next.js-16 caveat).
- `docs/` — `SETUP.md`, `ai-cost-model.md`, `pricing-and-ad-economics.md`, `resume-editor-plan.md`,
  `telemetry-queries.sql`, this handoff.
- `supabase/migrations/0001…0007` (see §5).

---

## 5. Migrations, env vars, config

### Migrations (`supabase/migrations/`)
Migrations are **applied by the USER** in the Supabase SQL editor; they're a no-op in
localStorage/demo mode.

| File | What it does | Applied? |
|---|---|---|
| `0001_init.sql` | base schema | ✅ (long applied) |
| `0002_resumes.sql` | `resumes` table | ✅ |
| `0003_resume_doc.sql` | `resumes.doc jsonb`, `source`, `applications.resume_id` | ✅ |
| `0004_telemetry.sql` | `product_events` + `ai_runs` tables, RLS, CHECK | ✅ (user ran it) |
| `0005_harden_functions.sql` | lock SECURITY DEFINER funcs from public RPC | ✅ |
| `0006_pricing.sql` | `orders` table + extends event CHECK | ⚠️ **user must apply** |
| `0007_resume_feedback_events.sql` | extends event CHECK with `resume_feedback_*` | ⚠️ **user must apply** |

### Env (`.env.local`, gitignored — `.env.example` is the template)
**Never print key bodies, never commit `.env.local`.** Current dev toggles:
```
LLM_PROVIDER=openai
OPENAI_MODEL_TAILOR=gpt-4.1-mini     # cheap in dev
OPENAI_MODEL_FAST=gpt-4.1-mini
COMPARE_ENABLED=1
RATE_LIMIT_DISABLED=1                # dev only — leave empty in prod
CREDITS_DISABLED=1                   # dev only — skips credit gate
```
Keys present in dev: Supabase URL/anon/service-role, Stripe secret/webhook, OpenAI, Anthropic.
**Absent in dev:** `LATEX_COMPILE_URL` (so PDFs fall back to the in-app print view),
`ADMIN_EMAILS`, `STRIPE_PRICE_*`, `NEXT_PUBLIC_CALENDLY_URL`.

**Pending env actions (user):**
- Set `ADMIN_EMAILS` so `/admin/orders` + Rule Lab are gated in prod.
- Optionally create Stripe Price IDs and set `STRIPE_PRICE_*` (else checkout uses inline `price_data`).
- Toggle **leaked-password protection** ON in the Supabase Auth dashboard (linter warning, dashboard-only).

---

## 6. Commands to run locally

```bash
# from C:\Users\rubbe\tailorcv
npm run dev            # Next.js dev server (Turbopack). PREFER the preview_* tools for verifying.
npm run build          # production build
npm run lint           # eslint
npm test               # vitest run — full suite (103 tests)
npm run rules:validate # validate the Grok rule JSON loads/normalizes
npm run rules:test     # Rule Lab: writes ./debug/*.json (gitignored)
npx tsc --noEmit       # typecheck
```
- **vitest is the only TS runner** (no tsx/ts-node). There is **no zod** — validators are hand-rolled.
- `POST /api/admin/rule-lab` runs deterministic + real `parseResume` + combined-deduped side by
  side (admin-only in prod, open in dev) — the main way to sanity-check rule output.

---

## 7. Things we tried that did NOT work (don't repeat)

- **Dashboard "fix the spacing" via row-grid only** (`575df16`) was insufficient and the user
  pushed back twice. The real culprit was the **fixed 2-column layout always reserving the
  drawer column**, cramping the list, plus a heavy inline base-resume box and a missing header
  subtitle. Fix was to extract the mockup's own `tm-dash.css` and match layout/structure
  value-by-value (`f26604c`). The `.tm-btn` sizes already matched — buttons were a red herring.
- **de-LaTeX macro regex that consumed `\command{content}`** ate `\name{...}`, dropping the
  candidate's name → an LLM "no name" finding then mis-mapped to the ATS rule. Fix: deLatex now
  drops only the command name and KEEPS brace content; legacy ISSUE_PATTERNS check name/title
  BEFORE the narrow ATS pattern.
- **Trusting a "fixed" retest through the content-hash cache.** The ATS false-positive looked
  fixed only because the cached result was served; it returned once the cache cleared. Clear the
  feedback cache (or change content) when retesting rule changes.
- **Per-line "Improve with AI" buttons** were rejected as off-brand → replaced by a single
  "Review my edits" pass (AI critiques the user's own edits vs. its original).
- **Stage-progress rings + fixed-timeout stages** on the tailoring screen froze at the last step
  on large resumes. Replaced with one interval rotating reassurance messages + an asymptotic
  crawling bar (`6 + 86·(1−e^−t/20s)`, caps ~92%, hits 100% only when the doc is ready).
- **Turbopack serves stale `globals.css`** after edits — changes silently don't reflect. Fix:
  stop the preview server, `rm -rf .next`, restart. (Saved as a memory; bit us during the
  dashboard work.)

---

## 8. Open bugs / known issues

- **No open blocking bugs.** tsc/lint/tests/build are all green.
- **Migrations 0006 + 0007 not yet applied** in the live Supabase project → in prod, the
  `orders` insert and `resume_feedback_*` events will fail the CHECK until applied. Demo mode is
  unaffected.
- **Leaked-password protection** still OFF in the Supabase dashboard (linter advisory).
- **Per-suggestion interaction telemetry is half-wired:** `resume_feedback_suggestion_*`
  (clicked/expanded/applied/dismissed) are allowlisted + in the CHECK, but the editor doesn't
  emit them yet because `ruleId` isn't threaded onto each surfaced suggestion (see §10 #2).
- **Detector coverage is partial:** only ~13 of 79 Grok rules have deterministic detectors; the
  rest only fire via the legacy LLM adapter. Not a bug, but coverage to expand.
- **`LATEX_COMPILE_URL` absent in dev** → PDFs use the in-app print view, not real moderncv
  compilation. Expected locally; set the URL to test true PDF output.

---

## 9. Where the rules engine stands (detail for the next session)

Verified live on the weak fixture: **79 rules loaded → 9 candidates → 5 deduped → 5 surfaced →
4 suppressed.** On a weak base resume the editor shows ~6 focused content suggestions with **no
ATS-layout false positive** (templated flag working). Five LLM duplicates collapsed into
rule-grounded cards crediting both sources. `/api/resume/feedback` returns the content-free
funnel stats and the editor fires `resume_feedback_suggestions_surfaced` (counts + tier only).

---

## 10. Next 5 recommended tasks (in order)

1. **Apply migrations `0006` + `0007` and finish prod config** *(user action — surface it)*: run
   both in the Supabase SQL editor, set `ADMIN_EMAILS`, toggle leaked-password protection ON,
   optionally create `STRIPE_PRICE_*`. Unblocks orders, admin view, and feedback telemetry in prod.
2. **Thread `ruleId` onto surfaced suggestions + emit the per-suggestion interaction events.**
   The allowlist + CHECK already include `resume_feedback_suggestion_{clicked,expanded,applied,
   dismissed}`; wire them in the editor once each suggestion carries its `ruleId`/category. This
   closes the rules telemetry loop (which rules users actually act on).
3. **Expand deterministic detectors beyond ~13/79 + add fixtures.** Prioritize high-severity
   `v1_core` rules without detectors; add `ATS-keyword-poor` and `formatting-heavy` fixtures and
   JD-aware keyword detectors. Validate each against the live LLM via Rule Lab.
4. **Optional: single bounded, cached LLM rule-eval pass** (config-flagged, off by default) for
   the subjective rules deterministic checks can't catch. Must respect the privacy invariant and
   the caps; cache by content hash like the existing feedback cache.
5. **Push `ui-review-polish` (17 commits) + open a PR.** Do a final self-review of the
   pricing/telemetry/rules/dashboard diff first. Then validate `docs/telemetry-queries.sql`
   against real rows once events start flowing. **Do not push `main`.**

---

## 11. Instructions every future session MUST follow

These are the load-bearing rules — also in `CLAUDE.md`.

- **Secrets:** only ever in gitignored `.env.local`. **Never** paste a key into chat or a commit;
  never print key bodies (redact). Never commit the real candidate resumes in `~/Downloads` (PII).
- **Telemetry privacy invariant:** never store résumé/JD text, PII, or evidence snippets — only
  counts/ids/categories/safe primitives. New events go through the allowlist + sanitizer + a
  CHECK-constraint migration.
- **Don't push `main`.** Work on the feature branch; commit/push **only when the user asks**.
- **Migrations are the user's to apply.** Write the SQL, tell them to run it; never assume it ran.
- **Don't break demo/anon mode.** Keys-absent must keep working; no auth/Supabase gates on the
  scratch/audit funnel.
- **Verify before claiming done:** `npx tsc --noEmit` + `npm run lint` + `npm test`, and use the
  **`preview_*` tools** (not Bash, not Chrome MCP) to verify anything visible in the browser.
- **Next.js 16 ≠ your training data.** Read the relevant guide in `node_modules/next/dist/docs/`
  before writing framework code (per `AGENTS.md`).
- **No em dashes in user-facing copy** (repeatedly enforced — use commas/periods/parentheses).
- **Single sources of truth:** prices → `lib/packs.ts`; resume shape → `TailoredDoc`; service-role
  client → `lib/supabase/admin.ts`; rule caps → `resumeFeedbackConfig.ts`. Don't duplicate.
- **A rule is not a suggestion** — respect the caps when surfacing feedback.
- **Turbopack stale CSS:** after `globals.css` edits, stop preview → `rm -rf .next` → restart.
- **vitest only** (no tsx/ts-node); **no zod** (hand-rolled validators).
