import { NextResponse } from "next/server";
import { llmConfigured } from "@/lib/config";
import { categorizeSkills } from "@/lib/apply/pipeline";
import { getServerSupabase } from "@/lib/supabase/server";
import { EDIT_REVIEW_RULES, rateLimitDisabled } from "@/lib/limits";
import { consume, getClientIp, tooManyRequests } from "@/lib/rate-limit";

// Organize a flat skills list into labeled categories for the categorized resume
// layout. Called on-demand from the editor ("Group with AI"). categorizeSkills is
// faithful by construction — it never invents or drops a skill.

export const runtime = "nodejs";
export const maxDuration = 30;

export async function POST(request: Request) {
  if (!llmConfigured) {
    return NextResponse.json({ demo: true, skillGroups: [] });
  }

  let body: { skills?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  const skills = (Array.isArray(body.skills) ? body.skills : [])
    .map((s) => (typeof s === "string" ? s.trim() : ""))
    .filter(Boolean)
    .slice(0, 60);
  if (skills.length < 4) {
    return NextResponse.json(
      { error: "Add at least four skills to group them." },
      { status: 400 },
    );
  }

  const sb = await getServerSupabase();
  const user = sb ? (await sb.auth.getUser()).data.user : null;

  if (!rateLimitDisabled) {
    const who = user?.id ?? getClientIp(request);
    const res = consume(`group-skills:${who}`, EDIT_REVIEW_RULES);
    if (!res.allowed) {
      return tooManyRequests("You're going very fast. Give it a minute.", res.resetAt);
    }
  }

  try {
    const skillGroups = await categorizeSkills(skills);
    return NextResponse.json({ skillGroups });
  } catch {
    return NextResponse.json(
      { error: "Couldn't group your skills. Try again." },
      { status: 502 },
    );
  }
}
