# Pricing & ad economics

Internal guidance for the pricing/checkout refresh and the paid-traffic test.
Prices are intentionally raised to support buying traffic with healthier ad
economics. Source of truth for amounts: `src/lib/packs.ts`. Cost model:
`docs/ai-cost-model.md`. Telemetry to measure it: `docs/telemetry-queries.sql`.

## Target pricing

| Item | Price | Credits | Per app |
|---|---|---|---|
| Starter | $29 | 5 | $5.80 |
| Job Hunt (most popular) | $69 | 15 | $4.60 |
| Campaign | $129 | 35 | $3.69 |
| Expert Feedback (add-on) | +$79 | — | one human review pass, 48h, feedback only |
| Human Revision (add-on) | +$149 | — | one hands-on human revision pass |
| Full white-glove service | $225+ | — | sales anchor, by request, no self-serve checkout |

Add-ons never grant application credits — only plans do.

## Initial paid ad testing

- Start with a $300–$500 test budget.
- Prefer Reddit / Meta for early testing.
- Avoid cold LinkedIn ads unless AOV is proven high.
- Do not pay $3–$8 clicks unless AOV is over $100 and conversion is proven.

## Target CPA (cost per acquisition)

- Mostly Starter buyers: $8–$15 max CPA
- Mostly Job Hunt buyers: $20–$35 CPA
- Job Hunt + human-review attach: $35–$60 CPA
- Campaign / high human attach: $50–$80 CPA

## Safer CPC targets

- Starter-heavy traffic: $0.25–$0.50
- Job Hunt-heavy traffic: $0.50–$1.25
- Strong human-review attach: $1.00–$2.50

Break-even is not the target. We need profit margin after payment fees, AI
usage, support, refunds, and human-review labor. Judge ads by paid CPA, AOV,
plan mix, and human-review attach rate — never CPC alone.

## Decision rules (read the telemetry, then act)

These are interpretation guidelines, not code. Measure with the queries below.

- Starter > 50% of purchases → pricing is too bottom-heavy.
- Job Hunt ≥ 50% of purchases → pricing page is working.
- Expert Feedback attach rate < 5% → offer is unclear or too hidden.
- Expert Feedback attach rate 10–20% → good.
- Expert Feedback attach rate > 25% → consider raising it to $99.

## Metrics that matter

Built from `product_events` (UI) + `orders` (revenue) + `ai_runs` (cost):

- Pricing page views — `pricing_viewed`
- Plan card clicks by plan — `plan_card_clicked` grouped by `props->>'plan_slug'`
- Checkout starts by plan — `checkout_started`
- Purchases by plan — `orders` grouped by `plan_slug` (authoritative) or `purchase_completed`
- Pricing → checkout-start conversion
- Checkout-start → purchase conversion
- Expert Feedback attach rate — `orders` where `expert_feedback` ÷ total
- Human Revision attach rate — `orders` where `human_revision` ÷ total
- Average order value — `avg(total_cents)` from `orders`
- Revenue per pricing page visitor — `sum(total_cents)` ÷ `pricing_viewed` count
- Refund-policy clicks — `refund_policy_clicked`
- Free-audit → purchase conversion — `free_audit_completed` users who later appear in `orders`

Example (plan mix + attach + AOV from the authoritative orders table):

```sql
select plan_slug,
       count(*)                                              as purchases,
       round(avg(total_cents) / 100.0, 2)                    as avg_order_usd,
       round(100.0 * count(*) filter (where expert_feedback) / count(*), 1) as expert_attach_pct,
       round(100.0 * count(*) filter (where human_revision)  / count(*), 1) as revision_attach_pct
from orders
group by plan_slug
order by purchases desc;
```

## Manual setup still required

- Apply migration `0006_pricing.sql` (orders table + telemetry allowlist).
- (Optional) Create Stripe Prices and set the env vars in `.env.local` /
  deploy env — otherwise checkout uses inline price_data from `packs.ts`:
  - `STRIPE_PRICE_STARTER_29`
  - `STRIPE_PRICE_JOB_HUNT_69`
  - `STRIPE_PRICE_CAMPAIGN_129`
  - `STRIPE_PRICE_EXPERT_FEEDBACK_79`
  - `STRIPE_PRICE_HUMAN_REVISION_149`
- Admin fulfillment view: `/admin/orders` lists orders (pending human add-ons
  highlighted, one click to mark fulfilled). Gated by the `ADMIN_EMAILS` env var
  (comma-separated allowlist) — set it or nobody can access. Reads/writes via the
  service role, re-checks admin on the mutation route.
