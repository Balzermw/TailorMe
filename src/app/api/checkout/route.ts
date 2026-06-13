import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { APP_URL, stripeConfigured } from "@/lib/config";
import { stripe } from "@/lib/stripe";
import { getServerSupabase } from "@/lib/supabase/server";
import { getPack, MICHAEL_ADDON_CENTS } from "@/lib/packs";

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

  let body: { packId?: string; addon?: boolean };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const pack = getPack(body.packId ?? "");
  if (!pack) {
    return NextResponse.json({ error: "Unknown pack." }, { status: 400 });
  }

  const line_items: Stripe.Checkout.SessionCreateParams.LineItem[] = [
    {
      price_data: {
        currency: "usd",
        product_data: {
          name: `TailorMe — ${pack.name} (${pack.credits} applications)`,
        },
        unit_amount: pack.amountCents,
      },
      quantity: 1,
    },
  ];
  if (body.addon) {
    line_items.push({
      price_data: {
        currency: "usd",
        product_data: { name: "Michael's expert review (1 application)" },
        unit_amount: MICHAEL_ADDON_CENTS,
      },
      quantity: 1,
    });
  }

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    line_items,
    customer_email: user.email ?? undefined,
    success_url: `${APP_URL}/buy-credits?success=1`,
    cancel_url: `${APP_URL}/buy-credits?canceled=1`,
    metadata: {
      userId: user.id,
      credits: String(pack.credits),
      addon: body.addon ? "1" : "0",
    },
  });

  return NextResponse.json({ url: session.url });
}
