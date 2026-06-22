import { NextResponse } from "next/server";
import { getServerSupabase } from "@/lib/supabase/server";

// Product telemetry sink. Records allowlisted INTERACTION events with small,
// primitive-only props — never résumé content or PII. Fire-and-forget: always
// returns 204 and never throws, so a telemetry failure can't affect the app.

export const runtime = "nodejs";

// Only these event names are stored — anything else is silently dropped.
const ALLOWED = new Set([
  "template_select",
  "feedback_click",
  "group_skills_click",
  "target_job_click",
  "pdf_click",
  "tailor_click",
  "chooser_select",
  "import_structure_click",
]);

// Keep only small primitive props; drop strings that look like free-form content.
function sanitizeProps(input: unknown): Record<string, string | number | boolean> {
  if (!input || typeof input !== "object") return {};
  const out: Record<string, string | number | boolean> = {};
  let i = 0;
  for (const [k, v] of Object.entries(input as Record<string, unknown>)) {
    if (i++ >= 12) break;
    const key = k.slice(0, 40);
    if (typeof v === "string") out[key] = v.slice(0, 80);
    else if (typeof v === "number" && Number.isFinite(v)) out[key] = v;
    else if (typeof v === "boolean") out[key] = v;
  }
  return out;
}

export async function POST(request: Request) {
  let body: { name?: unknown; props?: unknown; sessionId?: unknown };
  try {
    body = await request.json();
  } catch {
    return new NextResponse(null, { status: 204 });
  }
  const name = typeof body.name === "string" ? body.name : "";
  if (!ALLOWED.has(name)) return new NextResponse(null, { status: 204 });

  const sb = await getServerSupabase();
  if (!sb) return new NextResponse(null, { status: 204 }); // demo / no DB: drop

  try {
    const {
      data: { user },
    } = await sb.auth.getUser();
    const sessionId =
      typeof body.sessionId === "string" ? body.sessionId.slice(0, 64) : null;
    await sb.from("events").insert({
      user_id: user?.id ?? null,
      session_id: sessionId,
      name,
      props: sanitizeProps(body.props),
    });
  } catch {
    /* telemetry is best-effort */
  }
  return new NextResponse(null, { status: 204 });
}
