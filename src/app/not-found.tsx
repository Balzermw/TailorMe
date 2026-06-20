import Link from "next/link";
import Nav from "@/components/landing/nav";
import Footer from "@/components/landing/footer";

export const metadata = { title: "Not found · TailorMe by Res.Me" };

export default function NotFound() {
  return (
    <div className="tm">
      <Nav />
      <section className="tm-sec">
        <div className="tm-wrap tm-wrap--narrow tm-cta">
          <span className="tm-pill tm-pill--gray">404</span>
          <h1 className="tm-h2">Page not found</h1>
          <p className="tm-body">
            The page you’re looking for doesn’t exist or may have moved.
          </p>
          <Link href="/" className="tm-btn tm-btn--primary">
            Back home
          </Link>
        </div>
      </section>
      <Footer />
    </div>
  );
}
