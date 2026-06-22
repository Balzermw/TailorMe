// Allowlist + sanitizer for product telemetry. Shared by the /api/events sink
// and tests. Client-safe (no server imports). NEVER allows résumé/job content
// or PII — only allowlisted event names and small primitive props.

export const ALLOWED_EVENTS = new Set<string>([
  // funnel / navigation
  "chooser_select",
  "resume_import_start",
  "resume_import_success",
  "resume_import_failed",
  "start_from_scratch",
  "template_select",
  "feedback_click",
  "target_job_click",
  "tailor_click",
  "pdf_click",
  // pricing + checkout
  "pricing_viewed",
  "plan_card_clicked",
  "checkout_started",
  "purchase_completed",
  // human-review upsells
  "expert_review_viewed",
  "expert_review_added",
  "expert_review_removed",
  "human_revision_viewed",
  "human_revision_added",
  "human_revision_removed",
  // free audit + paywall
  "free_audit_started",
  "free_audit_completed",
  "paywall_seen",
  // content interactions
  "refund_policy_clicked",
  "faq_opened",
  // resume feedback (rules engine) — counts/ids/categories only, NEVER content.
  // The one "surfaced" event carries the whole funnel (rules → candidates →
  // deduped → surfaced → suppressed); the rest are per-suggestion interactions.
  "resume_feedback_suggestions_surfaced",
  "resume_feedback_suggestion_clicked",
  "resume_feedback_suggestion_expanded",
  "resume_feedback_suggestion_applied",
  "resume_feedback_suggestion_dismissed",
  // legacy names kept for back-compat with already-shipped instrumentation
  "pricing_view",
  "checkout_start",
  "checkout_success",
  "credit_gate_shown",
  "limit_hit",
]);

export const MAX_PROPS = 12;
export const MAX_KEY_LEN = 40;
export const MAX_VAL_LEN = 80;
export const MAX_EVENT_BODY = 8_000;
export const MAX_BATCH = 10;

export function isAllowedEvent(name: unknown): name is string {
  return typeof name === "string" && ALLOWED_EVENTS.has(name);
}

/** Keep only small, safe primitives — drop objects, arrays, nullish, huge values. */
export function sanitizeProps(
  input: unknown,
): Record<string, string | number | boolean> {
  if (!input || typeof input !== "object") return {};
  const out: Record<string, string | number | boolean> = {};
  let i = 0;
  for (const [k, v] of Object.entries(input as Record<string, unknown>)) {
    if (i++ >= MAX_PROPS) break;
    const key = k.slice(0, MAX_KEY_LEN);
    if (typeof v === "string") out[key] = v.slice(0, MAX_VAL_LEN);
    else if (typeof v === "number" && Number.isFinite(v)) out[key] = v;
    else if (typeof v === "boolean") out[key] = v;
  }
  return out;
}
