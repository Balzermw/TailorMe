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

  it("defaults the LLM provider to anthropic with OpenAI model defaults", async () => {
    const c = await loadConfig({
      LLM_PROVIDER: undefined,
      OPENAI_API_KEY: undefined,
      OPENAI_MODEL_TAILOR: undefined,
      OPENAI_MODEL_FAST: undefined,
      TAILOR_PROVIDER: undefined,
      TAILOR_MODEL: undefined,
      ANTHROPIC_API_KEY: "sk-ant",
    });
    expect(c.LLM_PROVIDER).toBe("anthropic");
    expect(c.OPENAI_MODEL_TAILOR).toBe("gpt-4.1-mini");
    expect(c.OPENAI_MODEL_FAST).toBe("gpt-4.1-mini");
    expect(c.llmConfigured).toBe(true); // anthropic key present
  });

  it("defaults the paid tailor override to Opus 4.8 on Anthropic", async () => {
    const c = await loadConfig({
      TAILOR_PROVIDER: undefined,
      TAILOR_MODEL: undefined,
      ANTHROPIC_API_KEY: "sk-ant",
      OPENAI_API_KEY: undefined,
    });
    expect(c.TAILOR_PROVIDER).toBe("anthropic");
    expect(c.TAILOR_MODEL).toBe("claude-opus-4-8");
    expect(c.tailorProviderConfigured).toBe(true);

    // Override + missing key → not configured (pipeline falls back to base).
    const c2 = await loadConfig({
      TAILOR_PROVIDER: "openai",
      TAILOR_MODEL: "gpt-5.4",
      OPENAI_API_KEY: undefined,
    });
    expect(c2.TAILOR_PROVIDER).toBe("openai");
    expect(c2.TAILOR_MODEL).toBe("gpt-5.4");
    expect(c2.tailorProviderConfigured).toBe(false);
  });

  it("openai provider gates llmConfigured on the OpenAI key", async () => {
    let c = await loadConfig({
      LLM_PROVIDER: "openai",
      OPENAI_API_KEY: undefined,
      ANTHROPIC_API_KEY: "sk-ant",
    });
    expect(c.LLM_PROVIDER).toBe("openai");
    expect(c.llmConfigured).toBe(false); // openai selected, no openai key

    c = await loadConfig({ LLM_PROVIDER: "openai", OPENAI_API_KEY: "sk-openai" });
    expect(c.llmConfigured).toBe(true);
  });
});
