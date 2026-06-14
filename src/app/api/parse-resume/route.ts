import { NextResponse } from "next/server";
import { analyze, extractText } from "@/lib/apply/parse";
import { parseResume } from "@/lib/apply/pipeline";
import { llmConfigured } from "@/lib/config";
import { MAX_RESUME_CHARS, PARSE_RULES, rateLimitDisabled } from "@/lib/limits";
import { consume, getClientIp, tooManyRequests } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const maxDuration = 30;

const MAX_BYTES = 8 * 1024 * 1024; // 8 MB

// Parse an uploaded resume into text + heuristic stats. Works without any API
// key (local extraction), so the audit upload is real even in demo mode.
export async function POST(request: Request) {
  // Rate-limit per IP — this path is unauthenticated.
  if (!rateLimitDisabled) {
    const rl = consume(`parse:${getClientIp(request)}`, PARSE_RULES);
    if (!rl.allowed) {
      return tooManyRequests(
        "Too many uploads — please wait a bit before trying again.",
        rl.resetAt,
      );
    }
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: "Expected a file upload." }, { status: 400 });
  }

  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No file provided." }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "File too large (max 8 MB)." }, { status: 413 });
  }

  try {
    const bytes = await file.arrayBuffer();
    const raw = await extractText(file.name, bytes);
    if (!raw.trim()) {
      return NextResponse.json(
        { error: "Couldn’t read any text from that file." },
        { status: 422 },
      );
    }
    // Cap stored/scored text so a huge document can't balloon downstream tokens.
    const truncated = raw.length > MAX_RESUME_CHARS;
    const text = truncated ? raw.slice(0, MAX_RESUME_CHARS) : raw;
    // AI parse → real, accurate profile when a provider is configured; the local
    // heuristic is the demo/offline fallback (and a safety net if the call fails).
    let stats = analyze(text);
    if (llmConfigured) {
      try {
        stats = await parseResume(text);
      } catch {
        /* keep the heuristic result */
      }
    }
    return NextResponse.json({ text, stats, truncated });
  } catch {
    return NextResponse.json(
      { error: "Couldn’t parse that file. Try a PDF, Word, or text file." },
      { status: 422 },
    );
  }
}
