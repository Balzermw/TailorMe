"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Check, Lock, ShieldCheck } from "lucide-react";
import { ROUTES } from "@/components/landing/data";
import {
  PLANS,
  ADD_ONS,
  getPlan,
  type PlanSlug,
  type AddOnSlug,
} from "@/lib/packs";
import { track, deviceClass } from "@/lib/track";

const PLAN_LIST = Object.values(PLANS);
const ADDON_LIST = Object.values(ADD_ONS);
const money = (cents: number) => `$${(cents / 100).toFixed(cents % 100 ? 2 : 0)}`;

// Add-on slug → the telemetry event family it uses (expert_review / human_revision).
const ADDON_EVENT: Record<AddOnSlug, "expert_review" | "human_revision"> = {
  expert_feedback: "expert_review",
  human_revision: "human_revision",
};

export default function CreditsPurchase() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const planParam = searchParams.get("plan");
  const initialSlug: PlanSlug = getPlan(planParam ?? "")?.slug ?? "job_hunt";
  const [sel, setSel] = useState<PlanSlug>(initialSlug);
  const [addOns, setAddOns] = useState<Set<AddOnSlug>>(new Set());
  const [paid, setPaid] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const plan = PLANS[sel];
  const selectedAddOns = useMemo(
    () => ADDON_LIST.filter((a) => addOns.has(a.slug)),
    [addOns],
  );
  const addOnCents = selectedAddOns.reduce((s, a) => s + a.amountCents, 0);
  const totalCents = plan.amountCents + addOnCents;

  // Returning from Stripe Checkout (?success=1) or the demo "Pay" both show success.
  const showSuccess = paid || searchParams.get("success") === "1";

  // Page view + the add-on offers being on screen (checkout location).
  useEffect(() => {
    track("pricing_viewed", { location: "checkout", device: deviceClass() });
    track("expert_review_viewed", { location: "checkout" });
    track("human_revision_viewed", { location: "checkout" });
  }, []);

  const selectPlan = (slug: PlanSlug) => {
    setSel(slug);
    const p = PLANS[slug];
    track("plan_card_clicked", {
      plan_slug: p.slug,
      plan_price: p.amountCents / 100,
      credits: p.credits,
      per_application_price: p.per,
      location: "checkout",
    });
  };

  const toggleAddOn = (slug: AddOnSlug) => {
    setAddOns((prev) => {
      const next = new Set(prev);
      const adding = !next.has(slug);
      if (adding) next.add(slug);
      else next.delete(slug);
      const family = ADDON_EVENT[slug];
      track(`${family}_${adding ? "added" : "removed"}`, {
        price: ADD_ONS[slug].amountCents / 100,
        location: "checkout",
      });
      return next;
    });
  };

  // Accurate purchase_completed even after the Stripe redirect (state is lost on
  // redirect, so read the plan/flags the success_url carries back).
  const successTracked = useRef(false);
  useEffect(() => {
    // Only a real Stripe return (?success=1) is a completed purchase — the demo
    // `setPaid` path shows the success UI but no money changed hands, so it must
    // NOT emit purchase_completed (would pollute revenue/conversion analytics).
    if (searchParams.get("success") !== "1" || successTracked.current) return;
    successTracked.current = true;
    const sp = searchParams;
    const slug = getPlan(sp.get("plan") ?? "")?.slug ?? sel;
    const rev = sp.get("rev");
    track("purchase_completed", {
      plan_slug: slug,
      revenue: rev ? Number(rev) / 100 : totalCents / 100,
      credits: PLANS[slug].credits,
      expert_feedback_added: sp.get("ef") === "1" || addOns.has("expert_feedback"),
      human_revision_added: sp.get("hr") === "1" || addOns.has("human_revision"),
    });
  }, [showSuccess, searchParams, sel, totalCents, addOns]);

  const pay = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    track("checkout_started", {
      plan_slug: plan.slug,
      plan_price: plan.amountCents / 100,
      credits: plan.credits,
      selected_add_ons: selectedAddOns.map((a) => a.slug).join(",") || "none",
    });
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          planSlug: plan.slug,
          addOns: selectedAddOns.map((a) => a.slug),
        }),
      });
      if (res.status === 401) {
        router.push(ROUTES.signIn);
        return;
      }
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url; // → Stripe Checkout
        return;
      }
      setPaid(true); // demo mode → local success animation
    } catch {
      setError("Couldn’t start checkout. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="tm-sec">
      <div className="tm-wrap tmCR-layout">
        <div>
          <div className="tmCR-packs">
            {PLAN_LIST.map((p) => (
              <div
                key={p.slug}
                className={"tm-card tmCR-pack" + (sel === p.slug ? " is-sel" : "")}
                onClick={() => selectPlan(p.slug)}
              >
                <span className="tmCR-radio"></span>
                <span>
                  <span className="tmCR-pack-name">
                    {p.name}{" "}
                    {p.slug === "job_hunt" && (
                      <span className="tm-pill ml-[8px]">Most popular</span>
                    )}
                  </span>
                  <span className="tmCR-pack-meta block">
                    {p.credits} applications · {p.per}/app
                  </span>
                </span>
                <span className="tmCR-pack-price">{money(p.amountCents)}</span>
              </div>
            ))}
          </div>

          <div className="mt-[22px]">
            <b className="block" style={{ fontSize: "14px", fontWeight: 500, marginBottom: "10px" }}>
              Add human review (optional)
            </b>
            {ADDON_LIST.map((a) => {
              const on = addOns.has(a.slug);
              return (
                <label
                  key={a.slug}
                  className={"tm-card tmCR-pack" + (on ? " is-sel" : "")}
                  style={{ cursor: "pointer", marginBottom: "10px" }}
                >
                  <input
                    type="checkbox"
                    checked={on}
                    onChange={() => toggleAddOn(a.slug)}
                    style={{ width: "16px", height: "16px", accentColor: "var(--tm-mint-600)" }}
                  />
                  <span>
                    <span className="tmCR-pack-name">{a.name}</span>
                    <span className="tmCR-pack-meta block">
                      {a.slug === "expert_feedback"
                        ? "One human review pass · prioritized feedback within 48h"
                        : "One hands-on human revision pass for one application"}
                    </span>
                  </span>
                  <span className="tmCR-pack-price">+{money(a.amountCents)}</span>
                </label>
              );
            })}
            <p className="tm-small" style={{ fontSize: "12px" }}>
              Add-ons are human services for one application. They don’t add
              application credits. Coaching and white-glove service are available
              from $225. <Link href={ROUTES.contact} className="underline">Get in touch</Link>.
            </p>
          </div>
        </div>

        {showSuccess ? (
          <div className="tm-card tmCR-sum tmF-gate items-center">
            <span className="tm-pill tm-pill--mint">
              <Check size={12} /> payment complete
            </span>
            <h3>{plan.credits} credits added</h3>
            <p>Your balance is now {plan.credits + 1} applications.</p>
            <Link className="tm-btn tm-btn--primary" href={ROUTES.dashboard}>
              Go to dashboard
            </Link>
            <span
              className="tm-small cursor-pointer underline"
              style={{ fontSize: "12px" }}
              onClick={() => {
                setPaid(false);
                router.replace(ROUTES.buyCredits);
              }}
            >
              reset demo
            </span>
          </div>
        ) : (
          <div className="tm-card tmCR-sum">
            <h3>Order summary</h3>
            <div className="tmCR-row">
              <span>
                {plan.name} · {plan.credits} applications
              </span>
              <b>{money(plan.amountCents)}</b>
            </div>
            {selectedAddOns.map((a) => (
              <div className="tmCR-row" key={a.slug}>
                <span>{a.name}</span>
                <b>+{money(a.amountCents)}</b>
              </div>
            ))}
            <div className="tmCR-row">
              <span>Credits expire</span>
              <b>Never</b>
            </div>
            <div className="tmCR-row tmCR-row--total">
              <span>Total</span>
              <b>{money(totalCents)}</b>
            </div>
            <div className="tmCR-payfield">
              <Lock size={15} /> Card number · MM/YY · CVC
            </div>
            {error && (
              <p
                className="tm-small"
                style={{ color: "#b3261e", marginTop: "10px" }}
              >
                {error}
              </p>
            )}
            <button
              type="button"
              className="tm-btn tm-btn--primary mt-[14px] w-full justify-center"
              disabled={busy}
              onClick={() => void pay()}
            >
              {busy ? "Starting checkout…" : `Pay ${money(totalCents)}`}
            </button>
            <p className="tmCR-paynote">
              <ShieldCheck size={13} /> Secured by Stripe · unused credits
              refundable for 30 days
            </p>
          </div>
        )}
      </div>
    </section>
  );
}
