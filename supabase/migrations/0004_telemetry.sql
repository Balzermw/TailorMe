-- ============================================================
-- TailorMe: MVP decision telemetry. Two purpose-built tables, no
-- generic click logging. NEITHER table stores résumé text, job
-- text, prompts, responses, names, emails, phones, addresses, or
-- file names.
--
-- Trust boundary: RLS is enabled with NO policies, so anon/auth
-- clients can NEITHER read NOR insert directly. Only the server
-- (service role, which bypasses RLS) writes — via /api/events
-- (product_events) and the AI routes (ai_runs). Analytics is run
-- with the service role / SQL editor.
--
-- Replaces the earlier open `events` table if it was applied.
-- ============================================================

drop table if exists public.events;

-- ---- product_events: safe, low-frequency, decision-oriented UI events ----
create table if not exists public.product_events (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  user_id uuid references auth.users (id) on delete set null,
  session_id text not null,
  name text not null,
  props jsonb not null default '{}'::jsonb,
  -- DB-level defense in depth (the API validates first):
  constraint product_events_name_ck check (name in (
    'chooser_select','resume_import_start','resume_import_success',
    'resume_import_failed','start_from_scratch','template_select',
    'feedback_click','target_job_click','tailor_click','pdf_click',
    'pricing_view','checkout_start','checkout_success',
    'credit_gate_shown','limit_hit'
  )),
  constraint product_events_props_size_ck check (char_length(props::text) <= 2000)
);
create index if not exists product_events_name_created_idx
  on public.product_events (name, created_at desc);
alter table public.product_events enable row level security;
-- No policies → only the service role can read/write.

-- ---- ai_runs: server-side AI usage / cost / cache telemetry ----
create table if not exists public.ai_runs (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  user_id uuid references auth.users (id) on delete set null,
  session_id text,
  feature text not null,                 -- feedback | group_skills | structure | score | audit | tailor
  provider text,                         -- openai | anthropic
  model text,
  status text not null,                  -- completed | cached | failed
  cache_hit boolean not null default false,
  latency_ms integer,
  input_tokens integer,
  output_tokens integer,
  estimated_cost_cents numeric(10,4),
  error_code text,
  metadata jsonb not null default '{}'::jsonb,
  constraint ai_runs_status_ck check (status in ('completed','cached','failed'))
);
create index if not exists ai_runs_feature_created_idx
  on public.ai_runs (feature, created_at desc);
create index if not exists ai_runs_user_created_idx
  on public.ai_runs (user_id, created_at desc);
alter table public.ai_runs enable row level security;
-- No policies → only the service role can read/write.

-- ============================================================
-- Retention (see docs/telemetry-queries.sql):
--   * product_events: raw rows are only needed ~90 days for product
--     decisions. Recommend a scheduled prune (pg_cron) OR roll up to
--     daily counts before deleting:
--       delete from public.product_events where created_at < now() - interval '90 days';
--   * ai_runs: KEEP LONGER (cost/accounting). Do not prune on the
--     90-day schedule; archive/roll up only when it grows large.
-- No dashboard yet — query via the SQL editor / service role.
-- ============================================================
