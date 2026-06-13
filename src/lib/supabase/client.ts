"use client";

import { createBrowserClient } from "@supabase/ssr";
import {
  PUBLIC_SUPABASE_URL,
  PUBLIC_SUPABASE_ANON_KEY,
  supabaseConfigured,
} from "@/lib/config";

let cached: ReturnType<typeof createBrowserClient> | null = null;

/** Browser Supabase client, or null when Supabase isn't configured (demo mode). */
export function getBrowserSupabase() {
  if (!supabaseConfigured) return null;
  if (!cached) {
    cached = createBrowserClient(
      PUBLIC_SUPABASE_URL!,
      PUBLIC_SUPABASE_ANON_KEY!,
    );
  }
  return cached;
}
