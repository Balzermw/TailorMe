import { createClient } from "@supabase/supabase-js";
import {
  PUBLIC_SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY,
  supabaseConfigured,
} from "@/lib/config";

/**
 * Service-role Supabase client that bypasses RLS. SERVER-ONLY — never import
 * into client code. Used by the Stripe webhook to grant credits. Returns null
 * unless both the URL and the service-role key are present.
 */
export function getServiceSupabase() {
  if (!supabaseConfigured || !SUPABASE_SERVICE_ROLE_KEY) return null;
  return createClient(PUBLIC_SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
