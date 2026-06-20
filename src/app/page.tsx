import Nav from "@/components/landing/nav";
import Hero from "@/components/landing/hero";
import Pains from "@/components/landing/pains";
import Guide from "@/components/landing/guide";
import RunTimeline from "@/components/landing/run-timeline";
import ResultDocs from "@/components/landing/result-docs";
import Pricing from "@/components/landing/pricing";
import Faq from "@/components/landing/faq";
import FinalCta from "@/components/landing/final-cta";
import Footer from "@/components/landing/footer";

export default function Home() {
  return (
    <div className="tm">
      <Nav active="Home" />
      <main>
        <Hero />
        <Pains />
        <Guide />
        <RunTimeline />
        <ResultDocs />
        <Pricing />
        <Faq />
        <FinalCta />
      </main>
      <Footer />
    </div>
  );
}
