# Deploy / environment setup (TailorMe)

The one-time + per-environment setup steps that aren't done by `git push`. Companion to
`docs/AI_HANDOFF_2026-06-22.md`. **Instructions only — no secret values live in this file.**
Secrets go in gitignored `.env.local` (local) or the host's env settings (prod), never in git or chat.

## Status (as of 2026-06-22, dev Supabase project)

| Step | Status | Notes |
|---|---|---|
| Migrations `0006` + `0007` | ✅ applied & verified | events CHECK includes the `resume_feedback_*` names |
| `ADMIN_EMAILS` | ✅ set in `.env.local` | restart dev to load; must also be set in the prod host |
| Leaked-password protection | ⏸️ deferred | Supabase **Pro-only**; advisory, not a real hole |
| Stripe Price IDs | ⏭️ optional / skipped | inline `price_data` from `packs.ts` already works |

Everything required for the app to run is done. The remaining items are either deploy-time
(re-do against the prod project/host) or optional.

---

## 1. Database migrations (Supabase SQL Editor)

Migrations live in `supabase/migrations/` and are applied **by hand** in the Supabase dashboard
(SQL Editor → New query → paste → Run). They're a no-op in local demo mode.

- **This (dev) project:** `0001`–`0007` are applied. `0006` (orders table + events allowlist)
  and `0007` (adds the `resume_feedback_*` event names) were applied & verified 2026-06-22.
- **A fresh / production project:** run **every** file in `supabase/migrations/` in numeric order
  `0001 → 0007`. The SQL for `0006` and `0007` is in those files (and was pasted in chat on
  2026-06-22 if you need it again).
- Order matters for `0006`→`0007`: `0006` creates `orders` and sets the events CHECK; `0007`
  re-sets the CHECK as a strict superset adding the feedback events. All statements are
  idempotent (`if not exists` / `drop … if exists`), so re-running is safe.

**Verify (run after applying):**
```sql
select count(*) as orders_rows from public.orders;            -- returns 0, not an error
select pg_get_constraintdef(oid) as events_check
from pg_constraint where conname = 'product_events_name_ck';  -- must contain resume_feedback_suggestions_surfaced
```

---

## 2. `ADMIN_EMAILS` (gates `/admin/orders` + Rule Lab)

Comma-separated email allowlist, server-only (`src/lib/config.ts`). **Empty = nobody** (safe
default), so admin views stay locked until set. Compared lowercased/trimmed.

- **Local:** in `.env.local` →
  ```
  ADMIN_EMAILS=you@example.com           # or a@x.com,b@y.com for several
  ```
  Then **restart `npm run dev`** (env vars aren't hot-reloaded).
- **Production:** set the same `ADMIN_EMAILS` var in the host's environment settings and redeploy.
- **Verify:** sign in as a listed email → `/admin/orders` shows the queue (a non-listed account
  gets 403). Rule Lab (`/api/admin/rule-lab`) is open in dev, admin-gated in prod.

---

## 3. Leaked-password protection (Supabase) — deferred (Pro-only)

Cross-checks new passwords against HaveIBeenPwned. **Requires a Supabase paid plan**, and it's an
*advisory*, not a vulnerability — leaving it off does not weaken the app's own auth.

- **When on Pro:** Supabase dashboard → **Authentication** → security settings (labeled
  **"Attack Protection"**, or under **"Policies" / "Configuration" → Password security**) → toggle
  **"Leaked password protection"** ON. Confirm via **Advisors → Security** (the
  `auth_leaked_password_protection` warning clears).
- **App-level alternative (only if needed before Pro):** call the HIBP range API at sign-up and
  reject breached passwords. Real work + a signup dependency; not worth it unless required.

---

## 4. Stripe Price IDs — optional

When unset, checkout builds inline `price_data` from the cent amounts in `src/lib/packs.ts`, so
payments work in test and live mode with **no Stripe Products**. Set Price IDs only for cleaner
Stripe reporting / tax / product reuse.

**Caveat:** if a Price ID is set, Stripe charges *that Price's* amount, but the UI and the stored
`orders.amount_cents` come from `packs.ts` — so each Stripe Price amount **must exactly match**
`packs.ts` or charged ≠ displayed.

Create a **one-time, USD** price per item in Stripe → Products, copy each `price_…` ID, and set
(var names from `src/lib/config.ts`, in `.env.local` + prod host):
```
STRIPE_PRICE_STARTER_29=price_…          # Starter  — $29.00  (5 applications)
STRIPE_PRICE_JOB_HUNT_69=price_…         # Job Hunt — $69.00  (15)
STRIPE_PRICE_CAMPAIGN_129=price_…        # Campaign — $129.00 (35)
STRIPE_PRICE_EXPERT_FEEDBACK_79=price_…  # Expert Feedback add-on — $79.00
STRIPE_PRICE_HUMAN_REVISION_149=price_…  # Human Revision add-on  — $149.00
```
Any unset var just falls back to inline `price_data`, so you can set them piecemeal. The
per-application "request human review" checkout (`request-review/route.ts`) always uses inline
`price_data` — no Price ID needed there.

---

## Going to production — checklist

`git push` ships code only. For a real deploy also:

1. **Host env vars** (Vercel/host → Project → Environment Variables), mirroring `.env.local` but
   with production values: `NEXT_PUBLIC_APP_URL` (real domain), Supabase URL + anon + service-role
   keys, **live** Stripe secret + webhook secret, the LLM provider key(s), and `ADMIN_EMAILS`.
   Do **not** carry over the dev-only toggles `CREDITS_DISABLED` / `RATE_LIMIT_DISABLED`.
2. **Migrations** against the prod Supabase project (apply `0001`–`0007` in order — see §1).
3. **Stripe webhook**: create the endpoint pointing at `https://<domain>/api/stripe/webhook` and
   set its signing secret as `STRIPE_WEBHOOK_SECRET` in the host.
4. **Optional**: Stripe Price IDs (§4), LaTeX compile service (`LATEX_COMPILE_URL` — else the
   in-app print view is used), leaked-password protection if on Pro (§3).
