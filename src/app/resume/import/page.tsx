import type { Metadata } from "next";
import Nav from "@/components/landing/nav";
import PasteImport from "./paste-import";
import "../../applications/[id]/edit/edit.css";
import "../new/new.css";

export const metadata: Metadata = {
  title: "Import a resume · TailorMe by Res.Me",
};

// Paste-import entry (the "I have some info, but no resume" path). No auth gate.
export default function ResumeImportPage() {
  return (
    <div className="tm">
      <Nav active="" />
      <main>
        <PasteImport />
      </main>
    </div>
  );
}
