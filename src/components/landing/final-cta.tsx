import Link from "next/link";
import { Lock, ShieldCheck, Sparkles, Trash2 } from "lucide-react";
import { ROUTES, TRUST } from "./data";

const TRUST_ICONS = {
  lock: Lock,
  "trash-2": Trash2,
  "shield-check": ShieldCheck,
} as const;

export default function FinalCta() {
  return (
    <section className="tm-sec">
      <div className="tm-wrap tm-cta">
        <h2 className="tm-h2">Run your first application free.</h2>
        <p className="tm-body">
          Five dimensions scored, every line tailored, three reviewers — before
          you pay anything.
        </p>
        <Link className="tm-btn tm-btn--primary tm-btn--lg" href={ROUTES.audit}>
          <Sparkles size={16} /> Get a free resume audit
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
