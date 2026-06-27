import type { Metadata } from "next";
import { redirect } from "next/navigation";
import Nav from "@/components/landing/nav";
import Footer from "@/components/landing/footer";
import { supabaseConfigured } from "@/lib/config";
import { getServerUser } from "@/lib/auth-server";
import { getProfile, listApplications, getSavedResumeDoc } from "@/lib/db";
import { ROUTES } from "@/components/landing/data";
import DashboardClient from "./dashboard-client";
import DashboardLive from "./dashboard-live";

export const metadata: Metadata = {
  title: "Dashboard · TailorMe by Res.Me",
};

export default async function DashboardPage({
  searchParams,
}: {
  searchParams?: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const params = searchParams ? await searchParams : {};
  const review = Array.isArray(params.review) ? params.review[0] : params.review;
  const viewParam = Array.isArray(params.view) ? params.view[0] : params.view;
  const initialView = viewParam === "docs" ? "docs" : "apps";
  const reviewNotice =
    review === "requested"
      ? "Michael's review has been requested. We'll show it here as soon as checkout is confirmed."
      : review === "canceled"
        ? "The expert review checkout was canceled. Nothing was changed."
        : null;
  let body = <DashboardClient initialView={initialView} />; // demo mode (no Supabase)

  if (supabaseConfigured) {
    const user = await getServerUser();
    if (!user) redirect(ROUTES.signIn);
    const [profile, apps, base] = await Promise.all([
      getProfile(),
      listApplications(),
      getSavedResumeDoc(),
    ]);
    body = (
      <DashboardLive
        user={user}
        credits={profile?.credits ?? 0}
        apps={apps}
        baseResume={base?.doc ?? null}
        baseResumeId={base?.id ?? null}
        sourceResumeName={base?.name ?? null}
        sourceResumeText={base?.text ?? null}
        sourceFeedbackCount={base?.proofPoints?.length ?? 0}
        initialView={initialView}
        reviewNotice={reviewNotice}
      />
    );
  }

  return (
    <div className="tm">
      <Nav active="Dashboard" />
      <main>{body}</main>
      <Footer />
    </div>
  );
}
