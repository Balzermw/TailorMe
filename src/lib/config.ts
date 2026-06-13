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

/** True when Stripe Checkout + webhook are wired up. */
export const stripeConfigured = Boolean(STRIPE_SECRET_KEY);
/** True when the webhook can verify signatures and grant credits. */
export const stripeWebhookConfigured = Boolean(
  STRIPE_SECRET_KEY && STRIPE_WEBHOOK_SECRET && SUPABASE_SERVICE_ROLE_KEY,
);
/** True when the Anthropic apply pipeline can run for real. */
export const anthropicConfigured = Boolean(ANTHROPIC_API_KEY);
