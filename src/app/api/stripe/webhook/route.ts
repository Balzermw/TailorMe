import { NextResponse } from "next/server";
import { STRIPE_WEBHOOK_SECRET, stripeWebhookConfigured } from "@/lib/config";
import { stripe } from "@/lib/stripe";
import { getServiceSupabase } from "@/lib/supabase/admin";

// Stripe sends the raw body; we must verify the signature against it before
// trusting anything. Credits are granted with the service-role client.
export async function POST(request: Request) {
  if (!stripeWebhookConfigured || !stripe) {
    return NextResponse.json({ error: "Webhook not configured." }, { status: 503 });
  }

  const rawBody = await request.text();
  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return new Response("Missing signature", { status: 400 });
  }

  let event;
  try {
    event = stripe.webhooks.constructEvent(
      rawBody,
      signature,
      STRIPE_WEBHOOK_SECRET!,
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "invalid";
    return new Response(`Webhook signature error: ${message}`, { status: 400 });
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object;
    const meta = session.metadata ?? {};
    const userId = meta.userId;
    const kind = meta.kind;
    const applicationId = meta.applicationId;
    const credits = Number(meta.credits ?? 0);

    if (kind === "review" && userId && applicationId) {
      // Per-application Expert Feedback paid for → mark it in review. Scoped to
      // the owner; setting fixed values makes a replayed event a no-op.
      const admin = getServiceSupabase();
      if (admin) {
        await admin
          .from("applications")
          .update({ michael_status: "requested", status: "human_review" })
          .eq("id", applicationId)
          .eq("user_id", userId);
      }
    } else if (userId && credits > 0) {
      const admin = getServiceSupabase();
      if (admin) {
        // Grant the plan's credits. Idempotent on the session id — a replayed
        // event grants nothing extra. Add-ons never add credits.
        await admin.rpc("add_credits", {
          p_user_id: userId,
          p_credits: credits,
          p_reason: "purchase",
          p_stripe_session_id: session.id,
        });

        // Record the order (plan + add-on flags + revenue) for fulfillment +
        // admin visibility. Unique on stripe_session_id → replay-safe.
        const expertFeedback = meta.expertFeedback === "1";
        const humanRevision = meta.humanRevision === "1";
        await admin.from("orders").upsert(
          {
            user_id: userId,
            plan_slug: meta.planSlug ?? "unknown",
            credits,
            amount_cents: Number(meta.planCents ?? 0),
            total_cents: Number(meta.totalCents ?? 0),
            expert_feedback: expertFeedback,
            human_revision: humanRevision,
            stripe_session_id: session.id,
            // Human add-ons need manual fulfillment; flag them for the admin queue.
            fulfillment_status: expertFeedback || humanRevision ? "pending" : "none",
          },
          { onConflict: "stripe_session_id" },
        );
      }
    }
  }

  return NextResponse.json({ received: true });
}
