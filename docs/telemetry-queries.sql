-- ============================================================
-- TailorMe telemetry — analyst queries (run with the service role / SQL editor).
-- Two tables (migration 0004): product_events (UI decisions) and ai_runs
-- (server AI usage/cost/cache). Neither stores résumé/job content or PII.
-- No dashboard yet — these are the queries to make product/pricing/cost calls.
-- ============================================================

-- 1) Event counts by name (last 30 days)
select name, count(*) as events
from product_events
where created_at > now() - interval '30 days'
group by name
order by events desc;

-- 2) Unique users by event (signed-in only; user_id null = anon)
select name, count(distinct user_id) as unique_users
from product_events
where user_id is not null
group by name
order by unique_users desc;

-- 3) Feedback clicks vs completed feedback runs (how often a click actually
--    spends tokens vs is served free). product_events.props->>'result' is
--    'ran' | 'up_to_date'; ai_runs has the server truth (completed vs cached).
select
  (select count(*) from product_events where name = 'feedback_click') as feedback_clicks,
  (select count(*) from product_events
     where name = 'feedback_click' and props->>'result' = 'up_to_date') as client_up_to_date,
  (select count(*) from ai_runs where feature = 'feedback' and status = 'completed') as feedback_llm_runs,
  (select count(*) from ai_runs where feature = 'feedback' and status = 'cached') as feedback_cache_hits;

-- 4) Tailor clicks vs completed tailor runs (intent vs delivered)
select
  (select count(*) from product_events where name = 'tailor_click') as tailor_clicks,
  (select count(*) from ai_runs where feature = 'tailor' and status = 'completed') as tailor_runs_completed,
  (select count(*) from ai_runs where feature = 'tailor' and status = 'failed') as tailor_runs_failed;

-- 5) PDF exports
select count(*) as pdf_exports,
       count(distinct user_id) as users_exporting
from product_events
where name = 'pdf_click';

-- 6) AI runs vs cache hits, by feature (the cache savings story)
select feature,
       count(*)                                              as total,
       count(*) filter (where status = 'completed')          as llm_calls,
       count(*) filter (where cache_hit)                      as cache_hits,
       round(100.0 * count(*) filter (where cache_hit) / nullif(count(*), 0), 1) as cache_hit_pct
from ai_runs
group by feature
order by total desc;

-- 7) AI cost by feature (cents) — last 30 days
select feature,
       count(*) filter (where status = 'completed') as billable_runs,
       round(sum(estimated_cost_cents), 2)          as cost_cents,
       round(avg(latency_ms))                       as avg_latency_ms
from ai_runs
where created_at > now() - interval '30 days'
group by feature
order by cost_cents desc nulls last;

-- 8) AI failure rate by feature
select feature,
       count(*)                                     as runs,
       count(*) filter (where status = 'failed')    as failures,
       round(100.0 * count(*) filter (where status = 'failed') / nullif(count(*), 0), 1) as failure_pct
from ai_runs
group by feature
order by failure_pct desc;

-- 9) Estimated AI cost per active user (last 30 days). Active = made >=1 AI run.
select round(sum(estimated_cost_cents), 2)                              as total_cost_cents,
       count(distinct user_id)                                          as active_users,
       round(sum(estimated_cost_cents) / nullif(count(distinct user_id), 0), 3) as cost_cents_per_user
from ai_runs
where created_at > now() - interval '30 days' and user_id is not null;

-- 10) Checkout conversion path (funnel). Needs pricing_view / checkout_start /
--     checkout_success instrumentation (allowlisted; wire on the pricing page).
select
  count(*) filter (where name = 'pricing_view')     as pricing_views,
  count(*) filter (where name = 'checkout_start')    as checkout_starts,
  count(*) filter (where name = 'checkout_success')  as checkout_successes,
  round(100.0 * count(*) filter (where name = 'checkout_success')
        / nullif(count(*) filter (where name = 'pricing_view'), 0), 1) as view_to_paid_pct
from product_events
where created_at > now() - interval '30 days';

-- ============================================================
-- Retention (see migration 0004_telemetry.sql header):
--   product_events: prune raw rows after ~90 days (roll up first if you want
--   long-term counts). Schedule with pg_cron, e.g. daily:
--     delete from product_events where created_at < now() - interval '90 days';
--   ai_runs: KEEP LONGER (cost/accounting) — do NOT put on the 90-day prune.
-- ============================================================
