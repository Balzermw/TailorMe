import type { Metadata } from "next";
import Nav from "@/components/landing/nav";
import Footer from "@/components/landing/footer";
import SettingsContent from "./settings-content";

export const metadata: Metadata = {
  title: "Account settings — TailorMe by Res.Me",
};

export default function SettingsPage() {
  return (
    <div className="tm">
      <Nav active="Dashboard" />
      <main>
        <SettingsContent />
      </main>
      <Footer />
    </div>
  );
}
