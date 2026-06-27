import { NextResponse } from "next/server";
import { llmConfigured } from "@/lib/config";
import { categorizeSkills } from "@/lib/apply/pipeline";
import { withAiRun } from "@/lib/apply/ai-telemetry";
import { getServerSupabase } from "@/lib/supabase/server";
import { EDIT_REVIEW_RULES, rateLimitDisabled } from "@/lib/limits";
import { consume, getClientIp, tooManyRequests } from "@/lib/rate-limit";

// Organize a flat skills list into labeled categories for the categorized resume
// layout. Called on-demand from the editor ("Group with AI"). categorizeSkills is
// faithful by construction — it never invents or drops a skill.

type SkillGroup = { label: string; skills: string[] };

const FALLBACK_BUCKETS: { label: string; pattern: RegExp }[] = [
  {
    label: "Project & Program Management",
    pattern: /project|program|roadmap|scope|timeline|requirement|quality|risk|planning/i,
  },
  {
    label: "Agile & Delivery",
    pattern: /agile|scrum|kanban|sprint|workflow|automation|process|sop|delivery/i,
  },
  {
    label: "Communication & Stakeholders",
    pattern:
      /communication|presentation|client|executive|verbal|written|negotiation|public speaking|conflict|training|documentation|stakeholder/i,
  },
  {
    label: "Operations & Supply Chain",
    pattern: /procurement|logistics|supply chain|forecasting|kpi|tracking|reporting|inventory|vendor|compliance|assurance/i,
  },
  {
    label: "Tools & Platforms",
    pattern:
      /jira|confluence|asana|monday|smartsheet|excel|salesforce|sap|sql|tableau|power bi|aws|azure|python|react|codex/i,
  },
];

function fallbackCategorizeSkills(skills: string[]): SkillGroup[] {
  const buckets = new Map<string, string[]>();
  for (const { label } of FALLBACK_BUCKETS) buckets.set(label, []);
  buckets.set("Additional Skills", []);

  for (const skill of skills) {
    const bucket = FALLBACK_BUCKETS.find(({ pattern }) => pattern.test(skill));
    buckets.get(bucket?.label ?? "Additional Skills")?.push(skill);
  }

  return Array.from(buckets.entries())
    .map(([label, items]) => ({ label, skills: items }))
    .filter((group) => group.skills.length > 0);
}

export const runtime = "nodejs";
export const maxDuration = 30;

export async function POST(request: Request) {
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

  const fallbackGroups = fallbackCategorizeSkills(skills);
  if (!llmConfigured) {
    return NextResponse.json({
      demo: true,
      fallback: true,
      skillGroups: fallbackGroups,
      warning: "AI grouping is not configured locally, so these were grouped with a local fallback.",
    });
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
    const skillGroups = await withAiRun(
      "group_skills",
      { userId: user?.id ?? null, sessionId: request.headers.get("x-tm-session") },
      () => categorizeSkills(skills),
    );
    return NextResponse.json({ skillGroups: skillGroups.length ? skillGroups : fallbackGroups });
  } catch {
    return NextResponse.json({
      fallback: true,
      skillGroups: fallbackGroups,
      warning: "AI grouping had trouble, so these were grouped locally instead.",
    });
  }
}
