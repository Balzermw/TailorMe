"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { track } from "@/lib/track";

const PRICING_FAQS = [
  {
    id: "credits_expire",
    q: "Do credits expire?",
    a: "Never. Buy a pack, use it across your whole search - this month or next year. No subscription to cancel, no API keys to manage.",
  },
  {
    id: "one_application",
    q: "What counts as one application?",
    a: "One job posting: fit score, tailored resume + cover letter, the full three-agent review, and the compiled PDFs. Re-runs against the same posting do not cost extra credits.",
  },
  {
    id: "preview",
    q: "Can I see the result before spending a credit?",
    a: "Yes. Every run shows a watermarked preview free. The credit unlocks the clean download.",
  },
  {
    id: "refund_policy",
    q: "What is the refund policy?",
    a: "If you are not happy, email balzermw@gmail.com within 30 days of purchase and we will refund any unused credits in full. Credits already spent on a tailored application are not refundable.",
  },
  {
    id: "human_review",
    q: "Can a human review my resume?",
    a: "Yes. Add expert feedback at checkout for a 48-hour human review pass on one application. For hands-on rewriting, revision, cover letters, or coaching, work with Michael through the coaching page.",
  },
];

export default function PricingFaq() {
  const [openIndex, setOpenIndex] = useState(0);

  return (
    <div className="tm-faq">
      {PRICING_FAQS.map((f, i) => {
        const isOpen = openIndex === i;
        const panelId = `pricing-faq-${i}`;

        return (
          <div
            key={f.q}
            className={`tm-faq-item tm-faq-item--smooth${isOpen ? " is-open" : ""}`}
          >
            <button
              type="button"
              className="tm-faq-button"
              aria-expanded={isOpen}
              aria-controls={panelId}
              onClick={() => {
                if (!isOpen) track("faq_opened", { question_id: f.id });
                setOpenIndex(isOpen ? -1 : i);
              }}
            >
              <span>{f.q}</span>
              <Plus className="tm-faq-icon" size={16} />
            </button>
            <div
              id={panelId}
              className="tm-faq-panel"
              data-open={isOpen ? "true" : "false"}
            >
              <div>
                <p>{f.a}</p>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
