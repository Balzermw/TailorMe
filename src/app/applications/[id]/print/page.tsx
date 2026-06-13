import type { Metadata } from "next";
import Link from "next/link";
import { getServerSupabase } from "@/lib/supabase/server";
import type { ApplyResult } from "@/lib/types";
import { ROUTES } from "@/components/landing/data";
import PrintDoc from "./print-doc";
import "./print.css";

export const metadata: Metadata = {
  title: "Tailored document — TailorMe by Res.Me",
};

export default async function PrintPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const sb = await getServerSupabase();
  const app = sb
    ? (
        await sb
          .from("applications")
          .select("company,role,result")
          .eq("id", id)
          .single()
      ).data
    : null;

  const result = (app?.result ?? null) as ApplyResult | null;

  if (!result?.doc) {
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
      <PrintDoc doc={result.doc} />
    </div>
  );
}
