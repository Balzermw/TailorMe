"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { FAQS } from "./data";

export default function Faq() {
  const [openItems, setOpenItems] = useState<string[]>([]);

  function toggleItem(question: string) {
    setOpenItems((current) =>
      current.includes(question)
        ? current.filter((item) => item !== question)
        : [...current, question],
    );
  }

  return (
    <section className="tm-sec tm-tint--gray">
      <div className="tm-wrap">
        <h2 className="tm-h2">Objections, answered</h2>
        <div className="tm-faq tm-faq--cols mt-[22px]">
          {FAQS.map((f, i) => {
            const isOpen = openItems.includes(f.q);
            const panelId = `home-faq-${i}`;

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
                  onClick={() => toggleItem(f.q)}
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
      </div>
    </section>
  );
}
