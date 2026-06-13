"use client";

// Unified client auth API. When Supabase is configured these call real auth;
// otherwise they drive the demo localStorage session so every flow still works.

import { useEffect, useState } from "react";
import type { AuthChangeEvent, Session, User } from "@supabase/supabase-js";
import { APP_URL, supabaseConfigured } from "@/lib/config";
import { getBrowserSupabase } from "@/lib/supabase/client";
import * as demo from "@/lib/session";
import { useDemoSession } from "@/lib/use-session";

export interface SessionUser {
  email: string;
  name: string;
}

export type OAuthProvider = "google" | "linkedin_oidc";

function toUser(u: User | null): SessionUser | null {
  if (!u) return null;
  const meta = (u.user_metadata ?? {}) as Record<string, string>;
  const name =
    meta.full_name ||
    meta.name ||
    (u.email ? u.email.split("@")[0] : "You");
  return { email: u.email ?? "", name };
}

/**
 * Current session. Real Supabase user when configured (with live updates on
 * sign-in/out), demo localStorage session otherwise. `initialUser` lets a
 * server component seed the value to avoid a signed-out flash.
 */
export function useSession(initialUser?: SessionUser | null): {
  user: SessionUser | null;
  loading: boolean;
} {
  const demoUser = useDemoSession();
  const [sbUser, setSbUser] = useState<SessionUser | null>(
    initialUser ?? null,
  );
  const [loading, setLoading] = useState(
    supabaseConfigured && initialUser === undefined,
  );

  useEffect(() => {
    if (!supabaseConfigured) return;
    const sb = getBrowserSupabase();
    if (!sb) return;
    let active = true;
    sb.auth.getUser().then(({ data }: { data: { user: User | null } }) => {
      if (!active) return;
      setSbUser(toUser(data.user));
      setLoading(false);
    });
    const { data: sub } = sb.auth.onAuthStateChange(
      (_event: AuthChangeEvent, session: Session | null) => {
        setSbUser(toUser(session?.user ?? null));
        setLoading(false);
      },
    );
    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  if (supabaseConfigured) return { user: sbUser, loading };
  return {
    user: demoUser ? { email: demoUser.email, name: demoUser.name } : null,
    loading: false,
  };
}

export async function signUp(
  email: string,
  password: string,
  name?: string,
): Promise<{ error: string | null; needsConfirmation: boolean }> {
  if (!supabaseConfigured) {
    demo.signIn(email, name);
    return { error: null, needsConfirmation: false };
  }
  const sb = getBrowserSupabase()!;
  const { data, error } = await sb.auth.signUp({
    email,
    password,
    options: {
      data: { full_name: name },
      emailRedirectTo: `${APP_URL}/auth/callback`,
    },
  });
  return {
    error: error?.message ?? null,
    needsConfirmation: !error && !data.session,
  };
}

export async function signInPassword(
  email: string,
  password: string,
): Promise<{ error: string | null }> {
  if (!supabaseConfigured) {
    demo.signIn(email);
    return { error: null };
  }
  const sb = getBrowserSupabase()!;
  const { error } = await sb.auth.signInWithPassword({ email, password });
  return { error: error?.message ?? null };
}

export async function signInOAuth(
  provider: OAuthProvider,
): Promise<{ error: string | null }> {
  if (!supabaseConfigured) {
    // Demo: simulate a successful OAuth round-trip with the sample persona.
    demo.signIn("alex.m@email.com", "Alex Mercer");
    return { error: null };
  }
  const sb = getBrowserSupabase()!;
  const { error } = await sb.auth.signInWithOAuth({
    provider,
    options: { redirectTo: `${APP_URL}/auth/callback?next=/dashboard` },
  });
  return { error: error?.message ?? null };
}

export async function signOut(): Promise<void> {
  if (!supabaseConfigured) {
    demo.signOut();
    return;
  }
  const sb = getBrowserSupabase()!;
  await sb.auth.signOut();
}

export async function resetPassword(
  email: string,
): Promise<{ error: string | null }> {
  if (!supabaseConfigured) return { error: null };
  const sb = getBrowserSupabase()!;
  const { error } = await sb.auth.resetPasswordForEmail(email, {
    redirectTo: `${APP_URL}/auth/callback?next=/settings`,
  });
  return { error: error?.message ?? null };
}

/** Whether real auth is active (vs the demo session). */
export const isRealAuth = supabaseConfigured;
