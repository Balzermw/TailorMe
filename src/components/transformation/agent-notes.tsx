import { Search, Target, TrendingUp } from "lucide-react";
import type { LucideIcon } from "lucide-react";

const AGENT_ICONS: Record<string, LucideIcon> = {
  search: Search,
  "trending-up": TrendingUp,
  target: Target,
};

const TRANSFORMATION_AGENT_NOTES = [
  {
    icon: "search",
    name: "ATS & keywords",
    notes: [
      {
        label: "Keywords added",
        txt: "Distributed systems, Node.js at scale, Kubernetes, observability, CI/CD pipelines, and mentorship.",
      },
      {
        label: "Keywords grounded",
        txt: "Moved Kubernetes out of the skills-only line and tied it to deployment standards in the Brightline experience.",
      },
      {
        label: "Evidence surfaced",
        txt: "Added Datadog observability dashboard work so the Nordpeak scan sees the exact monitoring language from the posting.",
      },
    ],
  },
  {
    icon: "trending-up",
    name: "Impact & metrics",
    notes: [
      {
        label: "Numbers added",
        txt: "38% lower p95 latency, 2.4M daily transactions, and 6 engineers mentored.",
      },
      {
        label: "Scale clarified",
        txt: "Added 40k messages/min to the order-events pipeline so backend scope is visible.",
      },
      {
        label: "Outcome improved",
        txt: "Converted a vague dashboard bullet into a 52% incident-triage reduction.",
      },
    ],
  },
  {
    icon: "target",
    name: "Role-fit",
    notes: [
      {
        label: "Headline aligned",
        txt: "Reframed Software Engineer as Senior Platform Engineer for the client-chosen Nordpeak role.",
      },
      {
        label: "Work reordered",
        txt: "Moved distributed Node.js service, checkout reliability, CI/CD guardrails, and rollback playbooks above generic support work.",
      },
      {
        label: "Old work trimmed",
        txt: "Compressed early web and process-heavy bullets so the page sells backend/platform fit first.",
      },
    ],
  },
];

export default function AgentNotes() {
  return (
    <section className="tm-sec tm-tint--blue">
      <div className="tm-wrap">
        <h2 className="tm-h2">Everything the three agents flagged</h2>
        <p className="tm-body mt-[10px] max-w-[64ch]">
          The full review for this run, showing exactly what changed and why.
        </p>
        <div className="tm-agents mt-[28px]">
          {TRANSFORMATION_AGENT_NOTES.map((a) => {
            const Icon = AGENT_ICONS[a.icon] ?? Search;
            return (
              <div key={a.name} className="tm-card tm-agent">
                <span className="tm-agent-ic">
                  <Icon size={20} />
                </span>
                <h3>{a.name} agent</h3>
                {a.notes.map((n) => (
                  <p key={n.txt} className="tm-agent-note">
                    <span className="tm-agent-note-label">{n.label}</span>
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
