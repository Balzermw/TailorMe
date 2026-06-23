import type { Metadata } from "next";
import { Suspense } from "react";
import { FileText } from "lucide-react";
import Nav from "@/components/landing/nav";
import Footer from "@/components/landing/footer";
import CreditsPurchase from "./credits-purchase";

export const metadata: Metadata = {
  title: "Buy credits · TailorMe by Res.Me",
};

export default function BuyCreditsPage() {
  return (
    <div className="tm">
      <Nav active="Pricing" />
      <main>
        <section className="tm-sec tmF-head" style={{ paddingBottom: 0 }}>
          <span className="tm-pill tmCR-balance">
            <FileText size={13} /> Your balance: 1 free application
          </span>
          <h1 className="tm-h1">Buy credits</h1>
          <p className="tm-body">
            One credit = one application: fit score, tailored resume + cover
            letter, and full agent review. Add human feedback at checkout when
            one application needs extra eyes. Credits never expire.
          </p>
        </section>
        <Suspense fallback={null}>
          <CreditsPurchase />
        </Suspense>
      </main>
      <Footer />
    </div>
  );
}
