// Central configuration + integration mode detection.
//
// Each integration is "configured" only when its keys are present. When not
// configured, the app falls back to simulated demo behavior so every page
// keeps working with no credentials. NEXT_PUBLIC_* values are safe on the
// client; the rest are server-only (undefined in the browser).

// ---------- public (client + server) ----------
export const PUBLIC_SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
export const PUBLIC_SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

/** True when Supabase auth/DB is wired up (drives real auth vs demo session). */
export const supabaseConfigured = Boolean(
  PUBLIC_SUPABASE_URL && PUBLIC_SUPABASE_ANON_KEY,
);

export const APP_URL =
  process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") || "http://localhost:3000";

// ---------- server-only ----------
export const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
export const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;
export const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET;
export const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
export const ANTHROPIC_MODEL =
  process.env.ANTHROPIC_MODEL || "claude-sonnet-4-6";

// ---------- LLM provider selection ----------
// Which provider the /apply pipeline uses: "anthropic" (default) or "openai".
export const LLM_PROVIDER: "anthropic" | "openai" =
  (process.env.LLM_PROVIDER || "anthropic").toLowerCase() === "openai"
    ? "openai"
    : "anthropic";

export const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
// Per-use-case OpenAI models. The n=7 judge tournament showed gpt-4.1-mini is the
// best value for tailoring — it actually OUT-scored full gpt-4.1 (higher
// faithfulness, ~1/5 the cost) — so mini is the default for both the structured
// score/review steps and the quality-sensitive tailor step. Override via env to
// trade up (e.g. OPENAI_MODEL_TAILOR=gpt-5.4 for the strongest OpenAI output).
export const OPENAI_MODEL_TAILOR =
  process.env.OPENAI_MODEL_TAILOR || "gpt-4.1-mini";
export const OPENAI_MODEL_FAST =
  process.env.OPENAI_MODEL_FAST || "gpt-4.1-mini";
// Fit scoring needs an honest, calibrated model — gpt-4.1-mini rubber-stamps it
// (marks 0 missing keywords, never flags gaps, never recommends review), so the
// score step defaults to gpt-4.1. Bump to a stronger model (e.g. gpt-5.4 / Opus
// via LLM_PROVIDER) through OPENAI_MODEL_SCORE for maximum honesty.
export const OPENAI_MODEL_SCORE =
  process.env.OPENAI_MODEL_SCORE || "gpt-4.1";

/** True when Stripe Checkout + webhook are wired up. */
export const stripeConfigured = Boolean(STRIPE_SECRET_KEY);
/** True when the webhook can verify signatures and grant credits. */
export const stripeWebhookConfigured = Boolean(
  STRIPE_SECRET_KEY && STRIPE_WEBHOOK_SECRET && SUPABASE_SERVICE_ROLE_KEY,
);
export const anthropicConfigured = Boolean(ANTHROPIC_API_KEY);
export const openaiConfigured = Boolean(OPENAI_API_KEY);

/** True when the *configured* provider's key is present (gates real vs demo). */
export const llmConfigured =
  LLM_PROVIDER === "openai" ? openaiConfigured : anthropicConfigured;

// ---------- paid-tier tailor override ----------
// The free audit and the internal score/review steps run on the cheap base
// provider (LLM_PROVIDER above). The paid full run's tailor step — the actual
// customer deliverable — runs on a premium model for faithfulness. The n=7
// judge tournament picked Claude Opus 4.8 as the most faithful, recruiter-safe
// tailor (faithfulness 92 vs gpt-4.1-mini's 83). The pipeline falls back to the
// base provider if this provider's key is absent.
export const TAILOR_PROVIDER: "anthropic" | "openai" =
  (process.env.TAILOR_PROVIDER || "anthropic").toLowerCase() === "openai"
    ? "openai"
    : "anthropic";
export const TAILOR_MODEL = process.env.TAILOR_MODEL || "claude-opus-4-8";
export const tailorProviderConfigured =
  TAILOR_PROVIDER === "openai" ? openaiConfigured : anthropicConfigured;

/** Enables the side-by-side /api/compare eval route (off by default). */
export const compareEnabled = process.env.COMPARE_ENABLED === "1";
