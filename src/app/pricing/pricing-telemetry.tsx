"use client";

import { useEffect } from "react";
import Link from "next/link";
import { track } from "@/lib/track";
import { ROUTES } from "@/components/landing/data";

// Client telemetry helpers for the (server-rendered) pricing page. Only
// low-risk product metadata — no PII. Referrer is reduced to its hostname.

function device(): string {
  if (typeof navigator === "undefined") return "unknown";
  return /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent) ? "mobile" : "desktop";
}

/** Fires pricing_viewed (+ upsell viewed) once on mount. */
export function PricingView() {
  useEffect(() => {
    const sp = new URLSearchParams(window.location.search);
    let referrer = "";
    try {
      referrer = document.referrer ? new URL(document.referrer).hostname : "";
    } catch {
      /* ignore */
    }
    track("pricing_viewed", {
      source: sp.get("utm_source") || sp.get("source") || "direct",
      campaign: sp.get("utm_campaign") || sp.get("campaign") || "",
      device: device(),
      referrer,
    });
    track("expert_review_viewed", { location: "pricing" });
    track("human_revision_viewed", { location: "pricing" });
  }, []);
  return null;
}

/** A plan CTA that records the click, then deep-links to checkout with the plan. */
export function PlanCta({
  slug,
  price,
  credits,
  perApp,
  className,
  children,
}: {
  slug: string;
  price: number;
  credits: number;
  perApp: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      className={className}
      href={`${ROUTES.buyCredits}?plan=${slug}`}
      onClick={() =>
        track("plan_card_clicked", {
          plan_slug: slug,
          plan_price: price,
          credits,
          per_application_price: perApp,
        })
      }
    >
      {children}
    </Link>
  );
}

/** Refund-policy line — records the click for funnel/trust analysis. */
export function RefundLink({ children }: { children: React.ReactNode }) {
  return (
    <button
      type="button"
      className="tmP-refund"
      style={{
        background: "none",
        border: 0,
        font: "inherit",
        cursor: "pointer",
        width: "100%",
      }}
      onClick={() => track("refund_policy_clicked", { location: "pricing" })}
    >
      {children}
    </button>
  );
}
