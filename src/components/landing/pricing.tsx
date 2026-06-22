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
    <div
      className="tm-card tm-human"
      style={{
        background: "#fff",
        borderColor: "var(--tm-mint-200)",
        marginTop: "var(--g)",
        position: "relative",
        overflow: "hidden",
        boxShadow: "0 14px 34px rgba(16, 24, 40, 0.08)",
      }}
    >
      <Image
        className="tm-human-photo"
        src="/michael.png"
        alt="Michael, head of Res.Me"
        width={56}
        height={56}
        style={{ width: "60px", height: "60px" }}
      />
      <div className="tm-human-body">
        <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
          <h3 style={{ margin: 0 }}>Add Expert Feedback</h3>
          <span className="tm-pill tm-pill--mint" style={{ fontSize: "11px" }}>
            Most loved add-on
          </span>
        </div>
        <p style={{ marginBottom: "8px" }}>
          A resume expert reviews one selected application and returns
          prioritized, human feedback within 48 hours: risks, weak spots, and
          what to improve. A review pass, not a full rewrite. Want hands-on
          changes? Human Revision is available for +$149.
        </p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
          <span className="tm-pill">CPRW certified</span>
          <span className="tm-pill">650+ resumes written</span>
          <span className="tm-pill">Fiverr Top Pro · 4.8★</span>
        </div>
      </div>
      <div className="tm-human-price">
        <strong style={{ color: "var(--tm-mint-700)" }}>+$79</strong>
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
          No subscription. Buy application credits once, use them across roles,
          and add human review when it matters.
        </p>
        <div className="mt-[26px]">
          <PricingTable />
        </div>
        <HumanReviewRow />
        <p className="tm-small mt-[28px] text-center">
          Every new account starts with{" "}
          <span className="tm-m">1 free application</span>: that’s your free
          resume audit. No card required.
        </p>
      </div>
    </section>
  );
}
