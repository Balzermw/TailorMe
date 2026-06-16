"use client";

// Booking flow for /book-session: pick a package, then launch Michael's Calendly
// in a popup to choose a time. We DON'T embed the calendar inline (it crowds the
// page); a single "Pick a time" button opens Calendly's own scheduling view and
// carries the chosen package along as a UTM so Michael knows what they picked.
// Calendly owns availability, timezones, calendar sync, and the confirmation +
// reminder emails. The paid package is collected after the call via Stripe.
//
// Set NEXT_PUBLIC_CALENDLY_URL to Michael's event link to go live; until then the
// button area shows a clear "not connected" notice.

import { useEffect, useState } from "react";
import Script from "next/script";
import Image from "next/image";
import Link from "next/link";
import { CalendarClock, Check } from "lucide-react";
import { ROUTES } from "@/components/landing/data";

declare global {
  interface Window {
    Calendly?: {
      initPopupWidget: (opts: { url: string }) => void;
    };
  }
}

type Pkg = {
  id: string;
  name: string;
  price: string;
  meta: string;
  popular?: boolean;
};

const PKGS: Pkg[] = [
  {
    id: "rewrite",
    name: "Resume rewrite",
    price: "$149",
    meta: "Full rewrite · 2 revision rounds · 5-day turnaround",
  },
  {
    id: "cover",
    name: "Rewrite + cover letter",
    price: "$199",
    meta: "Adds cover letter + LinkedIn pass",
    popular: true,
  },
  {
    id: "full",
    name: "Full coaching",
    price: "$299",
    meta: "Adds two 45-min sessions + 30 days of follow-up",
  },
];

const CALENDLY_URL = process.env.NEXT_PUBLIC_CALENDLY_URL || "";

// Calendly records URL UTM params on the scheduled event, so the chosen package
// shows up in Michael's notification + invitee details.
function calendlyLink(pkgId: string): string {
  return (
    `${CALENDLY_URL}?hide_gdpr_banner=1` +
    `&utm_campaign=book-session&utm_content=${encodeURIComponent(pkgId)}`
  );
}

export default function Booking() {
  const [pkg, setPkg] = useState("cover");
  const [booked, setBooked] = useState(false);
  const sel = PKGS.find((p) => p.id === pkg) ?? PKGS[0];

  // Calendly's popup needs its stylesheet; load it once.
  useEffect(() => {
    const href = "https://assets.calendly.com/assets/external/widget.css";
    if (!document.querySelector(`link[href="${href}"]`)) {
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = href;
      document.head.appendChild(link);
    }
  }, []);

  // "event_scheduled" (from inside the Calendly popup) — not a local click — is
  // what flips us to the confirmed state, so it only shows once Calendly has
  // really booked + emailed.
  useEffect(() => {
    const onMsg = (e: MessageEvent) => {
      if (typeof e.origin !== "string" || !e.origin.includes("calendly.com"))
        return;
      const data = e.data as { event?: string };
      if (data?.event === "calendly.event_scheduled") setBooked(true);
    };
    window.addEventListener("message", onMsg);
    return () => window.removeEventListener("message", onMsg);
  }, []);

  const openCalendly = () => {
    if (!CALENDLY_URL) return;
    const url = calendlyLink(sel.id);
    if (window.Calendly?.initPopupWidget) {
      window.Calendly.initPopupWidget({ url });
    } else {
      // Script not ready → fall back to Calendly's own page in a new tab.
      window.open(url, "_blank", "noopener,noreferrer");
    }
  };

  return (
    <section className="tm-sec">
      {CALENDLY_URL && (
        <Script
          src="https://assets.calendly.com/assets/external/widget.js"
          strategy="afterInteractive"
        />
      )}
      <div className="tm-wrap" style={{ maxWidth: "1000px", margin: "0 auto" }}>
        {!booked ? (
          <div className="tmCR-layout">
            <div>
              <p className="tmF-p2-label" style={{ marginBottom: "10px" }}>
                1 · Choose a package
              </p>
              <div className="tmCR-packs">
                {PKGS.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    className={
                      "tm-card tmCR-pack text-left" +
                      (pkg === p.id ? " is-sel" : "")
                    }
                    aria-pressed={pkg === p.id}
                    onClick={() => setPkg(p.id)}
                  >
                    <span className="tmCR-radio"></span>
                    <span>
                      <span className="tmCR-pack-name">
                        {p.name}{" "}
                        {p.popular && (
                          <span className="tm-pill ml-[8px]">Most popular</span>
                        )}
                      </span>
                      <span className="tmCR-pack-meta block">{p.meta}</span>
                    </span>
                    <span className="tmCR-pack-price">{p.price}</span>
                  </button>
                ))}
              </div>

              <p className="tmF-p2-label" style={{ margin: "26px 0 10px" }}>
                2 · Book your intro call
              </p>
              {CALENDLY_URL ? (
                <div>
                  <button
                    type="button"
                    className="tm-btn tm-btn--primary tm-btn--lg"
                    onClick={openCalendly}
                  >
                    <CalendarClock size={17} /> Pick a time with Michael
                  </button>
                  <p
                    className="tm-small"
                    style={{ marginTop: "10px", fontSize: "12px", lineHeight: 1.6 }}
                  >
                    Opens Michael’s calendar to pick a slot that works for you — a
                    free 30-minute intro. You’ll get a confirmation and the meeting
                    link by email.
                  </p>
                </div>
              ) : (
                <div className="tm-card" style={{ padding: "20px 22px" }}>
                  <p className="tm-small" style={{ lineHeight: 1.6 }}>
                    Live scheduling isn’t connected yet. Set{" "}
                    <code
                      style={{
                        fontFamily: "ui-monospace, monospace",
                        fontSize: "12px",
                      }}
                    >
                      NEXT_PUBLIC_CALENDLY_URL
                    </code>{" "}
                    to Michael’s Calendly event link and this button will open his
                    calendar — with automatic confirmation + reminder emails.
                  </p>
                </div>
              )}
            </div>

            <div className="tm-card tmCR-sum">
              <div className="flex items-center gap-[12px] mb-[16px]">
                <Image
                  className="tm-human-photo"
                  src="/michael.png"
                  alt="Michael"
                  width={44}
                  height={44}
                  style={{ width: "44px", height: "44px" }}
                />
                <div>
                  <b className="text-[14.5px] font-medium block">Michael</b>
                  <span className="tm-small" style={{ fontSize: "12px" }}>
                    Head of Res.Me · CPRW
                  </span>
                </div>
              </div>
              <div className="tmCR-row">
                <span>Package</span>
                <b>{sel.name}</b>
              </div>
              <div className="tmCR-row">
                <span>Intro call</span>
                <b>30 min · free</b>
              </div>
              <div className="tmCR-row tmCR-row--total">
                <span>Due today</span>
                <b>$0</b>
              </div>
              <p
                className="tm-small"
                style={{ fontSize: "12px", marginTop: "4px" }}
              >
                You only pay ({sel.price}) after the intro call, if you go ahead.
              </p>
            </div>
          </div>
        ) : (
          <div
            className="tm-card tmF-gate"
            style={{ padding: "40px 32px", maxWidth: "520px", margin: "0 auto" }}
          >
            <span className="tm-pill tm-pill--mint">
              <Check size={12} /> booked
            </span>
            <h3>You’re on Michael’s calendar</h3>
            <p>
              Your 30-minute intro call about the {sel.name} package is confirmed.
              Calendly just emailed you the details and the meeting link.
            </p>
            <Link className="tm-btn tm-btn--outline" href={ROUTES.coaching}>
              Back to coaching
            </Link>
          </div>
        )}
      </div>
    </section>
  );
}
