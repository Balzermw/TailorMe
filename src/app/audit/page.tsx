import type { Metadata } from "next";
import { Suspense } from "react";
import Nav from "@/components/landing/nav";
import Footer from "@/components/landing/footer";
import AuditWizard from "./audit-wizard";

export const metadata: Metadata = {
  title: "Get a free resume audit · TailorMe by Res.Me",
};

export default function AuditPage() {
  return (
    <div className="tm">
      <Nav active="" />
      <main>
        {/* AuditWizard reads ?start via useSearchParams → needs a Suspense boundary */}
        <Suspense fallback={null}>
          <AuditWizard />
        </Suspense>
      </main>
      <Footer />
    </div>
  );
}
