-- ============================================================
-- Pricing refresh: orders table (records every purchase incl. human add-ons
-- for fulfillment + admin visibility) and the expanded product_events name
-- allowlist for the pricing/checkout telemetry.
-- ============================================================

-- ---- orders: one row per completed Stripe checkout (written by the webhook
-- with the service role). Stores plan, credits granted, add-on flags, and the
-- revenue — no résumé/job content or PII beyond the auth user_id reference.
create table if not exists public.orders (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  user_id uuid references auth.users (id) on delete set null,
  plan_slug text not null,
  credits integer not null default 0,             -- application credits granted
  amount_cents integer not null default 0,        -- plan price
  total_cents integer not null default 0,         -- plan + add-ons
  expert_feedback boolean not null default false, -- $79 human review pass purchased
  human_revision boolean not null default false,  -- $149 human revision purchased
  stripe_session_id text unique,                  -- idempotency: one order per session
  -- Human add-ons need manual fulfillment; /admin/orders lists the pending ones
  -- (orders where (expert_feedback or human_revision) and fulfillment_status <> 'none').
  fulfillment_status text not null default 'none' -- none | pending | done
);
create index if not exists orders_user_created_idx on public.orders (user_id, created_at desc);
create index if not exists orders_fulfillment_idx
  on public.orders (fulfillment_status, created_at desc)
  where fulfillment_status <> 'none';

alter table public.orders enable row level security;
-- Users may read their own orders; only the service role (webhook/admin) writes.
drop policy if exists orders_select_own on public.orders;
create policy orders_select_own on public.orders
  for select using (auth.uid() = user_id);

-- ---- expand the product_events name allowlist (CHECK from 0004_telemetry.sql)
alter table public.product_events drop constraint if exists product_events_name_ck;
alter table public.product_events add constraint product_events_name_ck check (name in (
  -- funnel / navigation
  'chooser_select','resume_import_start','resume_import_success',
  'resume_import_failed','start_from_scratch','template_select',
  'feedback_click','target_job_click','tailor_click','pdf_click',
  -- pricing + checkout
  'pricing_viewed','plan_card_clicked','checkout_started','purchase_completed',
  -- human-review upsells
  'expert_review_viewed','expert_review_added','expert_review_removed',
  'human_revision_viewed','human_revision_added','human_revision_removed',
  -- free audit + paywall
  'free_audit_started','free_audit_completed','paywall_seen',
  -- content interactions
  'refund_policy_clicked','faq_opened',
  -- legacy names (already-shipped instrumentation)
  'pricing_view','checkout_start','checkout_success','credit_gate_shown','limit_hit'
));
