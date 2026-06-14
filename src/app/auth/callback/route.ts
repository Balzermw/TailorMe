import { NextResponse } from "next/server";
import { getServerSupabase } from "@/lib/supabase/server";

// OAuth + email-confirmation callback: exchange the code for a session cookie.
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  // Only allow same-origin relative paths — never an attacker-supplied
  // absolute/protocol-relative URL (open-redirect prevention).
  const raw = searchParams.get("next") ?? "/dashboard";
  const next = raw.startsWith("/") && !raw.startsWith("//") ? raw : "/dashboard";

  if (code) {
    const sb = await getServerSupabase();
    if (sb) {
      const { error } = await sb.auth.exchangeCodeForSession(code);
      // Failed exchange → back to sign-in rather than a logged-out dashboard.
      if (error) return NextResponse.redirect(`${origin}/signin?error=oauth`);
    }
  }
  return NextResponse.redirect(`${origin}${next}`);
}
