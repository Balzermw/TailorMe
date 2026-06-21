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

export default async function DashboardPage() {
  let body = <DashboardClient />; // demo mode (no Supabase)

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
