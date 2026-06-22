import { NextResponse } from "next/server";
import { getServerSupabase, getServiceSupabase } from "@/lib/supabase/server";

// Product telemetry sink. The browser may ONLY reach product_events through
// here — the table denies direct public access (RLS, no policies), and this
// route validates + sanitizes, sets user_id server-side, and writes with the
// service role. Stores allowlisted event names + small primitive props only —
// never résumé/job content or PII. Fire-and-forget: always 204, never throws.

export const runtime = "nodejs";

const ALLOWED = new Set([
  "chooser_select",
  "resume_import_start",
  "resume_import_success",
  "resume_import_failed",
  "start_from_scratch",
  "template_select",
  "feedback_click",
  "target_job_click",
  "tailor_click",
  "pdf_click",
  "pricing_view",
  "checkout_start",
  "checkout_success",
  "credit_gate_shown",
  "limit_hit",
]);

const MAX_BATCH = 10;
const MAX_BODY = 8_000; // reject oversized payloads (chars ≈ bytes for this JSON)

// Props may only contain small, safe primitives — drop everything else.
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

const noContent = () => new NextResponse(null, { status: 204 });

export async function POST(request: Request) {
  if (Number(request.headers.get("content-length") || 0) > MAX_BODY) return noContent();
  let raw: string;
  try {
    raw = await request.text();
  } catch {
    return noContent();
  }
  if (raw.length > MAX_BODY) return noContent();

  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return noContent();
  }

  // One event or an array of up to MAX_BATCH.
  const list = Array.isArray(body) ? body : [body];
  if (!list.length || list.length > MAX_BATCH) return noContent();

  const rows: {
    name: string;
    session_id: string;
    props: Record<string, string | number | boolean>;
  }[] = [];
  for (const e of list) {
    if (!e || typeof e !== "object") continue;
    const ev = e as Record<string, unknown>;
    const name = typeof ev.name === "string" ? ev.name : "";
    const sessionId = typeof ev.sessionId === "string" ? ev.sessionId.slice(0, 64) : "";
    if (!ALLOWED.has(name) || !sessionId) continue; // ignore invalid, don't break UX
    rows.push({ name, session_id: sessionId, props: sanitizeProps(ev.props) });
  }
  if (!rows.length) return noContent();

  const svc = getServiceSupabase();
  if (!svc) return noContent(); // no service key / demo → drop silently

  // user_id comes from the session, never the client.
  let userId: string | null = null;
  try {
    const sb = await getServerSupabase();
    if (sb) userId = (await sb.auth.getUser()).data.user?.id ?? null;
  } catch {
    /* anon */
  }

  try {
    await svc.from("product_events").insert(rows.map((r) => ({ ...r, user_id: userId })));
  } catch {
    /* best-effort telemetry */
  }
  return noContent();
}
