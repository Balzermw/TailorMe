import Image from "next/image";
import Link from "next/link";
import { ROUTES } from "./data";

export default function Footer() {
  return (
    <footer className="tm-footer">
      <span className="tm-footer-brand">
        <Image
          src="/resme-logomark.png"
          alt=""
          width={942}
          height={1042}
          sizes="18px"
        />
        TailorMe — a Res.Me product
      </span>
      <span className="tm-footer-links">
        <Link href={ROUTES.security}>Security</Link>
        <Link href={ROUTES.privacy}>Privacy</Link>
        <Link href={ROUTES.terms}>Terms</Link>
        <Link href={ROUTES.contact}>Contact</Link>
      </span>
    </footer>
  );
}
