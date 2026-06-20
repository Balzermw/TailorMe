import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { APP_URL, stripeConfigured } from "@/lib/config";
import { stripe } from "@/lib/stripe";
import { getServerSupabase } from "@/lib/supabase/server";
import { MICHAEL_ADDON_CENTS } from "@/lib/packs";
import { REVIEW_RULES, rateLimitDisabled } from "@/lib/limits";
import { consume, tooManyRequests } from "@/lib/rate-limit";
import type { ApplyResult } from "@/lib/types";

// Requests Michael's human review for one specific application: creates a $49
// Stripe Checkout session tagged with the applicationId. On payment, the Stripe
// webhook flips that application's michael_status (see api/stripe/webhook).
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const sb = await getServerSupabase();
  const user = sb ? (await sb.auth.getUser()).data.user : null;
  if (!sb || !user) {
    return NextResponse.json(
      { error: "Sign in to request a review.", signin: true },
      { status: 401 },
    );
  }

  // Anti-spam: bound review-checkout creation per account.
  if (!rateLimitDisabled) {
    const rl = consume(`review:${user.id}`, REVIEW_RULES);
    if (!rl.allowed) {
      return tooManyRequests("Too many review requests. Try again shortly.", rl.resetAt);
    }
  }

  // The application must exist, belong to this user, and be tailored (has a doc
  // to review). RLS also scopes this to the user, but we check explicitly.
  const { data: app } = await sb
    .from("applications")
    .select("id,status,michael_status,result,role,company")
    .eq("id", id)
    .single();
  if (!app) {
    return NextResponse.json({ error: "Application not found." }, { status: 404 });
  }
  const hasDoc = ((app.result ?? null) as ApplyResult | null)?.doc != null;
  if (app.status !== "ready" || !hasDoc) {
    return NextResponse.json(
      { error: "Run the full tailoring first. Michael reviews the finished draft." },
      { status: 409 },
    );
  }
  if (app.michael_status && app.michael_status !== "none") {
    return NextResponse.json(
      { error: "Michael's review is already underway for this application." },
      { status: 409 },
    );
  }

  // Not configured → tell the client to show the simulated/demo state.
  if (!stripeConfigured || !stripe) {
    return NextResponse.json({ demo: true });
  }

  const line_items: Stripe.Checkout.SessionCreateParams.LineItem[] = [
    {
      price_data: {
        currency: "usd",
        product_data: {
          name: `Michael's expert review · ${app.role} @ ${app.company}`,
        },
        unit_amount: MICHAEL_ADDON_CENTS,
      },
      quantity: 1,
    },
  ];

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    line_items,
    customer_email: user.email ?? undefined,
    success_url: `${APP_URL}/dashboard?review=requested`,
    cancel_url: `${APP_URL}/dashboard?review=canceled`,
    metadata: {
      userId: user.id,
      applicationId: id,
      kind: "review",
    },
  });

  return NextResponse.json({ url: session.url });
}
