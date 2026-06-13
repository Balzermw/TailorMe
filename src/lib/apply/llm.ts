import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";
import {
  ANTHROPIC_API_KEY,
  ANTHROPIC_MODEL,
  LLM_PROVIDER,
  OPENAI_API_KEY,
  OPENAI_MODEL_FAST,
  OPENAI_MODEL_TAILOR,
} from "@/lib/config";

// Provider-agnostic structured-output call. The /apply pipeline calls
// `structured()` for each step; this routes to Anthropic (forced tool use) or
// OpenAI (Structured Outputs / json_schema) and records token usage so the
// comparison route can report real cost per provider.

export type Provider = "anthropic" | "openai";
export type Step = "score" | "tailor" | "review";
type JsonSchema = Record<string, unknown>;

const anthropic = ANTHROPIC_API_KEY
  ? new Anthropic({ apiKey: ANTHROPIC_API_KEY })
  : null;
const openai = OPENAI_API_KEY ? new OpenAI({ apiKey: OPENAI_API_KEY }) : null;

// $/token by model (per 1M ÷ 1e6). Used by the comparison route's cost report.
const RATES: Record<string, { in: number; out: number }> = {
  // Anthropic
  "claude-haiku-4-5": { in: 1 / 1e6, out: 5 / 1e6 },
  "claude-sonnet-4-6": { in: 3 / 1e6, out: 15 / 1e6 },
  "claude-opus-4-8": { in: 5 / 1e6, out: 25 / 1e6 },
  "claude-fable-5": { in: 10 / 1e6, out: 50 / 1e6 },
  // OpenAI
  "gpt-4.1-nano": { in: 0.1 / 1e6, out: 0.4 / 1e6 },
  "gpt-4.1-mini": { in: 0.4 / 1e6, out: 1.6 / 1e6 },
  "gpt-4.1": { in: 2 / 1e6, out: 8 / 1e6 },
  "o4-mini": { in: 0.55 / 1e6, out: 2.2 / 1e6 },
  "gpt-5.4": { in: 2.5 / 1e6, out: 15 / 1e6 },
  "gpt-5.5": { in: 5 / 1e6, out: 30 / 1e6 },
};

export interface CallRecord {
  provider: Provider;
  model: string;
  step: Step;
  inputTokens: number;
  outputTokens: number;
}

let records: CallRecord[] = [];
export function resetUsage() {
  records = [];
}
export function getUsage(): {
  calls: CallRecord[];
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
} {
  let inputTokens = 0;
  let outputTokens = 0;
  let costUsd = 0;
  for (const r of records) {
    inputTokens += r.inputTokens;
    outputTokens += r.outputTokens;
    const rate = RATES[r.model];
    if (rate) costUsd += r.inputTokens * rate.in + r.outputTokens * rate.out;
  }
  return { calls: records.slice(), inputTokens, outputTokens, costUsd };
}

function openaiModel(step: Step): string {
  return step === "tailor" ? OPENAI_MODEL_TAILOR : OPENAI_MODEL_FAST;
}

/**
 * Make a shared JSON schema valid for OpenAI strict Structured Outputs:
 * every object needs `additionalProperties: false` and all keys in `required`.
 * Returns a deep copy; the originals (used by the Anthropic path) are untouched.
 */
export function toStrictSchema(schema: JsonSchema): JsonSchema {
  if (Array.isArray(schema)) {
    return schema.map((s) => toStrictSchema(s as JsonSchema)) as unknown as JsonSchema;
  }
  if (!schema || typeof schema !== "object") return schema;
  const out: JsonSchema = {};
  for (const [k, v] of Object.entries(schema)) {
    out[k] = v && typeof v === "object" ? toStrictSchema(v as JsonSchema) : v;
  }
  if (out.type === "object" && out.properties && typeof out.properties === "object") {
    out.required = Object.keys(out.properties as Record<string, unknown>);
    out.additionalProperties = false;
  }
  return out;
}

export interface StructuredOpts {
  step: Step;
  system: string;
  user: string;
  name: string;
  description: string;
  schema: JsonSchema;
  maxTokens?: number;
  provider?: Provider; // override the configured provider (used by /api/compare)
  model?: string; // override the model (used by the /api/eval model sweep)
}

export async function structured<T>(opts: StructuredOpts): Promise<T> {
  const provider = opts.provider ?? LLM_PROVIDER;
  const maxTokens = opts.maxTokens ?? 2400;

  if (provider === "openai") {
    if (!openai) throw new Error("OpenAI not configured");
    const model = opts.model ?? openaiModel(opts.step);
    const resp = await openai.chat.completions.create({
      model,
      max_completion_tokens: maxTokens,
      messages: [
        { role: "system", content: opts.system },
        { role: "user", content: opts.user },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: opts.name,
          strict: true,
          schema: toStrictSchema(opts.schema),
        },
      },
    });
    records.push({
      provider,
      model,
      step: opts.step,
      inputTokens: resp.usage?.prompt_tokens ?? 0,
      outputTokens: resp.usage?.completion_tokens ?? 0,
    });
    const content = resp.choices[0]?.message?.content;
    if (!content) throw new Error("No structured output returned");
    return JSON.parse(content) as T;
  }

  // ---- anthropic (default) ----
  if (!anthropic) throw new Error("Anthropic not configured");
  const model = opts.model ?? ANTHROPIC_MODEL;
  const msg = await anthropic.messages.create({
    model,
    max_tokens: maxTokens,
    system: opts.system,
    tools: [
      {
        name: opts.name,
        description: opts.description,
        input_schema: opts.schema as Anthropic.Tool.InputSchema,
      },
    ],
    tool_choice: { type: "tool", name: opts.name },
    messages: [{ role: "user", content: opts.user }],
  });
  records.push({
    provider,
    model,
    step: opts.step,
    inputTokens: msg.usage?.input_tokens ?? 0,
    outputTokens: msg.usage?.output_tokens ?? 0,
  });
  const block = msg.content.find((b) => b.type === "tool_use");
  if (!block || block.type !== "tool_use") {
    throw new Error("No structured output returned");
  }
  return block.input as T;
}
