"use client";

// Booking flow for /book-session — ported from the design handoff
// (tm-page-booking.jsx): package picker, free intro slot grid, summary,
// and booked confirmation state. Times are placeholders.

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Check } from "lucide-react";
import { ROUTES } from "@/components/landing/data";

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

const DAYS: { d: string; slots: string[] }[] = [
  { d: "Mon Jun 15", slots: ["10:00", "14:00"] },
  { d: "Tue Jun 16", slots: ["09:00", "11:30", "16:00"] },
  { d: "Wed Jun 17", slots: ["13:00"] },
  { d: "Thu Jun 18", slots: ["10:30", "15:00"] },
];

export default function Booking() {
  const [pkg, setPkg] = useState("cover");
  const [slot, setSlot] = useState<string | null>(null);
  const [booked, setBooked] = useState(false);
  const sel = PKGS.find((p) => p.id === pkg) ?? PKGS[0];

  return (
    <section className="tm-sec">
      <div
        className="tm-wrap tmCR-layout"
        style={{ maxWidth: "1000px", margin: "0 auto" }}
      >
        {!booked ? (
          <>
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
                2 · Pick an intro slot (30 min, free)
              </p>
              <div className="tmBK-days">
                {DAYS.map((day) => (
                  <div key={day.d} className="tmBK-day">
                    <span className="tmBK-day-label">{day.d}</span>
                    <div className="tmBK-slots">
                      {day.slots.map((s) => {
                        const key = day.d + " " + s;
                        return (
                          <button
                            key={key}
                            type="button"
                            className={
                              "tmD-chip" + (slot === key ? " is-on" : "")
                            }
                            aria-pressed={slot === key}
                            onClick={() => setSlot(key)}
                          >
                            {s}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
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
                <b>{slot || "pick a slot"}</b>
              </div>
              <div className="tmCR-row tmCR-row--total">
                <span>Due today</span>
                <b>$0</b>
              </div>
              <p
                className="tm-small"
                style={{ fontSize: "12px", marginTop: "4px" }}
              >
                You only pay ({sel.price}) after the intro call, if you go
                ahead.
              </p>
              <button
                type="button"
                className="tm-btn tm-btn--primary w-full justify-center mt-[14px]"
                style={{
                  opacity: slot ? 1 : 0.45,
                  pointerEvents: slot ? "auto" : "none",
                }}
                disabled={!slot}
                onClick={() => setBooked(true)}
              >
                Book intro call
              </button>
            </div>
          </>
        ) : (
          <div
            className="tm-card tmF-gate"
            style={{
              padding: "40px 32px",
              gridColumn: "1 / -1",
              maxWidth: "520px",
              margin: "0 auto",
            }}
          >
            <span className="tm-pill tm-pill--mint">
              <Check size={12} /> booked
            </span>
            <h3>You’re on Michael’s calendar</h3>
            <p>
              {slot} · 30-minute intro call for {sel.name}. A confirmation
              email with the meeting link is on its way.
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
