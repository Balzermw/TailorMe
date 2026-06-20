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
        txt: "Distributed systems, Node.js, Kubernetes, observability, CI/CD, and mentorship.",
      },
      {
        label: "Grounded in experience",
        txt: "Tied Kubernetes and Datadog work to real bullets, not a skills-only line.",
      },
    ],
    before: "Comfortable with containers, cloud, and monitoring tools.",
    after: "Set Kubernetes deployment standards and built Datadog observability dashboards.",
  },
  {
    icon: "trending-up",
    name: "Impact & metrics",
    notes: [
      {
        label: "Numbers added",
        txt: "38% lower p95 latency, 2.4M daily transactions, 6 engineers mentored.",
      },
      {
        label: "Scope clarified",
        txt: "Surfaced 40k messages/min and a 52% incident-triage drop.",
      },
    ],
    before: "Improved checkout performance and mentored the team.",
    after: "Cut p95 latency 38% across 2.4M daily transactions; mentored 6 engineers.",
  },
  {
    icon: "target",
    name: "Role-fit",
    notes: [
      {
        label: "Headline aligned",
        txt: "Reframed the title to Senior Platform Engineer for this role.",
      },
      {
        label: "Reordered for fit",
        txt: "Moved platform and reliability work above generic support; trimmed old web bullets.",
      },
    ],
    before: "Responsible for web app features across React and Node.js.",
    after: "Led migration of checkout to a distributed Node.js service for the platform.",
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
                {a.before && a.after && (
                  <div className="tm-agent-eg">
                    <span className="tm-agent-eg-tag">Example from this run</span>
                    <p className="tm-agent-eg-before">{a.before}</p>
                    <p className="tm-agent-eg-after">{a.after}</p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
