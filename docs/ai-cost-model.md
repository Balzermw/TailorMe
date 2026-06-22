# TailorMe — AI cost model

How AI spend works in TailorMe, for pricing / unit-economics decisions. These
are **estimates** derived from the model rate table in `src/lib/apply/llm.ts`
and the per-feature call structure. Replace them with measured values once the
`ai_runs` telemetry table (migration `0004_telemetry.sql`) has data — see
"Make it empirical" at the bottom. Cross-ref: `docs/telemetry-queries.sql`.

## Models per step (defaults, from `config.ts`)

| Step env | Default model | Rate (per 1M tokens) |
|---|---|---|
| `OPENAI_MODEL_FAST` (parse/feedback/structure/group/tailor/review) | `gpt-4.1-mini` | $0.40 in / $1.60 out |
| `OPENAI_MODEL_SCORE` (fit score) | **`gpt-4.1`** | **$2.00 in / $8.00 out** |
| `OPENAI_MODEL_TAILOR` | `gpt-4.1-mini` | $0.40 in / $1.60 out |

The **fit-score step runs on premium `gpt-4.1`** ("honest calibration" per the
code comment) and fires inside `score`, `audit`, *and* `tailor` — so it is the
dominant cost across the whole funnel.

## LLM calls + estimated unit cost per feature

| Feature | Calls | Models | Est. cost / run |
|---|---|---|---|
| `feedback` (parseResume) | 1 | mini | ~0.25¢ |
| `structure` (paste import) | 1 | mini | ~0.35¢ |
| `group_skills` | 1 | mini | ~0.08¢ |
| `score` (runScore → scoreFit) | 1 | **gpt-4.1** | ~1.3¢ |
| `audit` (runAudit = scoreFit + buildAgents) | 2 | gpt-4.1 + mini | ~1.6¢ |
| `tailor` (runFull = score + tailor + verify + research + agents) | ~5 | gpt-4.1 + mini | ~3.2¢ |

`feedback` is **cached** by content hash (`feedbackHash`), so an unchanged
re-run costs $0. Template switching is a recompile only — never an LLM call.

## Cost per paid run, start to finish (personas)

A "paid run" is not just the tailor call — it's every AI step from landing to
the finished doc. The tailor step is roughly constant; the **free funnel
(score + audit) before it is what varies**.

| Persona | Journey | Paid runs | All-in / paid run |
|---|---|---|---|
| Decisive Dana — has resume, one job | score → audit → tailor | 1 | ~6.1¢ |
| Builder Ben — no resume, builds + refines | import → group → 2× feedback → score → audit → tailor | 1 | ~7.0¢ |
| Shopper Sam — three jobs | build once, then 3×(score+audit+tailor) | 3 | ~6.4¢ |
| Browsing Bree — explores, then buys | 4× free audit + 3 feedback → tailor | 1 | ~15.6¢ |

Even the worst case (~15.6¢) is ~97% margin against a $5 run. Per-run cost is
**not** the thing to worry about.

## The number that matters: cost per visitor / blended CAC

You pay the free funnel (score + audit ≈ **2.9¢**) for *every* visitor, whether
they convert or not. So:

```
AI cost per visitor          = free_funnel               (≈ 2.9¢, constant)
blended AI cost per customer = free_funnel / conversion  +  runs × tailor_cost
```

It's a `1/conversion` curve — at 5% → ~64¢/customer, at 2% → ~$1.50, at 1% →
~$2.96 (2 runs each). Cost-per-visitor is flat regardless of conversion, so
this is the line that scales with traffic and is the real exposure when buying
ads into a low-converting funnel. Raising conversion is a cost lever, not just
a revenue one.

## Levers (largest first)

1. **Downgrade the fit-score model**: `OPENAI_MODEL_SCORE=gpt-4.1-mini` roughly
   halves free-funnel cost (and ~75% of total at typical mixes), since the
   premium `gpt-4.1` score call fires for every visitor. Tradeoff: score
   calibration accuracy — A/B before committing.
2. **Reuse the score for the audit**: the wizard runs `mode:score` then
   `mode:audit`, and `runAudit` re-computes `scoreFit`. Caching/passing the
   score into the audit removes one `gpt-4.1` call per visitor with no quality
   loss.
3. **Feedback caching** (already shipped): unchanged re-runs cost $0. Higher
   cache-hit rate → lower feedback cost.
4. **Raise conversion**: directly lowers blended cost per paying customer.

## Make it empirical

Once `ai_runs` has a week of traffic, replace every estimate above:

```sql
select feature,
       count(*)                              as runs,
       round(avg(estimated_cost_cents), 4)   as avg_cents,
       round(avg(input_tokens))              as avg_in,
       round(avg(output_tokens))             as avg_out,
       round(avg(latency_ms))                as avg_ms
from ai_runs
where status = 'completed'
group by feature
order by avg_cents desc;
```

And blended cost per active user:

```sql
select round(sum(estimated_cost_cents) / nullif(count(distinct user_id), 0), 3)
         as cents_per_active_user
from ai_runs
where created_at > now() - interval '30 days' and user_id is not null;
```
