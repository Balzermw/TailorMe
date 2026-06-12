import { ClipboardList, Download, Upload } from "lucide-react";
import { PLAN } from "./data";

const ICONS = {
  upload: Upload,
  "clipboard-list": ClipboardList,
  download: Download,
} as const;

export default function HowItWorks() {
  return (
    <section className="tm-sec tm-tint--blue">
      <div className="tm-wrap">
        <h2 className="tm-h2 text-center">How it works</h2>
        <div className="tm-plan mt-[28px]">
          {PLAN.map((step, i) => {
            const Icon = ICONS[step.icon];
            return (
              <div key={step.t} className="tm-plan-step tm-card">
                <span className="tm-plan-ic">
                  <Icon size={19} />
                </span>
                <h3>
                  {i + 1}. {step.t}
                </h3>
                <p>{step.d}</p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
