import { afterEach, describe, expect, it, vi } from "vitest";

// config.ts computes its flags at import time, so each case resets the module
// registry and re-imports with a fresh env.
async function loadConfig(env: Record<string, string | undefined>) {
  vi.resetModules();
  for (const [k, v] of Object.entries(env)) {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
  return import("./config");
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("config mode detection", () => {
  it("supabaseConfigured requires both url and anon key", async () => {
    let c = await loadConfig({
      NEXT_PUBLIC_SUPABASE_URL: "https://x.supabase.co",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon",
    });
    expect(c.supabaseConfigured).toBe(true);

    c = await loadConfig({
      NEXT_PUBLIC_SUPABASE_URL: "https://x.supabase.co",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: undefined,
    });
    expect(c.supabaseConfigured).toBe(false);
  });

  it("stripe + anthropic flags follow their keys", async () => {
    let c = await loadConfig({
      STRIPE_SECRET_KEY: "sk_test_x",
      STRIPE_WEBHOOK_SECRET: "whsec_x",
      SUPABASE_SERVICE_ROLE_KEY: "svc",
      NEXT_PUBLIC_SUPABASE_URL: "https://x.supabase.co",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon",
      ANTHROPIC_API_KEY: "sk-ant-x",
    });
    expect(c.stripeConfigured).toBe(true);
    expect(c.stripeWebhookConfigured).toBe(true);
    expect(c.anthropicConfigured).toBe(true);

    c = await loadConfig({
      STRIPE_SECRET_KEY: undefined,
      STRIPE_WEBHOOK_SECRET: undefined,
      SUPABASE_SERVICE_ROLE_KEY: undefined,
      ANTHROPIC_API_KEY: undefined,
    });
    expect(c.stripeConfigured).toBe(false);
    expect(c.stripeWebhookConfigured).toBe(false);
    expect(c.anthropicConfigured).toBe(false);
  });

  it("defaults the model and normalizes APP_URL", async () => {
    const c = await loadConfig({
      ANTHROPIC_MODEL: undefined,
      NEXT_PUBLIC_APP_URL: "https://tailorme.app/",
    });
    expect(c.ANTHROPIC_MODEL).toBe("claude-sonnet-4-6");
    expect(c.APP_URL).toBe("https://tailorme.app");
  });
});
