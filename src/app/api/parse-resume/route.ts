import { NextResponse } from "next/server";
import { analyze, extractText, looksScanned } from "@/lib/apply/parse";
import { parseResume } from "@/lib/apply/pipeline";
import { llmConfigured } from "@/lib/config";
import { MAX_RESUME_CHARS, PARSE_RULES, rateLimitDisabled } from "@/lib/limits";
import { consume, getClientIp, tooManyRequests } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const maxDuration = 30;

const MAX_BYTES = 8 * 1024 * 1024; // 8 MB
const requireLiveAiParse = process.env.REQUIRE_LIVE_AI_PARSE === "1";
const ALLOWED_RESUME_EXTENSIONS = new Set(["pdf", "doc", "docx", "txt", "md"]);
const UNSUPPORTED_FILE_MESSAGE =
  "Unsupported file type. Upload a PDF, Word, or text resume file.";

function getExtension(filename: string): string {
  const cleanName = filename.split(/[\\/]/).pop()?.toLowerCase() ?? "";
  const dot = cleanName.lastIndexOf(".");
  return dot >= 0 ? cleanName.slice(dot + 1) : "";
}

// Parse an uploaded resume into text + heuristic stats. Works without any API
// key (local extraction), so the audit upload is real even in demo mode.
export async function POST(request: Request) {
  // Rate-limit per IP — this path is unauthenticated.
  if (!rateLimitDisabled) {
    const rl = consume(`parse:${getClientIp(request)}`, PARSE_RULES);
    if (!rl.allowed) {
      return tooManyRequests(
        "Too many uploads. Please wait a bit before trying again.",
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
  const extension = getExtension(file.name);
  if (!ALLOWED_RESUME_EXTENSIONS.has(extension)) {
    return NextResponse.json(
      { error: UNSUPPORTED_FILE_MESSAGE },
      { status: 415 },
    );
  }

  try {
    const bytes = await file.arrayBuffer();
    const raw = await extractText(file.name, bytes);
    // A scanned/image-only PDF extracts to (near-)nothing. Tell the user plainly
    // instead of feeding empty text to the LLM and returning a useless profile.
    const scanned = file.name.toLowerCase().endsWith(".pdf") && looksScanned(raw);
    if (!raw.trim() || scanned) {
      return NextResponse.json(
        {
          error: scanned
            ? "This PDF looks scanned or image-only, so we couldn’t read its text. Upload a text-based PDF or a Word (.docx) file instead."
            : "Couldn’t read any text from that file.",
          scanned,
        },
        { status: 422 },
      );
    }
    // Cap stored/scored text so a huge document can't balloon downstream tokens.
    const truncated = raw.length > MAX_RESUME_CHARS;
    const text = truncated ? raw.slice(0, MAX_RESUME_CHARS) : raw;
    // AI parse → real, accurate profile when a provider is configured; the local
    // heuristic is the demo/offline fallback (and a safety net if the call fails).
    let stats = analyze(text);
    let degraded = false;
    if (llmConfigured) {
      try {
        stats = await parseResume(text);
      } catch (err) {
        // Don't fail silently: a bad/expired key (or provider outage) would
        // otherwise just serve the weak keyword heuristic with no signal — which
        // looks like "the parser got worse." Log it loudly + flag the response.
        degraded = true;
        if (requireLiveAiParse) {
          console.error(
            "[parse-resume] AI parse failed in strict live mode:",
            err instanceof Error ? err.message : err,
          );
          return NextResponse.json(
            {
              error:
                "Live AI parse unavailable. Check outbound HTTPS connectivity to the configured AI provider, then try again.",
              degraded: true,
            },
            { status: 502 },
          );
        }
        console.error(
          "[parse-resume] AI parse failed — serving heuristic fallback:",
          err instanceof Error ? err.message : err,
        );
      }
    }
    return NextResponse.json({ text, stats, truncated, degraded });
  } catch {
    return NextResponse.json(
      { error: "Couldn’t parse that file. Try a PDF, Word, or text file." },
      { status: 422 },
    );
  }
}
