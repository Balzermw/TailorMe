import { NextResponse } from "next/server";
import { getServerUser } from "@/lib/auth-server";
import { isAdminEmail } from "@/lib/admin";
import { getServiceSupabase } from "@/lib/supabase/admin";

// Toggle an order's fulfillment status (admin only). Re-checks admin on the
// server — never trusts the client. Service role bypasses RLS to write.
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const orderId = Number(id);
  if (!Number.isInteger(orderId) || orderId <= 0) {
    return NextResponse.json({ error: "Invalid order id." }, { status: 400 });
  }

  const user = await getServerUser();
  if (!user || !isAdminEmail(user.email)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: { status?: string };
  try {
    body = await request.json();
  } catch {
    body = {};
  }
  // Only the fulfillment lifecycle values may be set.
  const status =
    body.status === "pending" ? "pending" : body.status === "done" ? "done" : null;
  if (!status) {
    return NextResponse.json({ error: "Invalid status." }, { status: 400 });
  }

  const svc = getServiceSupabase();
  if (!svc) {
    return NextResponse.json({ error: "Not configured." }, { status: 503 });
  }

  const { error } = await svc
    .from("orders")
    .update({ fulfillment_status: status })
    .eq("id", Number(id));
  if (error) {
    return NextResponse.json({ error: "Update failed." }, { status: 500 });
  }
  return NextResponse.json({ ok: true, status });
}
