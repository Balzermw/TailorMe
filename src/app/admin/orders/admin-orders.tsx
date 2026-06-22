"use client";

import { useState } from "react";
import { Check, Clock, RotateCcw } from "lucide-react";

export interface OrderRow {
  id: number;
  created_at: string;
  plan_slug: string;
  credits: number;
  amount_cents: number;
  total_cents: number;
  expert_feedback: boolean;
  human_revision: boolean;
  fulfillment_status: string; // none | pending | done
}

const usd = (c: number) => `$${(c / 100).toFixed(2)}`;
const date = (s: string) => {
  try {
    return new Date(s).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return s.slice(0, 10);
  }
};

export default function AdminOrders({ initialOrders }: { initialOrders: OrderRow[] }) {
  const [orders, setOrders] = useState(initialOrders);
  const [busy, setBusy] = useState<number | null>(null);

  const setStatus = async (id: number, status: "done" | "pending") => {
    setBusy(id);
    try {
      const res = await fetch(`/api/admin/orders/${id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (res.ok) {
        setOrders((prev) =>
          prev.map((o) => (o.id === id ? { ...o, fulfillment_status: status } : o)),
        );
      }
    } finally {
      setBusy(null);
    }
  };

  if (!orders.length) {
    return <p className="tm-body">No orders yet.</p>;
  }

  const pending = orders.filter((o) => o.fulfillment_status === "pending").length;

  return (
    <div>
      <p className="tm-small" style={{ marginBottom: "12px" }}>
        {orders.length} orders · {pending} pending fulfillment
      </p>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13.5px" }}>
          <thead>
            <tr style={{ textAlign: "left", color: "var(--tm-ink-500, #667085)" }}>
              <th style={{ padding: "8px 10px" }}>Date</th>
              <th style={{ padding: "8px 10px" }}>Plan</th>
              <th style={{ padding: "8px 10px" }}>Credits</th>
              <th style={{ padding: "8px 10px" }}>Add-ons</th>
              <th style={{ padding: "8px 10px" }}>Total</th>
              <th style={{ padding: "8px 10px" }}>Fulfillment</th>
              <th style={{ padding: "8px 10px" }}></th>
            </tr>
          </thead>
          <tbody>
            {orders.map((o) => {
              const hasAddon = o.expert_feedback || o.human_revision;
              const isPending = o.fulfillment_status === "pending";
              return (
                <tr
                  key={o.id}
                  style={{
                    borderTop: "1px solid var(--tm-line, #eaecf0)",
                    background: isPending ? "var(--tm-amber-50, #fffaeb)" : undefined,
                  }}
                >
                  <td style={{ padding: "10px" }}>{date(o.created_at)}</td>
                  <td style={{ padding: "10px", textTransform: "capitalize" }}>
                    {o.plan_slug.replace("_", " ")}
                  </td>
                  <td style={{ padding: "10px" }}>{o.credits}</td>
                  <td style={{ padding: "10px" }}>
                    <span style={{ display: "flex", gap: "4px", flexWrap: "wrap" }}>
                      {o.expert_feedback && (
                        <span className="tm-pill tm-pill--mint" style={{ fontSize: "11px" }}>
                          Expert Feedback
                        </span>
                      )}
                      {o.human_revision && (
                        <span className="tm-pill tm-pill--mint" style={{ fontSize: "11px" }}>
                          Human Revision
                        </span>
                      )}
                      {!hasAddon && <span style={{ color: "var(--tm-ink-400,#98a2b3)" }}>—</span>}
                    </span>
                  </td>
                  <td style={{ padding: "10px" }}>{usd(o.total_cents)}</td>
                  <td style={{ padding: "10px" }}>
                    {o.fulfillment_status === "done" ? (
                      <span style={{ display: "inline-flex", alignItems: "center", gap: "4px", color: "var(--tm-mint-700,#067647)" }}>
                        <Check size={14} /> done
                      </span>
                    ) : isPending ? (
                      <span style={{ display: "inline-flex", alignItems: "center", gap: "4px", color: "var(--tm-amber-700,#b54708)" }}>
                        <Clock size={14} /> pending
                      </span>
                    ) : (
                      <span style={{ color: "var(--tm-ink-400,#98a2b3)" }}>none</span>
                    )}
                  </td>
                  <td style={{ padding: "10px", textAlign: "right" }}>
                    {hasAddon &&
                      (isPending ? (
                        <button
                          type="button"
                          className="tm-btn tm-btn--sm tm-btn--primary"
                          disabled={busy === o.id}
                          onClick={() => void setStatus(o.id, "done")}
                        >
                          {busy === o.id ? "…" : "Mark fulfilled"}
                        </button>
                      ) : o.fulfillment_status === "done" ? (
                        <button
                          type="button"
                          className="tm-btn tm-btn--sm tm-btn--outline"
                          disabled={busy === o.id}
                          onClick={() => void setStatus(o.id, "pending")}
                          title="Reopen"
                        >
                          <RotateCcw size={13} /> Reopen
                        </button>
                      ) : null)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
