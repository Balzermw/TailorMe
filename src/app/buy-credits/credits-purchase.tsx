"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Check, Lock, ShieldCheck } from "lucide-react";
import { PRICING, ROUTES } from "@/components/landing/data";

const PACKS = PRICING.map((p) => ({
  ...p,
  priceNum: Number(p.price.replace("$", "")),
  appsNum: Number.parseInt(p.apps, 10),
}));

export default function CreditsPurchase() {
  const [sel, setSel] = useState("Job hunt");
  const [addon, setAddon] = useState(false);
  const [paid, setPaid] = useState(false);
  const pack = PACKS.find((p) => p.name === sel) ?? PACKS[0];
  const total = pack.priceNum + (addon ? 49 : 0);

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

          <div
            className={
              "tm-card tmCR-addon mt-[22px]" + (addon ? " is-sel" : "")
            }
            onClick={() => setAddon(!addon)}
          >
            <span className="tmCR-check">{addon && <Check size={13} />}</span>
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
                Add Michael’s expert review to my next application
              </b>
              <span className="tm-small" style={{ fontSize: "12.5px" }}>
                Line-by-line pass from the head of Res.Me · 48-hour turnaround
              </span>
            </div>
            <span className="tmCR-pack-price" style={{ fontSize: "17px" }}>
              +$49
            </span>
          </div>
        </div>

        {paid ? (
          <div className="tm-card tmCR-sum tmF-gate items-center">
            <span className="tm-pill tm-pill--mint">
              <Check size={12} /> payment complete
            </span>
            <h3>{pack.appsNum} credits added</h3>
            <p>
              Your balance is now {pack.appsNum + 1} applications
              {addon ? ", with Michael’s review queued for the next one" : ""}.
            </p>
            <Link className="tm-btn tm-btn--primary" href={ROUTES.dashboard}>
              Go to dashboard
            </Link>
            <span
              className="tm-small cursor-pointer underline"
              style={{ fontSize: "12px" }}
              onClick={() => setPaid(false)}
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
            {addon && (
              <div className="tmCR-row">
                <span>Michael’s expert review × 1</span>
                <b>$49</b>
              </div>
            )}
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
            <button
              type="button"
              className="tm-btn tm-btn--primary mt-[14px] w-full justify-center"
              onClick={() => setPaid(true)}
            >
              Pay ${total}
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
