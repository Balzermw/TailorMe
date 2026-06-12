import { Plus } from "lucide-react";
import { FAQS } from "./data";

export default function Faq() {
  return (
    <section className="tm-sec tm-tint--gray">
      <div className="tm-wrap">
        <h2 className="tm-h2">Objections, answered</h2>
        <div className="tm-faq tm-faq--cols mt-[22px]">
          {FAQS.map((f) => (
            <details key={f.q} className="tm-faq-item">
              <summary>
                {f.q} <Plus size={16} />
              </summary>
              <p>{f.a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
