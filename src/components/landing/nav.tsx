import Image from "next/image";
import Link from "next/link";
import { ROUTES } from "./data";

const LINKS = [
  ["Home", ROUTES.home],
  ["Pricing", ROUTES.pricing],
  ["Coaching", ROUTES.coaching],
] as const;

export default function Nav({ active = "Home" }: { active?: string }) {
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
        <Link href={ROUTES.signIn}>Sign in</Link>
        <Link
          href={ROUTES.audit}
          className="tm-btn tm-btn--primary tm-btn--sm"
        >
          Get a free resume audit
        </Link>
      </nav>
    </header>
  );
}
