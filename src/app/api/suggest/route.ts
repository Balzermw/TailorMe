import { NextResponse } from "next/server";
import { llmConfigured } from "@/lib/config";
import { structured } from "@/lib/apply/llm";
import { getServerSupabase } from "@/lib/supabase/server";
import { SUGGEST_RULES, rateLimitDisabled } from "@/lib/limits";
import { consume, getClientIp, tooManyRequests } from "@/lib/rate-limit";

// Inline "Improve this line" suggestions for the editor. One cheap-model call
// per click returns 2-3 grounded rewrites of a single bullet. Anything that
// introduces a new fact (a drafted metric, a stretched keyword) comes back
// flagged `drafted` so the UI can ask the user to confirm it is true.

export const runtime = "nodejs";
export const maxDuration = 30;

type SuggestionType = "stronger" | "metric" | "keyword";
interface Suggestion {
  type: SuggestionType;
  text: string;
  why: string;
  drafted: boolean;
}

const SCHEMA = {
  type: "object",
  properties: {
    suggestions: {
      type: "array",
      items: {
        type: "object",
        properties: {
          type: { type: "string", enum: ["stronger", "metric", "keyword"] },
          text: { type: "string" },
          why: { type: "string" },
          drafted: { type: "boolean" },
        },
      },
    },
  },
};

const SYSTEM = `You improve a single resume bullet for a target role. Return 2-3 alternative rewrites, each a single line.

Each suggestion has a "type":
- "stronger": same facts, sharper wording. Lead with a strong action verb, active voice, cut filler. Do not add any fact the bullet does not already state. Set drafted=false.
- "metric": add a quantified result (a %, a count, a time saved, a scale). You MAY propose a realistic example number, but then you MUST set drafted=true so the user can confirm or correct it. Inserting a blank such as "__%" also counts as drafted=true.
- "keyword": work in a keyword relevant to the target role. If the bullet's existing content clearly supports it, set drafted=false; if it implies new work, set drafted=true.

Rules:
- Keep each rewrite under ~32 words, one sentence.
- Never invent employers, job titles, dates, or technologies the bullet does not mention. For "keyword", use only keywords from the provided list.
- "why" is a short phrase (at most 12 words) describing what improved.
- Do not return the original bullet unchanged.`;

function buildUser(text: string, role: string, keywords: string[]): string {
  const kw = keywords.length ? keywords.join(", ") : "(none provided)";
  return `Target role: ${role || "(unspecified)"}
Keywords relevant to this role: ${kw}

Bullet to improve:
"""${text}"""`;
}

export async function POST(request: Request) {
  // No provider configured -> the editor keeps working, just without AI help.
  if (!llmConfigured) {
    return NextResponse.json({ demo: true, suggestions: [] });
  }

  let body: { kind?: string; text?: string; role?: string; keywords?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const text = (body.text ?? "").trim();
  if (text.length < 8) {
    return NextResponse.json(
      { error: "Write a little more first." },
      { status: 400 },
    );
  }
  if (text.length > 600) {
    return NextResponse.json(
      { error: "That line is too long to improve." },
      { status: 400 },
    );
  }
  const role = typeof body.role === "string" ? body.role.slice(0, 160) : "";
  const keywords = Array.isArray(body.keywords)
    ? body.keywords
        .filter((k): k is string => typeof k === "string")
        .slice(0, 16)
    : [];

  // Rate-limit per signed-in user, falling back to client IP.
  if (!rateLimitDisabled) {
    const supabase = await getServerSupabase();
    let who = getClientIp(request);
    if (supabase) {
      const { data } = await supabase.auth.getUser();
      if (data.user?.id) who = data.user.id;
    }
    const res = consume(`suggest:${who}`, SUGGEST_RULES);
    if (!res.allowed) {
      return tooManyRequests(
        "You're improving lines very fast. Give it a minute.",
        res.resetAt,
      );
    }
  }

  try {
    const out = await structured<{ suggestions: Suggestion[] }>({
      step: "review", // -> OPENAI_MODEL_FAST (low cost)
      system: SYSTEM,
      user: buildUser(text, role, keywords),
      name: "line_suggestions",
      description: "Two or three improved rewrites of a single resume bullet.",
      schema: SCHEMA,
      maxTokens: 600,
    });
    const suggestions = (out.suggestions ?? [])
      .filter((s) => s && typeof s.text === "string" && s.text.trim())
      .slice(0, 3)
      .map((s) => ({
        type: (["stronger", "metric", "keyword"].includes(s.type)
          ? s.type
          : "stronger") as SuggestionType,
        text: s.text.trim().slice(0, 400),
        why: (typeof s.why === "string" ? s.why : "").trim().slice(0, 120),
        drafted: !!s.drafted,
      }));
    return NextResponse.json({ suggestions });
  } catch {
    return NextResponse.json(
      { error: "Could not get suggestions. Try again." },
      { status: 502 },
    );
  }
}
