import type { Metadata } from "next";
import Nav from "@/components/landing/nav";
import Footer from "@/components/landing/footer";
import DemoBody from "./demo-body";

// TEMPORARY preview route — renders the local dashboard path without Supabase.
// It intentionally does not seed sample applications.

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
