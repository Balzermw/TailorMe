@AGENTS.md

# TailorMe (by Res.Me) — project rules

Resume-tailoring SaaS. Next.js 16 (App Router, Turbopack) · React 19 · TS · Tailwind v4 ·
Supabase (auth + Postgres + RLS) · Stripe Checkout · OpenAI/Anthropic. Package name is
`applyforme`; the product is **TailorMe**. Latest full handoff: `docs/AI_HANDOFF_2026-06-22.md`.

## Security & privacy (non-negotiable)
- Secrets live ONLY in gitignored `.env.local`. Never paste a key into chat or a commit; never
  print key bodies (redact). `.env.example` is the committed template.
- The real candidate resumes under `~/Downloads` are PII — never commit them.
- **Telemetry privacy invariant:** never store résumé content, job-description text, PII, or
  evidence snippets — only counts, ids, categories, safe primitives. Every new event goes through
  the `ALLOWED_EVENTS` allowlist + `sanitizeProps` (`src/lib/telemetry-events.ts`) AND a Postgres
  CHECK-constraint migration. Telemetry writes are service-role only (`src/lib/supabase/admin.ts`).

## Git & migrations
- Do NOT push `main`. Work on the feature branch; commit/push only when the user asks.
- Migrations (`supabase/migrations/`) are applied by the USER in the Supabase SQL editor and are a
  no-op in demo mode. Write the SQL and tell them to run it — never assume it ran.

## Demo / anonymous mode is first-class
- Any service whose keys are absent runs simulated: Supabase→localStorage, Stripe→demo success,
  LLM→simulated pipeline. Don't add auth/Supabase gates to the scratch/audit funnel, and don't
  assume a DB row exists.
- Dev `.env.local` uses `CREDITS_DISABLED=1`, `RATE_LIMIT_DISABLED=1`, `LLM_PROVIDER=openai` with
  cheap models; `LATEX_COMPILE_URL` is absent (PDFs fall back to the in-app print view). These
  toggles are dev-only — leave them empty in prod.

## Single sources of truth (don't duplicate)
- Resume shape → `TailoredDoc` (both upload and build-from-scratch converge on it).
- Pricing → `src/lib/packs.ts` (checkout uses `STRIPE_PRICE_*` env when set, else inline `price_data`).
- Service-role client → `getServiceSupabase` in `src/lib/supabase/admin.ts`.
- Rule caps/flags → `src/lib/resume-rules/resumeFeedbackConfig.ts`.

## Resume-rules engine
- **A rule is NOT automatically a customer suggestion.** 79 rules trigger internally; the user sees
  a capped set (free ≤5, paid ≤10, ≤2/category, ≤3 formatting, min confidence 0.6).
- Deterministic-first: zero new LLM calls in the pipeline. Legacy LLM findings carry
  `canonicalIssueId` (= Grok `rule_id`) so they dedupe instead of double-surfacing.
- The `templated` flag drops TEMPLATE_OWNED categories (formatting/ats/readability) for our-template
  docs — those are template-owned, so flagging them is a false positive.
- Debug with `POST /api/admin/rule-lab` and `npm run rules:test` (writes gitignored `./debug/*.json`).

## Conventions & gotchas
- **Verify before claiming done:** `npx tsc --noEmit` + `npm run lint` + `npm test` (vitest, 103
  tests). Use the **`preview_*` tools** (not Bash, not Chrome MCP) to verify anything visible in the browser.
- **vitest is the only TS runner** (no tsx/ts-node). There is **no zod** — validators are hand-rolled.
- **Turbopack serves stale `globals.css`** after edits: stop the preview, `rm -rf .next`, restart.
- **No em dashes in user-facing copy** — use commas, periods, or parentheses.
- Next.js 16 differs from training data — read `node_modules/next/dist/docs/` before framework code (see `AGENTS.md`).
