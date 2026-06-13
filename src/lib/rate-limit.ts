// In-memory fixed-window rate limiter.
//
// Works on a SINGLE instance (e.g. one VPS Node process — TailorMe's target).
// For multi-instance or serverless deploys, back `consume` with a shared store
// (a Supabase table or Upstash Redis) behind the same interface — the call
// sites don't change. `now` is injectable for testing.

interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();
let lastPrune = 0;

export interface Rule {
  limit: number;
  windowMs: number;
}

export interface RateResult {
  allowed: boolean;
  remaining: number; // tightest remaining across the rules
  resetAt: number; // epoch ms when the failing/tightest window resets
}

function prune(now: number) {
  if (now - lastPrune < 60_000) return;
  lastPrune = now;
  for (const [k, b] of buckets) if (b.resetAt <= now) buckets.delete(k);
}

/**
 * Count one request for `key` against every rule. Returns allowed=false if any
 * window is exceeded. Fixed window: a window's reset time is set when it opens
 * and not extended by further requests.
 */
export function consume(
  key: string,
  rules: Rule[],
  now: number = Date.now(),
): RateResult {
  prune(now);
  let allowed = true;
  let remaining = Infinity;
  let resetAt = now;
  rules.forEach((rule, i) => {
    const bk = `${key}#${i}`;
    let b = buckets.get(bk);
    if (!b || b.resetAt <= now) {
      b = { count: 0, resetAt: now + rule.windowMs };
      buckets.set(bk, b);
    }
    b.count += 1;
    if (b.count > rule.limit) {
      allowed = false;
      resetAt = b.resetAt;
    }
    remaining = Math.min(remaining, rule.limit - b.count);
  });
  return { allowed, remaining: Math.max(0, remaining), resetAt };
}

/** Best-effort client IP from common proxy headers (set by your reverse proxy). */
export function getClientIp(req: Request): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0]!.trim();
  return (
    req.headers.get("x-real-ip") ||
    req.headers.get("cf-connecting-ip") ||
    "local"
  );
}

/** Build a 429 JSON response with a Retry-After header from a RateResult. */
export function tooManyRequests(message: string, resetAt: number): Response {
  const retry = Math.max(1, Math.ceil((resetAt - Date.now()) / 1000));
  return new Response(JSON.stringify({ error: message, rateLimited: true }), {
    status: 429,
    headers: {
      "Content-Type": "application/json",
      "Retry-After": String(retry),
    },
  });
}

// Test-only: clear all counters between cases.
export function _resetForTests() {
  buckets.clear();
  lastPrune = 0;
}
