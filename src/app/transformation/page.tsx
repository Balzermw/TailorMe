import type { Metadata } from "next";
import Nav from "@/components/landing/nav";
import Footer from "@/components/landing/footer";
import CaseHeader from "@/components/transformation/case-header";
import JobFit from "@/components/transformation/job-fit";
import DocsCompare from "@/components/transformation/docs-compare";
import AgentNotes from "@/components/transformation/agent-notes";
import FinalCta from "@/components/transformation/final-cta";

export const metadata: Metadata = {
  title: "A real transformation — TailorMe by Res.Me",
};

export default function TransformationPage() {
  return (
    <div className="tm">
      <Nav active="" />
      <main>
        <CaseHeader />
        <JobFit />
        <DocsCompare />
        <AgentNotes />
        <FinalCta />
      </main>
      <Footer />
    </div>
  );
}
