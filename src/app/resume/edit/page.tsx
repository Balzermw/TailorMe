import type { Metadata } from "next";
import Nav from "@/components/landing/nav";
import { getSavedResumeDoc } from "@/lib/db";
import ResumeEditLoader from "./resume-edit-loader";
import "../../applications/[id]/print/print.css";
import "../../applications/[id]/edit/edit.css";

export const metadata: Metadata = {
  title: "Edit your resume · TailorMe by Res.Me",
};

// The base-resume editor — reuses the shared EditEditor with no application row.
// Unlike the tailored-application editor, this is part of the anon funnel, so
// there is NO supabase/auth redirect: the loader hydrates from the account when
// signed in, or from the browser otherwise.
export default async function ResumeEditPage() {
  const base = await getSavedResumeDoc();
  return (
    <div className="tm">
      <Nav active="Dashboard" />
      <main>
        <ResumeEditLoader
          serverDoc={base?.doc ?? null}
          serverProofPoints={base?.proofPoints ?? []}
        />
      </main>
    </div>
  );
}
