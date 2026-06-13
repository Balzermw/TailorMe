import Link from "next/link";
import { ShieldCheck } from "lucide-react";
import Nav from "@/components/landing/nav";
import Footer from "@/components/landing/footer";
import { ROUTES } from "@/components/landing/data";

export type LegalDocData = {
  title: string;
  updated: string;
  sections: ReadonlyArray<readonly [string, string]>;
};

export default function LegalDoc({ doc }: { doc: LegalDocData }) {
  return (
    <div className="tm">
      <Nav active="" />
      <main>
        <section className="tm-sec">
          {/* design: tm-wrap--narrow (max-width 880px, centered) */}
          <div className="max-w-[880px] mx-auto">
            <h1 className="text-[clamp(30px,3.4vw,40px)] font-medium tracking-[-0.02em]">
              {doc.title}
            </h1>
            <p className="tm-small mt-[10px]">{doc.updated}</p>
            <div className="tmL-doc">
              {doc.sections.map(([h, body]) => (
                <div key={h} className="tmL-sec">
                  <h2>{h}</h2>
                  <p>{body}</p>
                </div>
              ))}
            </div>
            <div className="tm-card mt-[40px] flex flex-wrap items-center gap-[14px] px-[24px] py-[20px]">
              <ShieldCheck
                size={18}
                className="shrink-0 text-[var(--tm-mint-600)]"
                aria-hidden
              />
              <p className="tm-small min-w-[240px] flex-1">
                Questions about your data or these terms?
              </p>
              <Link
                className="tm-btn tm-btn--outline tm-btn--sm"
                href={ROUTES.contact}
              >
                Contact us
              </Link>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
