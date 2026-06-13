import { NextResponse } from "next/server";
import { getServerSupabase } from "@/lib/supabase/server";

// OAuth + email-confirmation callback: exchange the code for a session cookie.
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/dashboard";

  if (code) {
    const sb = await getServerSupabase();
    if (sb) await sb.auth.exchangeCodeForSession(code);
  }
  return NextResponse.redirect(`${origin}${next}`);
}
