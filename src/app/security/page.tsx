import type { Metadata } from "next";
import NextLink from "next/link";
import {
  ArrowRight,
  CreditCard,
  Database,
  EyeOff,
  FileText,
  Globe,
  KeyRound,
  Link as LinkIcon,
  Lock,
  Server,
  Shield,
  ShieldCheck,
  Trash2,
  UserCheck,
} from "lucide-react";
import Nav from "@/components/landing/nav";
import Footer from "@/components/landing/footer";
import { ROUTES } from "@/components/landing/data";

export const metadata: Metadata = {
  title: "Security & your data - TailorMe by Res.Me",
  description:
    "How TailorMe protects resume data with row-level security, AES-256 encryption at rest, TLS in transit, controlled AI processing, user-managed erasure, Stripe payments, and OAuth sign-in.",
};

type SecurityItem = {
  icon: React.ReactNode;
  kicker: string;
  title: string;
  body: string;
};

const CONTROLS: SecurityItem[] = [
  {
    icon: <Lock size={19} />,
    kicker: "Identity",
    title: "Signed-in access only",
    body: "Real applications and saved resumes require an authenticated session. Demo data stays separate from account-backed data.",
  },
  {
    icon: <Database size={19} />,
    kicker: "Storage",
    title: "Owner-scoped resume records",
    body: "The resume table is designed around one owner per row, and API routes write the authenticated user id before saving.",
  },
  {
    icon: <Server size={19} />,
    kicker: "Server secrets",
    title: "Service-role keys stay server-side",
    body: "The Supabase service role is only used from server code for trusted operations like Stripe webhooks. It is never shipped to the browser.",
  },
  {
    icon: <LinkIcon size={19} />,
    kicker: "Job links",
    title: "SSRF-safe URL fetching",
    body: "When you paste a job URL, TailorMe reads public job pages and rejects internal, loopback, and cloud-metadata addresses.",
  },
  {
    icon: <FileText size={19} />,
    kicker: "Documents",
    title: "No file-conversion handoff",
    body: "PDF generation runs through our document pipeline instead of handing resume content to a third-party conversion API.",
  },
  {
    icon: <CreditCard size={19} />,
    kicker: "Payments",
    title: "Stripe handles card data",
    body: "Checkout happens through Stripe. TailorMe stores credit balances and payment status, not your raw card details.",
  },
  {
    icon: <KeyRound size={19} />,
    kicker: "Passwords",
    title: "OAuth sign-in, no password storage",
    body: "Google or LinkedIn sign-in keeps your password outside TailorMe. You can revoke access from the identity provider.",
  },
  {
    icon: <Trash2 size={19} />,
    kicker: "Erasure",
    title: "User-controlled deletion",
    body: "Account settings include controls to remove saved profiles, resumes, generated documents, and feedback history.",
  },
];

const FLOW = [
  {
    step: "01",
    title: "Upload",
    body: "Your resume is parsed into a structured profile and stored under your account boundary.",
  },
  {
    step: "02",
    title: "Tailor",
    body: "Only the resume and job context needed for the requested run is sent through the tailoring pipeline.",
  },
  {
    step: "03",
    title: "Review",
    body: "Specialist agent notes are stored with the application so you can inspect why a change was made.",
  },
  {
    step: "04",
    title: "Control",
    body: "You can export, correct, or erase account data through settings or a GDPR data request.",
  },
];

const BOUNDARIES = [
  "TailorMe is not claiming zero-knowledge or end-to-end encryption. The server must read your resume to parse, tailor, and compile it.",
  "We do not display SOC 2 or ISO badges until those audits exist. The page describes current product controls.",
  "AI providers are used to process the run you request. TailorMe does not sell resume data or use it to train its own models.",
];

export default function SecurityPage() {
  return (
    <div className="tm">
      <Nav active="" />
      <main>
        <section className="tm-sec tmF-head tmSec-hero">
          <span className="tm-pill">
            <Lock size={13} /> Security &amp; privacy
          </span>
          <h1 className="tm-h1">A practical trust page for a very personal file.</h1>
          <p className="tm-body">
            Your resume contains employment history, contact details, and career
            plans. TailorMe protects it with account isolation, specific
            encryption controls, limited AI processing, and user-managed data
            rights.
          </p>
        </section>

        <section className="tm-sec tmSec-band">
          <div className="tm-wrap">
            <div className="tmSec-top">
              <div>
                <span className="tm-eyebrow">
                  <ShieldCheck size={14} /> Security at a glance
                </span>
                <h2 className="tm-h2 mt-[10px]">Concrete controls, not just reassurance.</h2>
              </div>
              <p className="tm-body">
                Inspired by security pages that name the exact control, then say
                what it means for the user.
              </p>
            </div>
            <div className="tmSec-control-grid tmSec-control-grid--compact">
              {CONTROLS.slice(0, 4).map((item) => (
                <article className="tm-card tmSec-control" key={item.title}>
                  <span className="tmSec-icon" aria-hidden="true">
                    {item.icon}
                  </span>
                  <div>
                    <span className="tmSec-kicker">{item.kicker}</span>
                    <h3>{item.title}</h3>
                    <p>{item.body}</p>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="tm-sec">
          <div className="tm-wrap">
            <div className="tmSec-top">
              <div>
                <span className="tm-eyebrow">
                  <EyeOff size={14} /> How your resume is protected
                </span>
                <h2 className="tm-h2 mt-[10px]">The controls behind the claim.</h2>
              </div>
              <p className="tm-body">
                Each card maps to a real boundary in the app: account access,
                storage, AI processing, payments, or data rights.
              </p>
            </div>
            <div className="tmSec-control-grid">
              {CONTROLS.map((item) => (
                <article className="tm-card tmSec-control" key={item.title}>
                  <span className="tmSec-icon" aria-hidden="true">
                    {item.icon}
                  </span>
                  <div>
                    <span className="tmSec-kicker">{item.kicker}</span>
                    <h3>{item.title}</h3>
                    <p>{item.body}</p>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="tm-sec tm-tint--gray">
          <div className="tm-wrap tmSec-flow-wrap">
            <div className="tmSec-flow-copy">
              <span className="tm-eyebrow">
                <Globe size={14} /> Resume data flow
              </span>
              <h2 className="tm-h2 mt-[10px]">Know where the file goes.</h2>
              <p className="tm-body">
                A good security page should make the data path visible. TailorMe
                keeps the flow narrow: upload, tailor, review, control.
              </p>
            </div>
            <div className="tmSec-flow">
              {FLOW.map((item) => (
                <article className="tmSec-flow-step" key={item.step}>
                  <span>{item.step}</span>
                  <h3>{item.title}</h3>
                  <p>{item.body}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="tm-sec">
          <div className="tm-wrap tmSec-bottom">
            <div className="tm-card tmSec-boundaries">
              <span className="tm-eyebrow">
                <Shield size={14} /> Plain-language boundaries
              </span>
              <h2 className="tm-h2 mt-[10px]">What we are and are not claiming.</h2>
              <div className="tmSec-boundary-list">
                {BOUNDARIES.map((item) => (
                  <p key={item}>
                    <ShieldCheck size={15} /> {item}
                  </p>
                ))}
              </div>
            </div>
            <div className="tm-card tmSec-contact">
              <span className="tmSec-icon" aria-hidden="true">
                <UserCheck size={20} />
              </span>
              <h2>Need your data?</h2>
              <p>
                Request access, export, correction, restriction, objection, or
                erasure. We respond to GDPR data requests within one month.
              </p>
              <div className="tmSec-actions">
                <NextLink href={ROUTES.contact} className="tm-btn tm-btn--primary">
                  Contact us <ArrowRight size={15} />
                </NextLink>
                <NextLink href={ROUTES.privacy} className="tm-btn tm-btn--outline">
                  Privacy policy
                </NextLink>
              </div>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
