import Image from "next/image";
import Link from "next/link";
import { PRICING, ROUTES } from "./data";

function PricingTable() {
  return (
    <div className="tm-price-table">
      {PRICING.map((p) => (
        <div
          key={p.name}
          className={"tm-price-trow" + (p.popular ? " is-em" : "")}
        >
          <span className="tm-price-tname">
            {p.name}{" "}
            {p.popular && <span className="tm-pill">Most popular</span>}
          </span>
          <span className="tm-price-tcell">{p.apps}</span>
          <span className="tm-price-tcell">{p.per}</span>
          <span className="tm-price-tprice">{p.price}</span>
          <Link
            className={
              "tm-btn tm-btn--sm justify-self-end " +
              (p.popular ? "tm-btn--primary" : "tm-btn--outline")
            }
            href={ROUTES.buyCredits}
          >
            Buy credits
          </Link>
        </div>
      ))}
    </div>
  );
}

function HumanReviewRow() {
  return (
    <div className="tm-card tm-human">
      <Image
        className="tm-human-photo"
        src="/michael.png"
        alt="Michael, head of Res.Me"
        width={56}
        height={56}
      />
      <div className="tm-human-body">
        <h3>Add Michael’s expert review</h3>
        <p>
          Michael — head of Res.Me, Certified Professional Resume Writer, 650+
          resumes written — goes through your final draft line by line and adds
          positioning notes for your target role. Back in your inbox within 48
          hours.
        </p>
      </div>
      <div className="tm-human-price">
        <strong>+$49</strong>
        <span>per application</span>
      </div>
    </div>
  );
}

export default function Pricing() {
  return (
    <section className="tm-sec">
      <div className="tm-wrap">
        <h2 className="tm-h2">Pricing</h2>
        <p className="tm-body mt-[10px]">
          Pay per application. No subscription, no API keys, credits never
          expire.
        </p>
        <div className="mt-[26px]">
          <PricingTable />
        </div>
        <HumanReviewRow />
        <p className="tm-small mt-[28px] text-center">
          Every new account starts with{" "}
          <span className="tm-m">1 free application</span> — that’s your free
          resume audit. No card required.
        </p>
      </div>
    </section>
  );
}
