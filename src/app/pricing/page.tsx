import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import {
  Check,
  FileText,
  Lock,
  Plus,
  ShieldCheck,
  Sparkles,
  Target,
  Trash2,
} from "lucide-react";
import Nav from "@/components/landing/nav";
import Footer from "@/components/landing/footer";
import { ROUTES, TRUST } from "@/components/landing/data";

export const metadata: Metadata = {
  title: "Pricing — TailorMe by Res.Me",
};

type Pack = {
  use: string;
  name: string;
  price: string;
  apps: string;
  per: string;
  desc: string;
  who: string[];
  popular?: boolean;
  value?: boolean;
};

const PACKS: Pack[] = [
  {
    use: "Testing the waters",
    name: "Starter",
    price: "$19",
    apps: "5 applications",
    per: "$3.80",
    desc: "For a handful of roles you really want — not a spray-and-pray run.",
    who: [
      "You’re employed, but a few dream postings caught your eye",
      "You want to see what tailoring does before committing",
    ],
  },
  {
    use: "Actively searching",
    name: "Job hunt",
    price: "$49",
    apps: "15 applications",
    per: "$3.27",
    desc: "For a real search: several quality applications a week, each one tailored.",
    who: [
      "You’re applying every week and the generic resume isn’t converting",
      "You want every application reviewed before it goes out",
    ],
    popular: true,
  },
  {
    use: "Career switch or full campaign",
    name: "All in",
    price: "$99",
    apps: "40 applications",
    per: "$2.48",
    desc: "For changing roles, industries, or cities — casting wide without going generic.",
    who: [
      "You’re repositioning and every posting needs a different story",
      "You’d rather buy once and never think about credits again",
    ],
    value: true,
  },
];

const INCLUDES = [
  { icon: Target, label: "Fit score before you commit" },
  { icon: FileText, label: "Tailored resume + cover letter" },
  { icon: Sparkles, label: "Three-agent line-level review" },
  { icon: ShieldCheck, label: "Compiled, inspected 2-page PDF" },
] as const;

type RichPart = string | { b: string };

const GUIDE: { q: string; a: RichPart[] }[] = [
  {
    q: "I just want to try it.",
    a: [
      "Start with the ",
      { b: "free audit" },
      " — your first application costs nothing, no card required.",
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
      { b: "Job hunt" },
      " is the sweet spot — and ",
      { b: "All in" },
      " if you’re switching careers or casting wide.",
    ],
  },
];

const PRICING_FAQS = [
  {
    q: "Do credits expire?",
    a: "Never. Buy a pack, use it across your whole search — this month or next year. No subscription to cancel, no API keys to manage.",
  },
  {
    q: "What counts as one application?",
    a: "One job posting: fit score, tailored resume + cover letter, the full three-agent review, and the compiled PDFs. Re-runs against the same posting don’t cost extra credits.",
  },
  {
    q: "Can I see the result before spending a credit?",
    a: "Yes — every run shows a watermarked preview free. The credit unlocks the clean download.",
  },
  {
    q: "What’s the refund policy?",
    a: "If you’re not happy, email balzermw@gmail.com within 30 days of purchase and we’ll refund any unused credits in full. Credits already spent on a tailored application, and completed human reviews, aren’t refundable.",
  },
  {
    q: "What does Michael’s review add?",
    a: "A line-by-line pass from the head of Res.Me — Certified Professional Resume Writer, 650+ resumes written — with positioning notes for your target role, within 48 hours. +$49 on any application.",
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
            <span className="tm-pill tmP-pack-chip">{chip || "\u00A0"}</span>
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
            <Link
              className={"tm-btn " + (em ? "tm-btn--primary" : "tm-btn--outline")}
              href={ROUTES.buyCredits}
            >
              Buy {p.name.toLowerCase()}
            </Link>
          </div>
        );
      })}
    </div>
  );
}

function HumanReviewRow() {
  return (
    <div className="tm-card tm-human">
      <Image
        className="tm-human-photo"
        src="/michael.png"
        alt="Michael, head of Res.Me"
        width={56}
        height={56}
      />
      <div className="tm-human-body">
        <h3>Add Michael’s expert review</h3>
        <p>
          Michael — head of Res.Me, Certified Professional Resume Writer, 650+
          resumes written — goes through your final draft line by line and adds
          positioning notes for your target role. Back in your inbox within 48
          hours.
        </p>
      </div>
      <div className="tm-human-price">
        <strong>+$49</strong>
        <span>per application</span>
      </div>
    </div>
  );
}

function PricingFaq() {
  return (
    <div className="tm-faq">
      {PRICING_FAQS.map((f, i) => (
        <details key={f.q} className="tm-faq-item" open={i === 0}>
          <summary>
            {f.q} <Plus size={16} />
          </summary>
          <p>{f.a}</p>
        </details>
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
      <Nav active="Pricing" />
      <main>
        <section className="tm-sec tmP-head">
          <span className="tm-pill">Pricing</span>
          <h1 className="tm-h1">Pay per application. That’s it.</h1>
          <p className="tm-body">
            No subscription, no monthly fee, credits never expire. Every
            application gets the full pipeline — the packs only differ in how
            many you need.
          </p>
        </section>

        <section
          className="tm-sec"
          style={{ paddingTop: "calc(var(--sy) * 0.5)" }}
        >
          <div className="tm-wrap">
            <PackCards />
            <p className="tmP-refund">
              <ShieldCheck size={15} /> Not happy? Unused credits refunded in
              full within 30 days.
            </p>
            <p className="tm-small mt-[28px] text-center">
              Every new account starts with{" "}
              <span className="tm-m">1 free application</span> — that’s your
              free resume audit. No card required.
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
            <HumanReviewRow />
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
              Your first application is a free audit — see what tailoring does
              to your own bullets before buying anything.
            </p>
            <Link
              className="tm-btn tm-btn--primary tm-btn--lg"
              href={ROUTES.audit}
            >
              <Sparkles size={16} /> Get a free resume audit
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
