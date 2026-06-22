// Central pricing config: credit plans + human add-ons. Single source of truth
// shared by the buy-credits UI, the Stripe checkout route, and the webhook so
// amounts, granted credits, and Stripe price IDs always agree. Mirrors the
// display PRICING in components/landing/data.ts.
//
// Add-ons NEVER grant application credits — only plans do. Stripe price IDs are
// optional: when set (env), checkout uses the Price ID; otherwise it computes
// inline price_data from amountCents so dev/demo works with no Stripe products.

import {
  STRIPE_PRICE_STARTER,
  STRIPE_PRICE_JOB_HUNT,
  STRIPE_PRICE_CAMPAIGN,
  STRIPE_PRICE_EXPERT_FEEDBACK,
  STRIPE_PRICE_HUMAN_REVISION,
} from "@/lib/config";

export type PlanSlug = "starter" | "job_hunt" | "campaign";
export type AddOnSlug = "expert_feedback" | "human_revision";

export interface Plan {
  slug: PlanSlug;
  name: string;
  credits: number;
  amountCents: number;
  /** Per-application display price, e.g. "$5.80". */
  per: string;
  stripePriceId?: string;
}

export interface AddOn {
  slug: AddOnSlug;
  name: string;
  amountCents: number;
  /** Always 0 — add-ons are human labor, not application credits. */
  grantsCredits: 0;
  stripePriceId?: string;
}

export const PLANS: Record<PlanSlug, Plan> = {
  starter: {
    slug: "starter",
    name: "Starter",
    credits: 5,
    amountCents: 2900,
    per: "$5.80",
    stripePriceId: STRIPE_PRICE_STARTER,
  },
  job_hunt: {
    slug: "job_hunt",
    name: "Job Hunt",
    credits: 15,
    amountCents: 6900,
    per: "$4.60",
    stripePriceId: STRIPE_PRICE_JOB_HUNT,
  },
  campaign: {
    slug: "campaign",
    name: "Campaign",
    credits: 35,
    amountCents: 12900,
    per: "$3.69",
    stripePriceId: STRIPE_PRICE_CAMPAIGN,
  },
};

export const ADD_ONS: Record<AddOnSlug, AddOn> = {
  expert_feedback: {
    slug: "expert_feedback",
    name: "Expert Feedback",
    amountCents: 7900,
    grantsCredits: 0,
    stripePriceId: STRIPE_PRICE_EXPERT_FEEDBACK,
  },
  human_revision: {
    slug: "human_revision",
    name: "Human Revision",
    amountCents: 14900,
    grantsCredits: 0,
    stripePriceId: STRIPE_PRICE_HUMAN_REVISION,
  },
};

/** The full white-glove service is a sales anchor only — no self-serve checkout. */
export const WHITE_GLOVE_FROM_CENTS = 22500;

/** Per-application Expert Feedback (the dashboard human-review upsell) price. */
export const EXPERT_FEEDBACK_CENTS = ADD_ONS.expert_feedback.amountCents;

export function getPlan(slug: string): Plan | null {
  return (PLANS as Record<string, Plan>)[slug] ?? null;
}

export function getAddOn(slug: string): AddOn | null {
  return (ADD_ONS as Record<string, AddOn>)[slug] ?? null;
}

/** Validate + dedupe a client-supplied list of add-on slugs into real AddOns. */
export function resolveAddOns(slugs: unknown): AddOn[] {
  if (!Array.isArray(slugs)) return [];
  const seen = new Set<string>();
  const out: AddOn[] = [];
  for (const s of slugs) {
    if (typeof s !== "string" || seen.has(s)) continue;
    const a = getAddOn(s);
    if (a) {
      seen.add(s);
      out.push(a);
    }
  }
  return out;
}

export interface CheckoutLineItem {
  /** Stripe Price ID when configured; otherwise build price_data from name+amount. */
  priceId?: string;
  name: string;
  amountCents: number;
}

export interface CheckoutPlan {
  credits: number;
  totalCents: number;
  expertFeedbackAdded: boolean;
  humanRevisionAdded: boolean;
  lineItems: CheckoutLineItem[];
}

/**
 * Pure checkout builder (no Stripe calls) — turns a plan + validated add-ons
 * into line items, the credits to grant (plan only; add-ons grant none), the
 * total, and the add-on flags for order metadata. Tested directly.
 */
export function buildCheckout(plan: Plan, addOns: AddOn[]): CheckoutPlan {
  const lineItems: CheckoutLineItem[] = [
    {
      priceId: plan.stripePriceId,
      name: `TailorMe · ${plan.name} (${plan.credits} applications)`,
      amountCents: plan.amountCents,
    },
    ...addOns.map((a) => ({
      priceId: a.stripePriceId,
      name: `${a.name} add-on`,
      amountCents: a.amountCents,
    })),
  ];
  const addOnCents = addOns.reduce((s, a) => s + a.amountCents, 0);
  return {
    credits: plan.credits,
    totalCents: plan.amountCents + addOnCents,
    expertFeedbackAdded: addOns.some((a) => a.slug === "expert_feedback"),
    humanRevisionAdded: addOns.some((a) => a.slug === "human_revision"),
    lineItems,
  };
}
