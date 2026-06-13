import type { Metadata } from "next";
import Nav from "@/components/landing/nav";
import Footer from "@/components/landing/footer";
import DashboardClient from "./dashboard-client";

export const metadata: Metadata = {
  title: "Dashboard — TailorMe by Res.Me",
};

export default function DashboardPage() {
  return (
    <div className="tm">
      <Nav active="Dashboard" />
      <main>
        <DashboardClient />
      </main>
      <Footer />
    </div>
  );
}
