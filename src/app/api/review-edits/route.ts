import { NextResponse } from "next/server";
import { llmConfigured } from "@/lib/config";
import { structured } from "@/lib/apply/llm";
import { getServerSupabase } from "@/lib/supabase/server";
import { EDIT_REVIEW_RULES, rateLimitDisabled } from "@/lib/limits";
import { consume, getClientIp, tooManyRequests } from "@/lib/rate-limit";

// "Review my edits": the resume was already tailored by the AI agents. When the
// user hand-edits lines, this reviews THEIR changes against the AI original and
// flags edits that dropped a metric/keyword, got vaguer, or introduced an error.
// One cheap-model call covers all changes in a batch.

export const runtime = "nodejs";
export const maxDuration = 30;

type Verdict = "improved" | "okay" | "risky";
interface Change {
  id: string;
  kind: "summary" | "bullet";
  original: string;
  edited: string;
}
interface Review {
  id: string;
  verdict: Verdict;
  note: string;
}

const SCHEMA = {
  type: "object",
  properties: {
    reviews: {
      type: "array",
      items: {
        type: "object",
        properties: {
          id: { type: "string" },
          verdict: { type: "string", enum: ["improved", "okay", "risky"] },
          note: { type: "string" },
        },
      },
    },
  },
};

const SYSTEM = `A resume was already tailored and improved by an AI review. The user then hand-edited some lines. Your job is to review THE USER'S EDITS, not to rewrite the resume.

For each change you get the AI's original line and the user's edited version. Classify the edit:
- "improved": it keeps the strengths (keywords, numbers, strong verbs) or genuinely improves clarity or accuracy.
- "okay": it is acceptable but not clearly stronger, or it drops a minor strength without creating a real risk.
- "risky": it dropped a key metric or role keyword, got vaguer, has a typo, broke formatting, or introduced a likely-false claim.

For "note": one specific sentence naming what actually changed (for example "You dropped the 2.4M transactions figure" or "Reads cleaner and keeps Kubernetes"). Be honest but encouraging. Keep notes under 24 words. Return exactly one entry per change, reusing the given id.`;

function buildUser(changes: Change[], role: string, keywords: string[]): string {
  const kw = keywords.length ? keywords.join(", ") : "(none)";
  const blocks = changes
    .map(
      (c) =>
        `id: ${c.id} (${c.kind})\nAI original: """${c.original || "(new line, no AI original)"}"""\nUser edit: """${c.edited}"""`,
    )
    .join("\n\n");
  return `Target role: ${role || "(unspecified)"}\nRole keywords: ${kw}\n\nChanges to review:\n\n${blocks}`;
}

export async function POST(request: Request) {
  if (!llmConfigured) {
    return NextResponse.json({ demo: true, reviews: [] });
  }

  let body: {
    changes?: unknown;
    role?: string;
    keywords?: unknown;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const raw = Array.isArray(body.changes) ? body.changes : [];
  const changes: Change[] = raw
    .slice(0, 24)
    .map((c, i): Change => {
      const x = (c ?? {}) as Record<string, unknown>;
      return {
        id: typeof x.id === "string" ? x.id.slice(0, 40) : `c${i}`,
        kind: x.kind === "summary" ? "summary" : "bullet",
        original: typeof x.original === "string" ? x.original.trim().slice(0, 800) : "",
        edited: typeof x.edited === "string" ? x.edited.trim().slice(0, 800) : "",
      };
    })
    .filter((c) => c.edited);
  if (!changes.length) {
    return NextResponse.json({ reviews: [] });
  }

  const role = typeof body.role === "string" ? body.role.slice(0, 160) : "";
  const keywords = Array.isArray(body.keywords)
    ? body.keywords.filter((k): k is string => typeof k === "string").slice(0, 16)
    : [];

  if (!rateLimitDisabled) {
    const supabase = await getServerSupabase();
    let who = getClientIp(request);
    if (supabase) {
      const { data } = await supabase.auth.getUser();
      if (data.user?.id) who = data.user.id;
    }
    const res = consume(`review-edits:${who}`, EDIT_REVIEW_RULES);
    if (!res.allowed) {
      return tooManyRequests(
        "You're reviewing very fast. Give it a minute.",
        res.resetAt,
      );
    }
  }

  try {
    const out = await structured<{ reviews: Review[] }>({
      step: "review", // -> OPENAI_MODEL_FAST (low cost)
      system: SYSTEM,
      user: buildUser(changes, role, keywords),
      name: "edit_review",
      description: "A verdict and a short note for each user edit.",
      schema: SCHEMA,
      maxTokens: 1500,
    });
    const byId = new Map((out.reviews ?? []).map((r) => [r.id, r]));
    const reviews = changes.map((c) => {
      const r = byId.get(c.id);
      const verdict: Verdict =
        r && ["improved", "okay", "risky"].includes(r.verdict) ? r.verdict : "okay";
      return { id: c.id, verdict, note: (r?.note || "").trim().slice(0, 200) };
    });
    return NextResponse.json({ reviews });
  } catch {
    return NextResponse.json(
      { error: "Could not review your edits. Try again." },
      { status: 502 },
    );
  }
}
