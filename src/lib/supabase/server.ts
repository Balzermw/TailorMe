import { createServerClient } from "@supabase/ssr";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import {
  PUBLIC_SUPABASE_URL,
  PUBLIC_SUPABASE_ANON_KEY,
  supabaseConfigured,
} from "@/lib/config";

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

// Service-role client: bypasses RLS for server-only writes (telemetry). Returns
// null when the service key isn't configured, so callers can no-op cleanly.
// NEVER expose this to the browser — the key grants full DB access.
let serviceClient: SupabaseClient | null | undefined;
export function getServiceSupabase(): SupabaseClient | null {
  if (serviceClient !== undefined) return serviceClient;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  serviceClient =
    supabaseConfigured && PUBLIC_SUPABASE_URL && key
      ? createClient(PUBLIC_SUPABASE_URL, key, {
          auth: { persistSession: false, autoRefreshToken: false },
        })
      : null;
  return serviceClient;
}
