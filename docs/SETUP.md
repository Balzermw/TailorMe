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

## 3. LLM provider (the apply pipeline)

> **Never paste an API key into a chat or commit it.** Keys live only in
> `.env.local` (gitignored). If one is ever exposed, rotate it immediately in
> the provider console.

Pick the provider with `LLM_PROVIDER` (`anthropic` default, or `openai`).

**Anthropic:** <https://console.anthropic.com> → API keys → `ANTHROPIC_API_KEY`.
Default model `claude-sonnet-4-6` (override `ANTHROPIC_MODEL`).

**OpenAI:** <https://platform.openai.com> → API keys → `OPENAI_API_KEY`, then set
`LLM_PROVIDER=openai`. Models are assigned **per use case to maximize usage**:

| Pipeline step | OpenAI model (env) | Why |
|---|---|---|
| Fit score | `OPENAI_MODEL_FAST` = `gpt-4.1-mini` | cheap, structured-output only |
| Tailor (resume + cover letter) | `OPENAI_MODEL_TAILOR` = `gpt-4.1` | quality-sensitive writing |
| 3-agent review | `OPENAI_MODEL_FAST` = `gpt-4.1-mini` | cheap, structured-output only |

Structured output uses Anthropic forced tool-use or OpenAI strict
Structured Outputs automatically — same JSON either way.

### Comparing providers (eval)

With **both** keys set and `COMPARE_ENABLED=1`, `POST /api/compare` runs the
same resume + posting through both providers and returns each result plus real
token usage and cost:

```bash
curl -s localhost:3000/api/compare \
  -H 'Content-Type: application/json' \
  -d '{"useSample":true,"postingText":"<paste a job posting>"}' | jq
```

It makes 6 billed calls per run, so it's off by default and rate-limited.

> **Live customer data:** for eval, prefer the bundled composite (`useSample`)
> or **consented/synthetic** resumes. Don't run real customer PII through a
> comparison harness (or paste it into a chat) without consent and your DPA in
> place — the brief's GDPR/one-click-delete promises apply here too.
3. The free audit (`/audit`) runs **fit scoring** for real against the sample
   resume + your pasted posting — no auth, no credit. The full
   tailor + review run (`mode: "full"` on `/api/apply`) requires a signed-in
   user with a credit, spends one credit, and saves the application.
4. **Resume upload is real:** PDF (`unpdf`), Word (`mammoth`), and text files
   are parsed to text + heuristic stats by `/api/parse-resume` — local, no key
   needed, so upload works in demo mode too. The full run threads the uploaded
   resume (or the sample) through the pipeline.

## 4. PDF / documents (moderncv LaTeX)

The tailored documents are generated as **real moderncv (banking) LaTeX**
(`src/lib/apply/latex.ts`):

- **Preview now:** `/applications/sample/print` renders the moderncv-banking
  layout in-browser (no toolchain) — "Save as PDF" produces the PDF, and
  "Download .tex" gives the actual LaTeX source. Real applications use
  `/applications/<id>/print`.
- **Real PDF compilation (optional):** set `LATEX_COMPILE_URL` to a self-hosted
  endpoint that takes `{ tex, engine }` and returns a PDF. Then
  `/api/applications/<id>/pdf` returns a compiled moderncv PDF; without it, that
  route falls back to the print view. Keeping compilation on your own
  infrastructure means resume content never goes to a third party.

  A ready-to-run compiler lives in [`compile-service/`](../compile-service)
  (zero-dependency Node handler on a TeX Live base, hardened against
  shell-escape/runaway jobs):

  ```bash
  docker build -t tailorme-latex ./compile-service
  docker run -p 8080:8080 -e COMPILE_TOKEN=a-long-secret tailorme-latex
  ```

  Then set in `.env.local`:

  ```
  LATEX_COMPILE_URL=http://localhost:8080
  LATEX_COMPILE_TOKEN=a-long-secret   # must match COMPILE_TOKEN above
  ```

  Deploy that container to Fly.io / Cloud Run / Render / a Claude Managed-Agents
  container and point `LATEX_COMPILE_URL` at it (keep it private — see the
  service README). The `.tex` it compiles is identical to the in-app preview.

## Abuse prevention & cost control

Claude tokens are the only per-use cost, so the ungated paths are guarded
(`src/lib/limits.ts` + `src/lib/rate-limit.ts`), all env-tunable:

- **Input-size caps** bound tokens per call — postings ≤ 8,000 chars, resumes
  ≤ 24,000 chars (oversized → `413`; parsed resumes are truncated, not silently).
- **Free fit-score audits** (unauthenticated) are rate-limited per IP
  (`FREE_AUDIT_PER_HOUR`/`_PER_DAY`) with a **global daily circuit breaker**
  (`FREE_AUDIT_GLOBAL_PER_DAY`) capping total free spend.
- **Resume parsing** is rate-limited per IP (CPU abuse).
- **Full runs** require auth **+ a credit** (credits cap total spend); a
  per-account daily burst cap catches a scripted/compromised account.
- **Checkout** is rate-limited per account (session spam).
- **`max_tokens`** on every Claude call caps output cost.

When a free user hits a limit the audit shows the **zero-inference sample**
result plus a "create a free account" nudge — so they still see what the tool
does, at no token cost. Tune any knob via the env vars in `.env.example`; set
`RATE_LIMIT_DISABLED=1` for local dev.

> **Scaling note:** the limiter is in-memory — correct for a single VPS Node
> process (TailorMe's target). For multi-instance/serverless, back `consume()`
> in `rate-limit.ts` with a shared store (a Supabase table or Upstash Redis);
> the call sites don't change.

## Still placeholder (confirm before launch)

- Refund-policy wording (Pricing FAQ, Terms, Buy credits)
- Coaching package prices ($149 / $199 / $299)
- Support email (Contact page)
