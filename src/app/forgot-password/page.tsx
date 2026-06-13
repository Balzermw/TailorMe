import type { Metadata } from "next";
import Nav from "@/components/landing/nav";
import Footer from "@/components/landing/footer";
import ForgotCard from "./forgot-card";

export const metadata: Metadata = {
  title: "Reset your password — TailorMe by Res.Me",
};

export default function ForgotPasswordPage() {
  return (
    <div className="tm">
      <Nav active="" />
      <main>
        <section className="tm-sec min-h-[calc(100vh_-_260px)] flex items-center justify-center">
          <ForgotCard />
        </section>
      </main>
      <Footer />
    </div>
  );
}
