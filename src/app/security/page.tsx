import type { Metadata } from "next";
import Link from "next/link";
import {
  CreditCard,
  Globe,
  KeyRound,
  Lock,
  Server,
  Shield,
  ShieldCheck,
  Sparkles,
  Trash2,
} from "lucide-react";
import Nav from "@/components/landing/nav";
import Footer from "@/components/landing/footer";
import { ROUTES } from "@/components/landing/data";

export const metadata: Metadata = {
  title: "Security & your data — TailorMe by Res.Me",
  description:
    "How TailorMe protects your resume: row-level security, encryption at rest, one-click delete, SSRF-safe link fetching, Stripe payments, and OAuth sign-in.",
};

const ITEMS: { icon: React.ReactNode; title: string; body: string }[] = [
  {
    icon: <Lock size={20} strokeWidth={1.7} />,
    title: "Row-level security",
    body: "Every resume, application, and credit is locked to your account at the database level (Postgres row-level security). One person's data is never visible to another — the rule is enforced by the database itself, not just our app code, so even a bug on our side can't expose your data across accounts.",
  },
  {
    icon: <Shield size={20} strokeWidth={1.7} />,
    title: "Encrypted at rest and in transit",
    body: "Your data is stored on Supabase (managed Postgres), encrypted at rest, and every connection is TLS-encrypted in transit. No plaintext storage of your documents.",
  },
  {
    icon: <Trash2 size={20} strokeWidth={1.7} />,
    title: "Delete everything in one click",
    body: "Your saved resume and applications are yours to remove whenever you want — one click, gone for good. We don't keep shadow copies after you delete.",
  },
  {
    icon: <ShieldCheck size={20} strokeWidth={1.7} />,
    title: "We never train on your data",
    body: "Your resume and the job postings you paste are sent to the AI provider only to tailor your application. We don't use your data to train models, and we never sell it.",
  },
  {
    icon: <Globe size={20} strokeWidth={1.7} />,
    title: "Safe job-link fetching",
    body: "When you paste a job URL, we fetch it from our server with strict SSRF protection: we only read public job pages and refuse internal, loopback, or cloud-metadata addresses — so the feature can't be turned against private systems.",
  },
  {
    icon: <Server size={20} strokeWidth={1.7} />,
    title: "Your resume stays on our infrastructure",
    body: "PDF generation runs on our own document service. Your resume content isn't handed off to a third-party file-conversion API to leave our control.",
  },
  {
    icon: <CreditCard size={20} strokeWidth={1.7} />,
    title: "Payments handled by Stripe",
    body: "We never see or store your card details. Checkout runs entirely on Stripe; our system only learns that a payment succeeded so it can add your credits.",
  },
  {
    icon: <KeyRound size={20} strokeWidth={1.7} />,
    title: "Sign in without a password",
    body: "Use Continue with Google or LinkedIn — we never see your password, and you can revoke TailorMe's access at any time from your Google or LinkedIn account.",
  },
];

export default function SecurityPage() {
  return (
    <div className="tm">
      <Nav active="" />
      <main>
        <section className="tm-sec tmF-head" style={{ paddingBottom: 0 }}>
          <span className="tm-pill">
            <Lock size={13} /> Security &amp; privacy
          </span>
          <h1 className="tm-h1">Your data is yours.</h1>
          <p className="tm-body" style={{ maxWidth: "56ch" }}>
            A resume is personal. Here is exactly how TailorMe keeps yours
            private, isolated to your account, and under your control —
            in plain language, no jargon.
          </p>
        </section>

        <section className="tm-sec" style={{ paddingTop: "32px" }}>
          <div className="tm-wrap">
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(290px, 1fr))",
                gap: "18px",
              }}
            >
              {ITEMS.map((it) => (
                <div
                  key={it.title}
                  className="tm-card"
                  style={{ padding: "22px 24px" }}
                >
                  <span
                    style={{
                      display: "flex",
                      height: "42px",
                      width: "42px",
                      alignItems: "center",
                      justifyContent: "center",
                      borderRadius: "10px",
                      background: "var(--tm-blue-50)",
                      color: "var(--tm-blue-800)",
                      marginBottom: "14px",
                    }}
                    aria-hidden="true"
                  >
                    {it.icon}
                  </span>
                  <h3
                    style={{
                      fontSize: "16px",
                      fontWeight: 500,
                      marginBottom: "8px",
                    }}
                  >
                    {it.title}
                  </h3>
                  <p
                    style={{
                      fontSize: "13.5px",
                      lineHeight: 1.6,
                      color: "var(--tm-zinc)",
                    }}
                  >
                    {it.body}
                  </p>
                </div>
              ))}
            </div>

            <p
              className="tm-small text-center"
              style={{ marginTop: "30px", maxWidth: "60ch", marginInline: "auto" }}
            >
              Built on Supabase (managed Postgres) and Stripe. Questions about
              how we handle your data?{" "}
              <Link href={ROUTES.contact} style={{ color: "var(--tm-blue-600)" }}>
                Get in touch
              </Link>{" "}
              or read our{" "}
              <Link href={ROUTES.privacy} style={{ color: "var(--tm-blue-600)" }}>
                privacy policy
              </Link>
              .
            </p>

            <div style={{ textAlign: "center", marginTop: "24px" }}>
              <Link href={ROUTES.audit} className="tm-btn tm-btn--primary tm-btn--lg">
                <Sparkles size={16} /> Get your free resume audit
              </Link>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
