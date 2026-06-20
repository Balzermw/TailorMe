import { NextResponse } from "next/server";
import { fetchPostingText, PostingFetchError } from "@/lib/fetch-posting";
import { FETCH_POSTING_RULES, rateLimitDisabled } from "@/lib/limits";
import { consume, getClientIp, tooManyRequests } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const maxDuration = 20;

// Fetch a job posting from a URL → readable text. SSRF-guarded in fetch-posting.
export async function POST(request: Request) {
  if (!rateLimitDisabled) {
    const rl = consume(`fetch-posting:${getClientIp(request)}`, FETCH_POSTING_RULES);
    if (!rl.allowed) {
      return tooManyRequests(
        "Too many link fetches. Paste the posting text or try again shortly.",
        rl.resetAt,
      );
    }
  }

  let body: { url?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  const url = typeof body.url === "string" ? body.url.trim() : "";
  if (!url) {
    return NextResponse.json({ error: "No URL provided." }, { status: 400 });
  }

  try {
    const { text, title, truncated } = await fetchPostingText(url);
    return NextResponse.json({ text, title, truncated });
  } catch (e) {
    const message =
      e instanceof PostingFetchError
        ? e.message
        : "Couldn't read that link. Paste the posting text instead.";
    return NextResponse.json({ error: message }, { status: 422 });
  }
}
