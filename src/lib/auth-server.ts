import "server-only";
import type { SessionUser } from "@/lib/auth";
import { getServerSupabase } from "@/lib/supabase/server";

/** The signed-in user on the server, or null (always null in demo mode). */
export async function getServerUser(): Promise<SessionUser | null> {
  const sb = await getServerSupabase();
  if (!sb) return null;
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) return null;
  const meta = (user.user_metadata ?? {}) as Record<string, string>;
  const name =
    meta.full_name ||
    meta.name ||
    (user.email ? user.email.split("@")[0] : "You");
  return { email: user.email ?? "", name };
}
