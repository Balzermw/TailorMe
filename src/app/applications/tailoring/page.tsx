import type { Metadata } from "next";
import Nav from "@/components/landing/nav";
import TailoringRunner from "./tailoring-runner";

export const metadata: Metadata = {
  title: "Tailoring your application · TailorMe by Res.Me",
};

// Server shell (Nav is a server component, so the page must be one too); the
// run logic + progress UI live in the client TailoringRunner.
export default function TailoringPage() {
  return (
    <div className="tm">
      <Nav active="Dashboard" />
      <main>
        <TailoringRunner />
      </main>
    </div>
  );
}
