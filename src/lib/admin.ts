import { ADMIN_EMAILS } from "@/lib/config";

// Admin access = an email allowlist (ADMIN_EMAILS, comma-separated). Empty list
// means nobody — a safe default so the admin views are locked until configured.
// Server-only in practice; never trust this on the client (always re-check on
// the server route).

export function parseAdmins(csv?: string | null): Set<string> {
  return new Set(
    (csv ?? "")
      .split(",")
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean),
  );
}

/** Pure predicate — testable with an explicit allowlist. */
export function emailIsAdmin(
  email: string | null | undefined,
  csv?: string | null,
): boolean {
  if (!email) return false;
  return parseAdmins(csv).has(email.trim().toLowerCase());
}

/** Env-bound convenience used by admin routes/pages. */
export function isAdminEmail(email?: string | null): boolean {
  return emailIsAdmin(email, ADMIN_EMAILS);
}
