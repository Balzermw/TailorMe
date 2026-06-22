"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ROUTES } from "./data";
import { initials } from "@/lib/session";
import { signOut, useSession, type SessionUser } from "@/lib/auth";

// Session-dependent right side of the nav. Seeded from the server (initialUser)
// so live mode is SSR-accurate; live updates on sign-in/out via useSession.
export default function NavSession({
  active,
  initialUser,
}: {
  active?: string;
  initialUser?: SessionUser | null;
}) {
  const router = useRouter();
  const { user } = useSession(initialUser ?? null);

  if (!user) {
    return (
      <>
        <Link href={ROUTES.signIn}>Sign in</Link>
        <Link href={ROUTES.audit} className="tm-btn tm-btn--primary tm-btn--sm">
          Free audit
        </Link>
      </>
    );
  }

  return (
    <>
      <Link
        href={ROUTES.dashboard}
        className={active === "Dashboard" ? "is-active" : ""}
      >
        Dashboard
      </Link>
      <Link
        href={ROUTES.settings}
        className="tm-nav-user"
        title={user.email}
      >
        <span className="tm-nav-avatar">{initials(user.name)}</span>
        {user.name}
      </Link>
      <a
        href={ROUTES.home}
        onClick={async (e) => {
          e.preventDefault();
          await signOut();
          router.push(ROUTES.home);
          router.refresh();
        }}
      >
        Sign out
      </a>
    </>
  );
}
