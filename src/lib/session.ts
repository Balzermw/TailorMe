// Simulated demo session (client-only) — mirrors the design prototype's
// localStorage login. Placeholder until real auth (Supabase) lands.

export type DemoSession = { email: string; name: string; at: number };

const KEY = "tm_session_v1";

// Fired on signIn/signOut so same-tab subscribers (useDemoSession) update.
export const SESSION_EVENT = "tm-session-change";

function notify(): void {
  window.dispatchEvent(new Event(SESSION_EVENT));
}

export function getSession(): DemoSession | null {
  if (typeof window === "undefined") return null;
  try {
    return JSON.parse(window.localStorage.getItem(KEY) ?? "null");
  } catch {
    return null;
  }
}

export function signIn(email: string, name?: string): DemoSession {
  const cleanEmail = (email || "").trim() || "alex.m@email.com";
  const guess = cleanEmail
    .split("@")[0]
    .split(/[._-]/)
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join(" ");
  const s: DemoSession = {
    email: cleanEmail,
    name: name || guess || "Alex Mercer",
    at: Date.now(),
  };
  window.localStorage.setItem(KEY, JSON.stringify(s));
  notify();
  return s;
}

export function signOut(): void {
  window.localStorage.removeItem(KEY);
  notify();
}

export function initials(name?: string): string {
  return (name || "A M")
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p.charAt(0).toUpperCase())
    .join("");
}
