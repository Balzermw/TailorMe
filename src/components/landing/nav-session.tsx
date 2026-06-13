"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ROUTES } from "./data";
import { initials, signOut } from "@/lib/session";
import { useDemoSession } from "@/lib/use-session";

// Session-dependent right side of the nav. Renders the signed-out state on
// the server and swaps after hydration if a demo session exists.
export default function NavSession({ active }: { active?: string }) {
  const router = useRouter();
  const session = useDemoSession();

  if (!session) {
    return (
      <>
        <Link href={ROUTES.signIn}>Sign in</Link>
        <Link href={ROUTES.audit} className="tm-btn tm-btn--primary tm-btn--sm">
          Get a free resume audit
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
        title={session.email}
      >
        <span className="tm-nav-avatar">{initials(session.name)}</span>
        {session.name}
      </Link>
      <a
        href={ROUTES.home}
        onClick={(e) => {
          e.preventDefault();
          signOut();
          router.push(ROUTES.home);
        }}
      >
        Sign out
      </a>
    </>
  );
}
