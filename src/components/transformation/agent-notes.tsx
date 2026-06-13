import { Search, Target, TrendingUp } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { AGENTS_FULL } from "@/components/landing/data";

const AGENT_ICONS: Record<string, LucideIcon> = {
  search: Search,
  "trending-up": TrendingUp,
  target: Target,
};

export default function AgentNotes() {
  return (
    <section className="tm-sec tm-tint--blue">
      <div className="tm-wrap">
        <h2 className="tm-h2">Everything the three agents flagged</h2>
        <p className="tm-body mt-[10px] max-w-[64ch]">
          The full review for this run — every note a concrete, line-level
          change.
        </p>
        <div className="tm-agents mt-[28px]">
          {AGENTS_FULL.map((a) => {
            const Icon = AGENT_ICONS[a.icon] ?? Search;
            return (
              <div key={a.name} className="tm-card tm-agent">
                <span className="tm-agent-ic">
                  <Icon size={20} />
                </span>
                <h3>{a.name} agent</h3>
                {a.notes.map((n) => (
                  <p key={n.txt} className="tm-agent-note">
                    <span className={`tm-tag tm-tag--${n.t}`}>{n.t}</span>
                    {n.txt}
                  </p>
                ))}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
