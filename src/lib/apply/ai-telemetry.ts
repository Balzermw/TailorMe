import "server-only";
import { getServiceSupabase } from "@/lib/supabase/server";
import { getUsage, resetUsage } from "./llm";

// Server-side AI usage/cost/cache telemetry. One ai_runs row per attempt with
// status completed | cached | failed. NEVER stores résumé/job text, prompts,
// responses, or PII — only counts, tokens, cost, latency, and the feature.
// Written with the service role; no-ops when telemetry isn't configured.

export type AiFeature =
  | "feedback"
  | "group_skills"
  | "structure"
  | "tailor"
  | "score"
  | "audit";

export interface AiRunCtx {
  userId?: string | null;
  sessionId?: string | null;
  metadata?: Record<string, string | number | boolean>;
}

interface AiRunRow extends AiRunCtx {
  feature: AiFeature;
  status: "completed" | "cached" | "failed";
  cacheHit?: boolean;
  latencyMs?: number;
  inputTokens?: number;
  outputTokens?: number;
  estimatedCostCents?: number;
  provider?: string | null;
  model?: string | null;
  errorCode?: string | null;
}

export async function logAiRun(row: AiRunRow): Promise<void> {
  const svc = getServiceSupabase();
  if (!svc) return;
  try {
    await svc.from("ai_runs").insert({
      feature: row.feature,
      status: row.status,
      user_id: row.userId ?? null,
      session_id: row.sessionId ?? null,
      cache_hit: row.cacheHit ?? false,
      latency_ms: row.latencyMs ?? null,
      input_tokens: row.inputTokens ?? null,
      output_tokens: row.outputTokens ?? null,
      estimated_cost_cents: row.estimatedCostCents ?? null,
      provider: row.provider ?? null,
      model: row.model ?? null,
      error_code: row.errorCode ?? null,
      metadata: row.metadata ?? {},
    });
  } catch {
    /* best-effort telemetry */
  }
}

/** Record that a cache hit avoided an LLM call (no tokens spent). */
export function logCachedRun(feature: AiFeature, ctx: AiRunCtx, latencyMs?: number): void {
  void logAiRun({ feature, status: "cached", cacheHit: true, latencyMs, ...ctx });
}

/**
 * Run an LLM-calling function and record one ai_runs row with its measured
 * tokens/cost/latency (via resetUsage/getUsage) and status. Re-throws so the
 * caller's normal error handling is unchanged.
 *
 * Note: getUsage()/resetUsage() are process-global, so under heavy concurrency
 * on a single long-running instance the token attribution is approximate; on
 * per-request serverless it's exact. Good enough for MVP cost decisions.
 */
export async function withAiRun<T>(
  feature: AiFeature,
  ctx: AiRunCtx,
  fn: () => Promise<T>,
): Promise<T> {
  resetUsage();
  const started = Date.now();
  try {
    const result = await fn();
    const u = getUsage();
    void logAiRun({
      feature,
      status: "completed",
      cacheHit: false,
      latencyMs: Date.now() - started,
      inputTokens: u.inputTokens,
      outputTokens: u.outputTokens,
      estimatedCostCents: Math.round(u.costUsd * 100 * 1e4) / 1e4,
      provider: u.calls[0]?.provider ?? null,
      model: u.calls[0]?.model ?? null,
      ...ctx,
    });
    return result;
  } catch (e) {
    void logAiRun({
      feature,
      status: "failed",
      latencyMs: Date.now() - started,
      errorCode: e instanceof Error ? e.name.slice(0, 60) : "error",
      ...ctx,
    });
    throw e;
  }
}
