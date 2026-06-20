import Link from "next/link";
import { Lock, ShieldCheck, Trash2 } from "lucide-react";
import { ROUTES, TRUST } from "@/components/landing/data";

const TRUST_ICONS = {
  lock: Lock,
  "trash-2": Trash2,
  "shield-check": ShieldCheck,
} as const;

export default function FinalCta() {
  return (
    <section className="tm-sec">
      <div className="tm-wrap tm-cta">
        <h2 className="tm-h2">Your bullets can do this too.</h2>
        <p className="tm-body">
          Run the same pipeline on your own resume — the first application is
          free.
        </p>
        <Link className="tm-btn tm-btn--primary tm-btn--lg" href={ROUTES.audit}>
          Get a free resume audit
        </Link>
        <div className="tm-trust mt-[34px]">
          {TRUST.map((t) => {
            const Icon = TRUST_ICONS[t.icon];
            return (
              <span key={t.t} className="tm-trust-item">
                <Icon size={16} /> {t.t}
              </span>
            );
          })}
        </div>
      </div>
    </section>
  );
}
