import type { Metadata } from "next";
import Link from "next/link";
import Nav from "@/components/landing/nav";
import { supabaseConfigured } from "@/lib/config";
import { getApplication } from "@/lib/db";
import { E2E_REVISION_APP_ID } from "@/lib/e2e/revision-fixture";
import { ROUTES } from "@/components/landing/data";
import EditEditor from "./edit-editor";
import E2ERevisionEditor from "./e2e-revision-editor";
import LocalApplicationEditLoader from "./local-application-edit-loader";
import "../print/print.css";
import "./edit.css";

export const metadata: Metadata = {
  title: "Edit your tailored resume · TailorMe by Res.Me",
};

// The resume editor: review + edit the tailored document, then save. Editing is
// for signed-in owners only (the full run is auth+credit-gated), so demo mode
// and sample docs have no editable row — they redirect/notice out.
export default async function EditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (process.env.E2E_TEST_MODE === "1" && id === E2E_REVISION_APP_ID) {
    return (
      <div className="tm">
        <Nav active="Dashboard" />
        <main>
          <E2ERevisionEditor id={id} />
        </main>
      </div>
    );
  }

  if (!supabaseConfigured) {
    return (
      <div className="tm">
        <Nav active="Dashboard" />
        <main>
          <LocalApplicationEditLoader id={id} />
        </main>
      </div>
    );
  }

  const app = await getApplication(id);
  const doc = app?.result?.doc ?? null;

  return (
    <div className="tm">
      <Nav active="Dashboard" />
      <main>
        {doc && app ? (
          <EditEditor
            id={id}
            doc={doc}
            originalDoc={app.result?.originalDoc ?? null}
            bulletDiffs={app.result?.bulletDiffs ?? []}
            initialDecisions={app.result?.edits?.decisions ?? {}}
            keywords={app.result?.keywords ?? []}
            verificationStatus={app.result?.verification?.status ?? null}
            initialUserEdited={app.result?.edits?.userEdited ?? false}
            proofPoints={app.result?.proofPoints ?? []}
            company={app.company}
            role={app.role}
            initialFit={app.result?.fit ?? null}
            initialHistory={app.result?.fitHistory}
            canRecheck={Boolean(app.result?.postingText)}
          />
        ) : (
          <div style={{ padding: "64px 24px", textAlign: "center" }}>
            <p className="tm-body">
              This document isn’t available to edit.{" "}
              <Link href={ROUTES.dashboard} style={{ color: "var(--tm-blue-600)" }}>
                Back to dashboard
              </Link>
            </p>
          </div>
        )}
      </main>
    </div>
  );
}
