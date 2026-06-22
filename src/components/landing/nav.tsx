import Image from "next/image";
import Link from "next/link";
import { ROUTES } from "./data";
import NavSession from "./nav-session";
import { getServerUser } from "@/lib/auth-server";

const LINKS = [
  ["Pricing", ROUTES.pricing],
  ["Coaching", ROUTES.coaching],
] as const;

export default async function Nav({ active = "Home" }: { active?: string }) {
  // Real user in live mode (SSR-accurate, no flash); null in demo mode.
  const initialUser = await getServerUser();

  return (
    <header className="tm-nav">
      <Link href={ROUTES.home} className="tm-nav-brand">
        <Image
          src="/resme-logomark.png"
          alt="Res.Me logomark"
          width={942}
          height={1042}
          sizes="26px"
        />
        <span className="tm-nav-name">TailorMe</span>
        <span className="tm-nav-by">by Res.Me</span>
      </Link>
      <nav className="tm-nav-links">
        {LINKS.map(([label, href]) => (
          <Link
            key={label}
            href={href}
            className={label === active ? "is-active" : ""}
          >
            {label}
          </Link>
        ))}
        <NavSession active={active} initialUser={initialUser} />
      </nav>
    </header>
  );
}
