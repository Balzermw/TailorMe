import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Check, Lock, ShieldCheck, Trash2 } from "lucide-react";
import Nav from "@/components/landing/nav";
import Footer from "@/components/landing/footer";
import { ROUTES, TRUST } from "@/components/landing/data";

export const metadata: Metadata = {
  title: "Coaching with Michael · TailorMe by Res.Me",
};

// Package tiers — one-time, no subscription.
const PKGS = [
  {
    name: "Resume rewrite",
    price: "$149",
    popular: false,
    items: [
      "Full rewrite of your resume by Michael",
      "Positioning for one target role",
      "2 revision rounds",
      "5-day turnaround",
    ],
  },
  {
    name: "Rewrite + cover letter",
    price: "$199",
    popular: true,
    items: [
      "Everything in Resume rewrite",
      "Tailored cover letter",
      "LinkedIn headline + summary pass",
      "2 revision rounds",
    ],
  },
  {
    name: "Full coaching",
    price: "$299",
    popular: false,
    items: [
      "Everything in Rewrite + cover letter",
      "Two 45-minute 1-on-1 sessions",
      "Interview positioning notes",
      "30 days of follow-up questions",
    ],
  },
];

const TSTS = [
  {
    q: "Michael turned seven years of “responsibilities” into a story about impact. I finally sound like the engineer I am.",
    who: "S.K.",
    role: "Senior Software Engineer",
    note: "Labeled composite",
  },
  {
    q: "The line-by-line notes were worth it alone. Every bullet got sharper and I understood why.",
    who: "J.R.",
    role: "Cloud Infrastructure Lead",
    note: "Labeled composite",
  },
  {
    q: "I’d been rewriting my own resume for months. One session re-framed the whole thing.",
    who: "M.T.",
    role: "Professional Services Manager",
    note: "Labeled composite",
  },
];

const CREDS = [
  "Certified Professional Resume Writer (CPRW)",
  "15+ years of experience in technical hiring",
  "650+ resumes written for senior candidates",
  "Fiverr Top Rated Pro · 4.8/5 across 200+ reviews",
  "Head of Res.Me · the team behind TailorMe",
];

const STEPS = [
  [
    "01",
    "Share your story",
    "Send your current resume and the roles you’re targeting. Michael reads both before you ever meet.",
  ],
  [
    "02",
    "Craft & perfect",
    "Rewrite, restructure, re-position, together. Every change explained, so the thinking sticks.",
  ],
  [
    "03",
    "Ready to stand out",
    "You leave with documents that read at your level, and the positioning to talk about them.",
  ],
];

const TRUST_ICONS = {
  lock: Lock,
  "trash-2": Trash2,
  "shield-check": ShieldCheck,
} as const;

function CoachingHero() {
  return (
    <section className="tm-sec">
      <div className="tm-wrap tmC-hero2">
        <div>
          <span className="tm-pill">1-on-1 coaching</span>
          <h1 className="tm-h1">Professional resume coaching with Michael</h1>
          <p className="tm-body">
            The head of Res.Me, working on your resume directly, positioning
            your story for the roles you actually want, line by line.
          </p>
          <div className="tmC-hero2-ctas">
            <Link
              className="tm-btn tm-btn--primary tm-btn--lg"
              href={ROUTES.bookSession}
            >
              Book a session
            </Link>
            <a className="tm-btn tm-btn--outline tm-btn--lg" href="#packages">
              See packages
            </a>
          </div>
          <div className="tmC-hero2-rating">
            <span className="tmC-rating-num">4.8/5</span>
            <span className="tmC-rating-sub">
              across 200+ reviews · 650+ resumes written · 15+ years
            </span>
          </div>
        </div>
        <div className="tmC-photo-wrap">
          <Image
            className="tmC-photo"
            src="/michael.png"
            alt="Michael, head of Res.Me"
            width={416}
            height={416}
            sizes="(max-width: 760px) 100vw, 360px"
            priority
          />
          <span className="tmC-photo-badge">
            <ShieldCheck size={14} /> Fiverr Top Rated Pro
          </span>
        </div>
      </div>
    </section>
  );
}

function About() {
  return (
    <section className="tm-sec tm-tint--gray">
      <div className="tm-wrap tmC-about">
        <div>
          <h2 className="tm-h2">Hi, I’m Michael.</h2>
          <p className="tm-body mt-[14px]">
            I’ve spent fifteen years helping technical professionals explain
            their work to the people who hire them. Most resumes I see
            undersell the candidate: strong work written as a task list. My
            job is the translation: finding the impact in what you’ve done and
            positioning it for the role you want next.
          </p>
          <p className="tm-body mt-[12px]">
            I built TailorMe’s pipeline around how I work. Coaching is the
            full-strength version: you and me, your resume, your target roles.
          </p>
        </div>
        <div className="tm-card px-[28px] py-[26px]">
          <div className="tmB-creds">
            {CREDS.map((c) => (
              <span key={c} className="tmB-cred">
                <Check size={12} /> {c}
              </span>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function Steps() {
  return (
    <section className="tm-sec">
      <div className="tm-wrap">
        <h2 className="tm-h2">How coaching works</h2>
        <div className="tmC-steps mt-[26px]">
          {STEPS.map(([n, h, d]) => (
            <div key={n} className="tm-card tmC-step">
              <i>{n}</i>
              <h3>{h}</h3>
              <p>{d}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Packages() {
  return (
    <section className="tm-sec tm-tint--blue" id="packages">
      <div className="tm-wrap">
        <h2 className="tm-h2">Choose your package</h2>
        <p className="tm-body mt-[10px] max-w-[60ch]">
          One-time packages, no subscription. Most clients start with Rewrite
          + cover letter.
        </p>
        <div className="tmC-pkgs mt-[28px]">
          {PKGS.map((p) => (
            <div
              key={p.name}
              className={
                "tm-card tmC-pkg" + (p.popular ? " has-chip is-em" : "")
              }
            >
              <span className="tm-pill tm-pill--mint tmC-pkg-chip">
                Most popular
              </span>
              <span className="tmC-pkg-name">{p.name}</span>
              <span className="tmC-pkg-price">
                <strong>{p.price}</strong>
                <span>one time</span>
              </span>
              <div className="tmC-pkg-items">
                {p.items.map((it) => (
                  <span key={it}>
                    <Check size={13} /> {it}
                  </span>
                ))}
              </div>
              <Link
                className={
                  "tm-btn " + (p.popular ? "tm-btn--primary" : "tm-btn--outline")
                }
                href={ROUTES.bookSession}
              >
                Choose {p.name.toLowerCase()}
              </Link>
            </div>
          ))}
        </div>
        <div className="tm-card tmC-band mt-[var(--g)]">
          <Image
            className="tm-human-photo"
            src="/michael.png"
            alt=""
            width={56}
            height={56}
          />
          <div className="tmC-band-body">
            <h3>Already using TailorMe?</h3>
            <p>
              Add Michael’s line-by-line review to any application for +$79,
              no package needed. 48-hour turnaround.
            </p>
          </div>
          <Link className="tm-btn tm-btn--outline" href={ROUTES.dashboard}>
            Add to an application
          </Link>
        </div>
      </div>
    </section>
  );
}

function Testimonials() {
  return (
    <section className="tm-sec">
      <div className="tm-wrap">
        <h2 className="tm-h2">What clients say</h2>
        <div className="tmC-tsts mt-[26px]">
          {TSTS.map((tst) => (
            <div key={tst.who} className="tm-card tmC-tst">
              <q>{tst.q}</q>
              <div className="tmC-tst-who">
                <span className="tmC-tst-avatar">
                  {tst.who.replace(/\./g, "").slice(0, 2)}
                </span>
                <span>
                  <b>
                    {tst.who} · {tst.role}
                  </b>
                  <span>{tst.note}</span>
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Cta() {
  return (
    <section className="tm-sec tm-tint--gray">
      <div className="tm-wrap tm-cta">
        <h2 className="tm-h2">Work with Michael directly.</h2>
        <p className="tm-body">
          Or start smaller: run a free TailorMe audit and add his review when
          you’re ready.
        </p>
        <div className="flex flex-wrap justify-center gap-[12px]">
          <Link
            className="tm-btn tm-btn--primary tm-btn--lg"
            href={ROUTES.bookSession}
          >
            Book a session
          </Link>
          <Link
            className="tm-btn tm-btn--outline tm-btn--lg"
            href={ROUTES.audit}
          >
            Try TailorMe free
          </Link>
        </div>
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

export default function CoachingPage() {
  return (
    <div className="tm">
      <Nav active="Coaching" />
      <main>
        <CoachingHero />
        <About />
        <Steps />
        <Packages />
        <Testimonials />
        <Cta />
      </main>
      <Footer />
    </div>
  );
}
