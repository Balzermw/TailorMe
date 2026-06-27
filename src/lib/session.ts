// Local fallback session (client-only) for running workflows before Supabase
// auth is configured.

export type DemoSession = { email: string; name: string; at: number };

const KEY = "tm_session_v1";
const LEGACY_DEMO_EMAILS = new Set([
  "alex.m@email.com",
  "alex.mercer@example.com",
]);

// Fired on signIn/signOut so same-tab subscribers (useDemoSession) update.
export const SESSION_EVENT = "tm-session-change";

function notify(): void {
  window.dispatchEvent(new Event(SESSION_EVENT));
}

export function getSession(): DemoSession | null {
  if (typeof window === "undefined") return null;
  try {
    const session = JSON.parse(window.localStorage.getItem(KEY) ?? "null") as
      | DemoSession
      | null;
    if (session && LEGACY_DEMO_EMAILS.has(session.email.toLowerCase())) {
      window.localStorage.removeItem(KEY);
      return null;
    }
    return session;
  } catch {
    return null;
  }
}

export function signIn(email: string, name?: string): DemoSession {
  const cleanEmail = (email || "").trim() || "local.user@example.com";
  const guess = cleanEmail
    .split("@")[0]
    .split(/[._-]/)
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join(" ");
  const s: DemoSession = {
    email: cleanEmail,
    name: name || guess || "Local User",
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
  return (name || "Local User")
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p.charAt(0).toUpperCase())
    .join("");
}
