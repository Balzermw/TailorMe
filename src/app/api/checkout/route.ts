import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { APP_URL, stripeConfigured } from "@/lib/config";
import { stripe } from "@/lib/stripe";
import { getServerSupabase } from "@/lib/supabase/server";
import { getPlan, resolveAddOns, buildCheckout } from "@/lib/packs";
import { CHECKOUT_RULES, rateLimitDisabled } from "@/lib/limits";
import { consume, tooManyRequests } from "@/lib/rate-limit";

export async function POST(request: Request) {
  // Not configured → tell the client to run the demo success animation.
  if (!stripeConfigured || !stripe) {
    return NextResponse.json({ demo: true });
  }

  const sb = await getServerSupabase();
  const user = sb ? (await sb.auth.getUser()).data.user : null;
  if (!user) {
    return NextResponse.json(
      { error: "Sign in to buy credits.", signin: true },
      { status: 401 },
    );
  }

  // Anti-spam: bound checkout-session creation per account.
  if (!rateLimitDisabled) {
    const rl = consume(`checkout:${user.id}`, CHECKOUT_RULES);
    if (!rl.allowed) {
      return tooManyRequests("Too many checkout attempts. Try again shortly.", rl.resetAt);
    }
  }

  // Accept the new plan slug; fall back to the legacy `packId` field name.
  let body: { planSlug?: string; packId?: string; addOns?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const plan = getPlan(body.planSlug ?? body.packId ?? "");
  if (!plan) {
    return NextResponse.json({ error: "Unknown plan." }, { status: 400 });
  }
  const addOns = resolveAddOns(body.addOns); // validated + deduped server-side
  const checkout = buildCheckout(plan, addOns);

  // Use a pre-created Stripe Price when configured, else inline price_data so
  // dev/demo works without Stripe products.
  const line_items: Stripe.Checkout.SessionCreateParams.LineItem[] =
    checkout.lineItems.map((li) =>
      li.priceId
        ? { price: li.priceId, quantity: 1 }
        : {
            price_data: {
              currency: "usd",
              product_data: { name: li.name },
              unit_amount: li.amountCents,
            },
            quantity: 1,
          },
    );

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    line_items,
    customer_email: user.email ?? undefined,
    success_url: `${APP_URL}/buy-credits?success=1&plan=${plan.slug}&ef=${
      checkout.expertFeedbackAdded ? 1 : 0
    }&hr=${checkout.humanRevisionAdded ? 1 : 0}&rev=${checkout.totalCents}`,
    cancel_url: `${APP_URL}/buy-credits?canceled=1`,
    // The webhook reads this to grant credits + record the order. Add-ons never
    // add credits — only `credits` (the plan) is granted.
    metadata: {
      userId: user.id,
      kind: "credits",
      planSlug: plan.slug,
      credits: String(checkout.credits),
      planCents: String(plan.amountCents),
      totalCents: String(checkout.totalCents),
      expertFeedback: checkout.expertFeedbackAdded ? "1" : "0",
      humanRevision: checkout.humanRevisionAdded ? "1" : "0",
    },
  });

  return NextResponse.json({ url: session.url });
}
