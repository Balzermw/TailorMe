import type { Metadata } from "next";
import Nav from "@/components/landing/nav";
import Footer from "@/components/landing/footer";
import Booking from "./booking";

export const metadata: Metadata = {
  title: "Book a session with Michael — TailorMe by Res.Me",
};

export default function BookSessionPage() {
  return (
    <div className="tm">
      <Nav active="Coaching" />
      <main>
        <section className="tm-sec tmF-head" style={{ paddingBottom: 0 }}>
          <span className="tm-pill">Coaching</span>
          <h1 className="tm-h1">Book a session with Michael</h1>
          <p className="tm-body">
            Pick a package, then grab a free 30-minute intro slot on Michael’s
            calendar — you’ll get a confirmation and the meeting link by email.
          </p>
        </section>
        <Booking />
      </main>
      <Footer />
    </div>
  );
}
