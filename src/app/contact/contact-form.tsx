"use client";

import { useState } from "react";
import Link from "next/link";
import { Check } from "lucide-react";
import { ROUTES } from "@/components/landing/data";

const TOPICS = [
  "An application",
  "Credits or billing",
  "My data (export / deletion)",
  "Coaching with Michael",
  "Something else",
];

export default function ContactForm() {
  const [sent, setSent] = useState(false);

  if (sent) {
    return (
      <div className="tm-card tmF-gate px-[32px] py-[40px]">
        <span className="tm-pill tm-pill--mint">
          <Check size={12} /> sent
        </span>
        <h3>Thanks, we’ve got it</h3>
        <p>
          You’ll hear back within one business day. For urgent data requests,
          mention “GDPR” in your subject line.
        </p>
        <Link className="tm-btn tm-btn--outline" href={ROUTES.home}>
          Back to home
        </Link>
      </div>
    );
  }

  return (
    <form
      className="tm-card p-[30px]"
      onSubmit={(e) => {
        e.preventDefault();
        setSent(true);
      }}
    >
      <div className="tmS-field">
        <label htmlFor="contact-name">Name</label>
        <input
          id="contact-name"
          className="tmS-input"
          type="text"
          placeholder="Your name"
        />
      </div>
      <div className="tmS-field">
        <label htmlFor="contact-email">Email</label>
        <input
          id="contact-email"
          className="tmS-input"
          type="email"
          placeholder="you@email.com"
        />
      </div>
      <div className="tmS-field">
        <label htmlFor="contact-topic">What’s this about?</label>
        <select
          id="contact-topic"
          className="tmS-input"
          defaultValue="An application"
        >
          {TOPICS.map((t) => (
            <option key={t}>{t}</option>
          ))}
        </select>
      </div>
      <div className="tmS-field">
        <label htmlFor="contact-message">Message</label>
        <textarea
          id="contact-message"
          className="tmF-ta"
          placeholder="How can we help?"
        ></textarea>
      </div>
      <button
        type="submit"
        className="tm-btn tm-btn--primary mt-[6px] w-full justify-center"
      >
        Send message
      </button>
    </form>
  );
}
