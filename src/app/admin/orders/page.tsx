import type { Metadata } from "next";
import { redirect } from "next/navigation";
import Nav from "@/components/landing/nav";
import Footer from "@/components/landing/footer";
import { getServerUser } from "@/lib/auth-server";
import { getServiceSupabase } from "@/lib/supabase/admin";
import { isAdminEmail } from "@/lib/admin";
import { ROUTES } from "@/components/landing/data";
import AdminOrders, { type OrderRow } from "./admin-orders";

export const metadata: Metadata = {
  title: "Orders · Admin · TailorMe",
  robots: { index: false, follow: false },
};

export default async function AdminOrdersPage() {
  // Admin-gate: unknown / non-admin users are sent to the dashboard (don't
  // reveal the route exists). Re-checked again on the mutation API route.
  const user = await getServerUser();
  if (!user || !isAdminEmail(user.email)) redirect(ROUTES.dashboard);

  const svc = getServiceSupabase();
  let orders: OrderRow[] = [];
  if (svc) {
    const { data } = await svc
      .from("orders")
      .select(
        "id, created_at, plan_slug, credits, amount_cents, total_cents, expert_feedback, human_revision, fulfillment_status",
      )
      .order("created_at", { ascending: false })
      .limit(200);
    // Pending-first ordering is applied in the client component (alpha-sorting
    // 'done'|'none'|'pending' in SQL would put pending last).
    orders = (data ?? []) as OrderRow[];
  }

  return (
    <div className="tm">
      <Nav />
      <main>
        <section className="tm-sec">
          <div className="tm-wrap">
            <h1 className="tm-h2">Orders</h1>
            <p className="tm-body mt-[8px]">
              Human add-ons need a manual pass. Pending ones are highlighted —
              mark them fulfilled once the review/revision is delivered.
            </p>
            <div className="mt-[24px]">
              <AdminOrders initialOrders={orders} />
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
