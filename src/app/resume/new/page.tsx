import type { Metadata } from "next";
import Nav from "@/components/landing/nav";
import ScratchBuilder from "./scratch-builder";
import "../../applications/[id]/edit/edit.css";
import "./new.css";

export const metadata: Metadata = {
  title: "Build a resume from scratch · TailorMe by Res.Me",
};

// Build-from-scratch entry: a guided minimum setup that assembles a normalized
// TailoredDoc, then hands off to the shared editor. No auth gate — part of the
// anon funnel.
export default function ResumeNewPage() {
  return (
    <div className="tm">
      <Nav active="" />
      <main>
        <ScratchBuilder />
      </main>
    </div>
  );
}
