import type { Metadata } from "next";
import Nav from "@/components/landing/nav";
import Footer from "@/components/landing/footer";
import AuditWizard from "./audit-wizard";

export const metadata: Metadata = {
  title: "Get a free resume audit — TailorMe by Res.Me",
};

export default function AuditPage() {
  return (
    <div className="tm">
      <Nav active="" />
      <main>
        <AuditWizard />
      </main>
      <Footer />
    </div>
  );
}
