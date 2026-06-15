import { NextResponse } from "next/server";
import { researchRole } from "@/lib/apply/pipeline";
import { llmConfigured } from "@/lib/config";
import { MAX_POSTING_CHARS, ROLE_CONTEXT_RULES, rateLimitDisabled } from "@/lib/limits";
import { consume, getClientIp, tooManyRequests } from "@/lib/rate-limit";
import type { RoleContext } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 30;

// Shown only in demo mode (no provider configured), clearly as an example.
const SAMPLE_ROLE_CONTEXT: RoleContext = {
  role: "Senior Product Manager",
  seniority: "Senior · 6–8+ years",
  responsibilities: [
    "Own product strategy and roadmap for a major area",
    "Lead discovery and prioritization with engineering and design",
    "Define success metrics and drive outcomes, not just output",
    "Align stakeholders and communicate trade-offs to leadership",
  ],
  typicalSkills: [
    "Product strategy", "Roadmapping", "A/B testing", "SQL / analytics",
    "User research", "Agile / Scrum", "Stakeholder management", "OKRs",
  ],
  keywords: [
    "product roadmap", "go-to-market", "experimentation", "data-driven",
    "cross-functional", "user research", "KPIs", "prioritization",
  ],
  commonGaps: [
    "Outcomes stated as features shipped, not business impact",
    "No quantified metrics (growth, retention, revenue)",
    "Strategy/ownership scope unclear vs. execution-only work",
  ],
};

// Fast, candidate-independent context about the target role so the loading
// screen reflects the real target and the fit analysis is grounded.
export async function POST(request: Request) {
  if (!rateLimitDisabled) {
    const rl = consume(`rolectx:${getClientIp(request)}`, ROLE_CONTEXT_RULES);
    if (!rl.allowed) {
      return tooManyRequests("Too many requests — please wait a moment.", rl.resetAt);
    }
  }

  let body: { target?: unknown };
  try {
    body = (await request.json()) as { target?: unknown };
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const target = typeof body.target === "string" ? body.target.trim() : "";
  if (!target) {
    return NextResponse.json({ error: "No target role provided." }, { status: 400 });
  }
  if (target.length > MAX_POSTING_CHARS) {
    return NextResponse.json({ error: "That input is too long." }, { status: 413 });
  }

  if (!llmConfigured) {
    return NextResponse.json({ demo: true, context: SAMPLE_ROLE_CONTEXT });
  }

  try {
    const context = await researchRole(target.slice(0, MAX_POSTING_CHARS));
    return NextResponse.json({ context });
  } catch {
    return NextResponse.json(
      { error: "Couldn’t research that role right now." },
      { status: 502 },
    );
  }
}
