"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Check, Lock, ShieldCheck } from "lucide-react";
import { PRICING, ROUTES } from "@/components/landing/data";
import { packIdByName } from "@/lib/packs";

const PACKS = PRICING.map((p) => ({
  ...p,
  priceNum: Number(p.price.replace("$", "")),
  appsNum: Number.parseInt(p.apps, 10),
}));

export default function CreditsPurchase() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [sel, setSel] = useState("Job hunt");
  const [paid, setPaid] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pack = PACKS.find((p) => p.name === sel) ?? PACKS[0];
  const total = pack.priceNum;

  // Returning from Stripe Checkout (?success=1) or the demo "Pay" both show success.
  const showSuccess = paid || searchParams.get("success") === "1";

  const pay = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ packId: packIdByName(pack.name) }),
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
      // demo mode → run the local success animation
      setPaid(true);
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
            {PACKS.map((p) => (
              <div
                key={p.name}
                className={
                  "tm-card tmCR-pack" + (sel === p.name ? " is-sel" : "")
                }
                onClick={() => setSel(p.name)}
              >
                <span className="tmCR-radio"></span>
                <span>
                  <span className="tmCR-pack-name">
                    {p.name}{" "}
                    {p.popular && (
                      <span className="tm-pill ml-[8px]">Most popular</span>
                    )}
                  </span>
                  <span className="tmCR-pack-meta block">
                    {p.apps} · {p.per}
                  </span>
                </span>
                <span className="tmCR-pack-price">{p.price}</span>
              </div>
            ))}
          </div>

          <div className="tm-card tmCR-addon mt-[22px]">
            <Image
              className="tm-human-photo"
              src="/michael.png"
              alt=""
              width={44}
              height={44}
              style={{ width: "44px", height: "44px" }}
            />
            <div className="flex-1">
              <b
                className="block"
                style={{ fontSize: "14.5px", fontWeight: 500 }}
              >
                Want Michael’s expert review?
              </b>
              <span className="tm-small" style={{ fontSize: "12.5px" }}>
                Add his line-by-line pass (+$49) to any finished application from
                your{" "}
                <Link href={ROUTES.dashboard} className="underline">
                  dashboard
                </Link>
                .
              </span>
            </div>
          </div>
        </div>

        {showSuccess ? (
          <div className="tm-card tmCR-sum tmF-gate items-center">
            <span className="tm-pill tm-pill--mint">
              <Check size={12} /> payment complete
            </span>
            <h3>{pack.appsNum} credits added</h3>
            <p>Your balance is now {pack.appsNum + 1} applications.</p>
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
                {pack.name} — {pack.apps}
              </span>
              <b>{pack.price}</b>
            </div>
            <div className="tmCR-row">
              <span>Credits expire</span>
              <b>Never</b>
            </div>
            <div className="tmCR-row tmCR-row--total">
              <span>Total</span>
              <b>${total}</b>
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
              {busy ? "Starting checkout…" : `Pay $${total}`}
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
