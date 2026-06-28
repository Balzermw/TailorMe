import { NextResponse } from "next/server";
import { fetchUrlText } from "@/lib/url-fetch";
import { EDIT_REVIEW_RULES, MAX_RESUME_CHARS, rateLimitDisabled } from "@/lib/limits";
import { consume, getClientIp, tooManyRequests } from "@/lib/rate-limit";

// Best-effort import from a link: fetch the page server-side (SSRF-guarded in
// url-fetch.ts), strip it to text, and hand that back so the client structures it
// the same way as pasted text. LinkedIn almost always serves a login wall to a
// bot, so we detect that (and thin pages) and tell the client to fall back to
// guided paste instead of structuring login boilerplate. No LLM here.

export const runtime = "nodejs";
export const maxDuration = 30;

// Minimum readable text to treat a page as a usable profile/resume source.
const MIN_USABLE_CHARS = 220;

// Login/consent walls dominate with sign-in copy instead of profile content.
const AUTH_WALL = /sign in|join now|new to linkedin|join to view|make the most of your professional life|log in to continue|create your free account|you('|’)re signed out/i;

function looksUnusable(text: string): boolean {
  if (text.trim().length < MIN_USABLE_CHARS) return true;
  // An auth wall is short on signal: if sign-in copy is present and the page is
  // small, it's a wall, not a profile.
  return AUTH_WALL.test(text) && text.length < 1500;
}

export async function POST(request: Request) {
  let body: { url?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  const url = (body.url ?? "").trim();
  if (!url) {
    return NextResponse.json({ error: "Add a link first." }, { status: 400 });
  }

  if (!rateLimitDisabled) {
    const res = consume(`resume-from-url:${getClientIp(request)}`, EDIT_REVIEW_RULES);
    if (!res.allowed) {
      return tooManyRequests("You're fetching links very fast. Give it a minute.", res.resetAt);
    }
  }

  const result = await fetchUrlText(url);
  if (!result.ok) {
    if (result.reason === "invalid") {
      return NextResponse.json({ error: "That does not look like a valid web link." }, { status: 400 });
    }
    if (result.reason === "blocked") {
      return NextResponse.json(
        { error: "That link can't be fetched here. Paste your profile text instead." },
        { status: 400 },
      );
    }
    // Network failure or non-HTML — let the client offer guided paste.
    return NextResponse.json({ blocked: true });
  }

  if (looksUnusable(result.text)) {
    // Reachable but not readable (LinkedIn login wall, SPA shell). Guided paste.
    return NextResponse.json({ blocked: true });
  }

  return NextResponse.json({ text: result.text.slice(0, MAX_RESUME_CHARS) });
}
