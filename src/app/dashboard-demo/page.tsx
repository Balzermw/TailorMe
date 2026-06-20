import type { Metadata } from "next";
import Nav from "@/components/landing/nav";
import Footer from "@/components/landing/footer";
import DemoBody from "./demo-body";

// TEMPORARY preview route — renders the demo dashboard (DashboardClient) with
// sample applications, bypassing Supabase auth, so the redesigned dashboard can
// be tested with data. Safe to delete: remove this folder.

export const metadata: Metadata = {
  title: "Dashboard demo · TailorMe",
};

export default function DashboardDemoPage() {
  return (
    <div className="tm">
      <Nav active="Dashboard" />
      <main>
        <DemoBody />
      </main>
      <Footer />
    </div>
  );
}
