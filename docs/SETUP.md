# TailorMe — going live

The app ships in **demo mode**: with no credentials, auth is a localStorage
mock, "Pay" runs a fake success, and the audit wizard simulates the pipeline.
Fill in `.env.local` to switch each service to real, one at a time — no code
changes needed. Copy `.env.example` to `.env.local`, add the keys below, and
restart `npm run dev`.

Mode detection (see `src/lib/config.ts`):

| Service | Goes live when… | Powers |
|---|---|---|
| Supabase | `NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_ANON_KEY` set | real auth, dashboard data, credits |
| Stripe | `STRIPE_SECRET_KEY` set (+ webhook secret + service role for granting) | credit-pack checkout |
| Anthropic | `ANTHROPIC_API_KEY` set | the `/apply` fit + tailor + review pipeline |

---

## 1. Supabase (auth + database)

1. Create a project at <https://supabase.com>.
2. **Project Settings → API** — copy into `.env.local`:
   - Project URL → `NEXT_PUBLIC_SUPABASE_URL`
   - `anon` `public` key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `service_role` key → `SUPABASE_SERVICE_ROLE_KEY` (server-only; used by the
     Stripe webhook to grant credits)
3. **SQL Editor** — paste and run `supabase/migrations/0001_init.sql`. This
   creates `profiles`, `credit_transactions`, `applications`, row-level
   security, and the credit functions. New users get **1 free credit**.
4. **Authentication → URL Configuration** — set the Site URL to your
   `NEXT_PUBLIC_APP_URL` and add `<APP_URL>/auth/callback` to the redirect
   allowlist.
5. *(Optional) OAuth* — **Authentication → Providers**: enable **Google** and
   **LinkedIn (OIDC)** and paste their client id/secret. The sign-in buttons
   use providers `google` and `linkedin_oidc`. Until enabled, those buttons
   only work in demo mode.

Restart the dev server → sign-up/sign-in, the dashboard, and credits are now
real. Protected routes (`/dashboard`, `/settings`, `/buy-credits`) are guarded
by `middleware.ts`.

## 2. Stripe (credit packs)

1. <https://dashboard.stripe.com> → **Developers → API keys** → copy the secret
   key into `STRIPE_SECRET_KEY`.
2. Prices are created inline from `src/lib/packs.ts` (Starter $19/5, Job hunt
   $49/15, All in $99/40, +$49 Michael add-on) — no Product setup needed.
3. **Webhook** — credits are granted only after Stripe confirms payment:
   - **Local dev:** `stripe listen --forward-to localhost:3000/api/stripe/webhook`
     and copy the printed `whsec_…` into `STRIPE_WEBHOOK_SECRET`.
   - **Production:** **Developers → Webhooks → Add endpoint**
     `<APP_URL>/api/stripe/webhook`, event `checkout.session.completed`, then
     copy its signing secret into `STRIPE_WEBHOOK_SECRET`.
   - The webhook needs `SUPABASE_SERVICE_ROLE_KEY` set to grant credits.
4. Test with card `4242 4242 4242 4242`, any future expiry/CVC.

Granting is idempotent on the Stripe session id, so a replayed webhook never
double-credits.

## 3. Anthropic (the apply pipeline)

1. <https://console.anthropic.com> → **API keys** → copy into `ANTHROPIC_API_KEY`.
2. Default model is `claude-sonnet-4-6`; override with `ANTHROPIC_MODEL`.
3. The free audit (`/audit`) runs **fit scoring** for real against the sample
   resume + your pasted posting — no auth, no credit. The full
   tailor + review run (`mode: "full"` on `/api/apply`) requires a signed-in
   user with a credit, spends one credit, and saves the application.
4. **Resume upload is real:** PDF (`unpdf`), Word (`mammoth`), and text files
   are parsed to text + heuristic stats by `/api/parse-resume` — local, no key
   needed, so upload works in demo mode too. The full run threads the uploaded
   resume (or the sample) through the pipeline.

## 4. PDF / documents

Tailored documents render at `/applications/[id]/print` as a print-styled page;
"Save as PDF" uses the browser print dialog (no external service). The
`ResumeRenderer` seam in `src/lib/apply/render.ts` lets a moderncv/LaTeX
renderer be swapped in later without touching callers.

## Still placeholder (confirm before launch)

- Refund-policy wording (Pricing FAQ, Terms, Buy credits)
- Coaching package prices ($149 / $199 / $299)
- Support email (Contact page)
