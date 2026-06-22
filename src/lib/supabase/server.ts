import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import {
  PUBLIC_SUPABASE_URL,
  PUBLIC_SUPABASE_ANON_KEY,
  supabaseConfigured,
} from "@/lib/config";

// Single canonical service-role client lives in ./admin. Re-exported here so
// existing telemetry/event callers keep importing from "@/lib/supabase/server"
// without a second (divergent, null-memoizing) implementation.
export { getServiceSupabase } from "./admin";

/**
 * Server Supabase client bound to the request cookies, or null in demo mode.
 * Use from Server Components, Route Handlers, and Server Actions.
 */
export async function getServerSupabase() {
  if (!supabaseConfigured) return null;
  const cookieStore = await cookies();
  return createServerClient(PUBLIC_SUPABASE_URL!, PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        // Throws in a Server Component render (read-only cookies); that's fine —
        // session refresh happens in middleware. Swallow it there.
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options),
          );
        } catch {
          /* called from a Server Component — ignore */
        }
      },
    },
  });
}
