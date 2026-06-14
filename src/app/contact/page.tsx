import type { Metadata } from "next";
import { Check } from "lucide-react";
import Nav from "@/components/landing/nav";
import Footer from "@/components/landing/footer";
import ContactForm from "./contact-form";

export const metadata: Metadata = {
  title: "Contact — TailorMe by Res.Me",
};

const CONTACT_POINTS = [
  "Email us anytime at balzermw@gmail.com",
  "Data requests answered within 30 days (GDPR)",
  "Coaching scheduling handled by Michael directly",
];

export default function ContactPage() {
  return (
    <div className="tm">
      <Nav active="" />
      <main>
        <section className="tm-sec">
          <div
            className="tm-wrap grid grid-cols-[1fr_1.2fr] items-start gap-[56px]"
            style={{ maxWidth: "1000px" }}
          >
            <div>
              <h1 className="text-[clamp(30px,3.4vw,40px)] font-medium tracking-[-0.02em]">
                Contact us
              </h1>
              <p className="tm-body mt-[14px]">
                Questions about an application, credits, your data, or coaching
                with Michael — we answer everything within one business day.
              </p>
              <div className="tmB-creds mt-[26px]">
                {CONTACT_POINTS.map((t) => (
                  <span key={t} className="tmB-cred">
                    <Check size={12} /> {t}
                  </span>
                ))}
              </div>
            </div>
            <ContactForm />
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
