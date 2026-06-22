import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import {
  Briefcase,
  Check,
  Compass,
  FileText,
  Lock,
  Rocket,
  ShieldCheck,
  Target,
  Trash2,
  type LucideIcon,
} from "lucide-react";
import Nav from "@/components/landing/nav";
import Footer from "@/components/landing/footer";
import { ROUTES, TRUST } from "@/components/landing/data";
import { PLANS, type PlanSlug } from "@/lib/packs";
import PricingFaq from "./pricing-faq";
import { PricingView, PlanCta, RefundLink } from "./pricing-telemetry";

export const metadata: Metadata = {
  title: "Pricing · TailorMe by Res.Me",
};

// Presentation only — price/credits/per come from PLANS (lib/packs.ts), the
// single source of truth that also drives Stripe, so the page can never
// advertise a price that disagrees with what's charged.
type PackPresentation = {
  icon: LucideIcon;
  use: string;
  slug: PlanSlug;
  desc: string;
  who: string[];
  popular?: boolean;
  value?: boolean;
};

const PRESENTATION: PackPresentation[] = [
  {
    icon: Compass,
    use: "Testing the waters",
    slug: "starter",
    desc: "Best for testing a few important roles before committing.",
    who: [
      "You’re employed, but a few dream postings caught your eye",
      "You want to see what tailoring does before committing",
    ],
  },
  {
    icon: Briefcase,
    use: "Actively searching",
    slug: "job_hunt",
    desc: "Best for an active search with several quality applications per week.",
    who: [
      "You’re applying every week and the generic resume isn’t converting",
      "You want every important application reviewed before it goes out",
    ],
    popular: true,
  },
  {
    icon: Rocket,
    use: "Career switch or full campaign",
    slug: "campaign",
    desc: "Best for career switches, relocation, or applying across multiple role types.",
    who: [
      "You’re repositioning and every posting needs a different story",
      "You want enough credits for a serious search without going generic",
    ],
    value: true,
  },
];

const PACKS = PRESENTATION.map((p) => {
  const plan = PLANS[p.slug];
  return {
    ...p,
    name: plan.name,
    price: `$${plan.amountCents / 100}`,
    priceNum: plan.amountCents / 100,
    credits: plan.credits,
    apps: `${plan.credits} applications`,
    per: plan.per,
  };
});

const ADDON_TIERS = [
  {
    name: "Expert Feedback",
    price: "+$79",
    desc: "One human review pass on one selected application: prioritized notes, risks, weak spots, and what to improve. Feedback only, back within 48 hours.",
  },
  {
    name: "Human Revision",
    price: "+$149",
    desc: "One hands-on human revision pass for a single application: an expert actually revises it with you, not just notes. Premium add-on.",
  },
  {
    name: "Full white-glove service",
    price: "$225+",
    desc: "A higher-touch, done-with-you resume engagement. By request — get in touch and we’ll scope it. Not the same as Expert Feedback.",
  },
];

const INCLUDES = [
  { icon: Target, label: "Fit score before you commit" },
  { icon: FileText, label: "Tailored resume + cover letter" },
  { icon: Check, label: "Three-agent line-level review" },
  { icon: ShieldCheck, label: "Compiled, inspected 2-page PDF" },
] as const;

type RichPart = string | { b: string };

const GUIDE: { q: string; a: RichPart[] }[] = [
  {
    q: "I just want to try it.",
    a: [
      "Start with the ",
      { b: "free audit" },
      ": your first application costs nothing, no card required.",
    ],
  },
  {
    q: "I’m applying to a few specific roles.",
    a: [
      { b: "Starter" },
      " covers five targeted applications. Quality over volume.",
    ],
  },
  {
    q: "I’m in a full-on search.",
    a: [
      { b: "Job Hunt" },
      " is the sweet spot, and ",
      { b: "Campaign" },
      " if you’re switching careers or casting wide.",
    ],
  },
];

const TRUST_ICONS = {
  lock: Lock,
  "trash-2": Trash2,
  "shield-check": ShieldCheck,
} as const;

function PackCards() {
  return (
    <div className="tmP-packs">
      {PACKS.map((p) => {
        const em = Boolean(p.popular);
        const chip = p.popular ? "Most popular" : null;
        return (
          <div
            key={p.name}
            className={
              "tm-card tmP-pack" +
              (chip ? " has-chip" : "") +
              (em ? " is-em" : "")
            }
          >
            <span className="tm-pill tmP-pack-chip">{chip || " "}</span>
            <span className="tmP-pack-ic" aria-hidden="true">
              <p.icon size={18} />
            </span>
            <span className="tmP-pack-use">{p.use}</span>
            <span className="tmP-pack-name">{p.name}</span>
            <span className="tmP-pack-price">
              <strong>{p.price}</strong>
              <span>{p.apps}</span>
            </span>
            <span className="tmP-pack-per">
              <b>{p.per}</b> per application
            </span>
            <p className="tmP-pack-desc">{p.desc}</p>
            <div className="tmP-pack-who">
              {p.who.map((w) => (
                <span key={w}>
                  <Check size={13} /> {w}
                </span>
              ))}
            </div>
            <PlanCta
              slug={p.slug}
              price={p.priceNum}
              credits={p.credits}
              perApp={p.per}
              className={"tm-btn " + (em ? "tm-btn--primary" : "tm-btn--outline")}
            >
              Buy {p.name.toLowerCase()}
            </PlanCta>
          </div>
        );
      })}
    </div>
  );
}

function ExpertUpsell() {
  return (
    <div
      className="tm-card tm-human"
      style={{
        marginTop: "var(--g)",
        background: "#fff",
        borderColor: "var(--tm-mint-200)",
        boxShadow: "0 14px 34px rgba(16, 24, 40, 0.08)",
      }}
    >
      <Image
        className="tm-human-photo"
        src="/michael.png"
        alt="Michael, head of Res.Me"
        width={56}
        height={56}
      />
      <div className="tm-human-body">
        <h3>Want human eyes on your best application?</h3>
        <p>
          Add Expert Feedback for $79. A resume expert reviews one selected
          application and gives prioritized, human feedback within 48 hours.
        </p>
        <p className="tm-small" style={{ marginTop: "6px" }}>
          Expert Feedback is a review pass, not a full rewrite. Human Revision is
          available separately for $149.
        </p>
      </div>
      <div className="tm-human-price">
        <strong style={{ color: "var(--tm-mint-700)" }}>+$79</strong>
        <span>per application</span>
      </div>
    </div>
  );
}

function AddOnTiers() {
  return (
    <div className="tmP-guide mt-[26px]">
      {ADDON_TIERS.map((t) => (
        <div key={t.name} className="tm-card tmP-guide-item">
          <div
            style={{
              display: "flex",
              alignItems: "baseline",
              justifyContent: "space-between",
              gap: "8px",
            }}
          >
            <strong style={{ fontSize: "15px" }}>{t.name}</strong>
            <span className="tm-m" style={{ color: "var(--tm-mint-700)" }}>
              {t.price}
            </span>
          </div>
          <p style={{ marginTop: "8px" }}>{t.desc}</p>
        </div>
      ))}
    </div>
  );
}

function TrustStrip() {
  return (
    <div className="tm-trust">
      {TRUST.map((t) => {
        const Icon = TRUST_ICONS[t.icon];
        return (
          <span key={t.t} className="tm-trust-item">
            <Icon size={16} /> {t.t}
          </span>
        );
      })}
    </div>
  );
}

export default function PricingPage() {
  return (
    <div className="tm">
      <PricingView />
      <Nav active="Pricing" />
      <main>
        <section className="tm-sec tmP-head">
          <span className="tm-pill">Pricing</span>
          <h1 className="tm-h1">
            Tailor every important application. Add expert review when it
            matters.
          </h1>
          <p className="tm-body">
            No subscription. Buy application credits once, use them across roles,
            and upgrade any application with human feedback.
          </p>
        </section>

        <section
          className="tm-sec"
          style={{ paddingTop: "calc(var(--sy) * 0.5)" }}
        >
          <div className="tm-wrap">
            <PackCards />
            <ExpertUpsell />
            <RefundLink>
              <ShieldCheck size={15} /> Unused credits refunded in full within 30
              days.
            </RefundLink>
            <p className="tm-small mt-[28px] text-center">
              Every new account starts with{" "}
              <span className="tm-m">1 free application and a full resume
              audit</span>
              . No card required.
            </p>
          </div>
        </section>

        <section className="tm-sec tm-tint--blue">
          <div className="tm-wrap">
            <div className="tmP-includes">
              <span className="tmP-includes-label">
                Every application includes
              </span>
              {INCLUDES.map((it) => (
                <span key={it.label} className="tmP-include">
                  <it.icon size={15} /> {it.label}
                </span>
              ))}
            </div>
          </div>
        </section>

        <section className="tm-sec">
          <div className="tm-wrap">
            <h2 className="tm-h2">Which pack is right for me?</h2>
            <div className="tmP-guide mt-[26px]">
              {GUIDE.map((g) => (
                <div key={g.q} className="tm-card tmP-guide-item">
                  <q>{g.q}</q>
                  <p>
                    {g.a.map((part, i) =>
                      typeof part === "string" ? (
                        part
                      ) : (
                        <b key={i}>{part.b}</b>
                      ),
                    )}
                  </p>
                </div>
              ))}
            </div>
            <h2 className="tm-h2 mt-[44px]">Add human review</h2>
            <p className="tm-body mt-[10px]">
              Every application already gets the full three-agent review. When a
              role really matters, add a human pass.
            </p>
            <AddOnTiers />
          </div>
        </section>

        <section className="tm-sec tm-tint--gray">
          <div className="mx-auto max-w-[880px]">
            <h2 className="tm-h2">Pricing questions</h2>
            <div className="mt-[22px]">
              <PricingFaq />
            </div>
          </div>
        </section>

        <section className="tm-sec">
          <div className="tm-wrap tm-cta">
            <h2 className="tm-h2">Start with the free one.</h2>
            <p className="tm-body">
              Your first application is a free audit. See what tailoring does
              to your own bullets before buying anything.
            </p>
            <Link
              className="tm-btn tm-btn--primary tm-btn--lg"
              href={ROUTES.audit}
            >
              Get a free resume audit
            </Link>
            <div className="mt-[34px]">
              <TrustStrip />
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
