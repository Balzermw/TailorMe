import type { Metadata } from "next";
import Link from "next/link";
import { getServerSupabase } from "@/lib/supabase/server";
import type { ApplyResult, TailoredDoc } from "@/lib/types";
import { SAMPLE_DOC } from "@/lib/apply/sample";
import { clampToTwoPages } from "@/lib/apply/latex";
import { E2E_AGENT_REVIEW_APP_ID, E2E_REVISION_APP_ID } from "@/lib/e2e/revision-fixture";
import { ROUTES } from "@/components/landing/data";
import PrintDoc from "./print-doc";
import E2ERevisionPrint from "./e2e-revision-print";
import LocalApplicationPrintLoader from "./local-application-print-loader";
import "./print.css";

export const metadata: Metadata = {
  title: "Tailored document · TailorMe by Res.Me",
};

export default async function PrintPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  if (
    process.env.E2E_TEST_MODE === "1" &&
    (id === E2E_REVISION_APP_ID || id === E2E_AGENT_REVIEW_APP_ID)
  ) {
    return (
      <div className="tm">
        <E2ERevisionPrint id={id} />
      </div>
    );
  }

  let doc: TailoredDoc | null = null;
  if (id === "sample") {
    doc = SAMPLE_DOC; // previewable in demo mode (labeled composite)
  } else {
    const sb = await getServerSupabase();
    if (!sb) {
      return (
        <div className="tm">
          <LocalApplicationPrintLoader id={id} />
        </div>
      );
    }
    const app = sb
      ? (
          await sb
            .from("applications")
            .select("result")
            .eq("id", id)
            .single()
        ).data
      : null;
    doc = ((app?.result ?? null) as ApplyResult | null)?.doc ?? null;
  }

  if (!doc) {
    return (
      <div className="tm" style={{ padding: "64px 24px", textAlign: "center" }}>
        <p className="tm-body">
          This document isn’t available.{" "}
          <Link href={ROUTES.dashboard} style={{ color: "var(--tm-blue-600)" }}>
            Back to dashboard
          </Link>
        </p>
      </div>
    );
  }

  return (
    <div className="tm">
      <PrintDoc doc={clampToTwoPages(doc)} id={id} />
    </div>
  );
}
