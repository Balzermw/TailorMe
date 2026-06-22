-- ============================================================
-- Extend the product_events name allowlist (CHECK) with the resume-feedback
-- rules-engine events. Counts / rule ids / categories only — never résumé or
-- job text or evidence snippets (the /api/events sanitizer enforces primitives
-- + size caps as well).
-- ============================================================

alter table public.product_events drop constraint if exists product_events_name_ck;
alter table public.product_events add constraint product_events_name_ck check (name in (
  -- funnel / navigation
  'chooser_select','resume_import_start','resume_import_success',
  'resume_import_failed','start_from_scratch','template_select',
  'feedback_click','target_job_click','tailor_click','pdf_click',
  -- pricing + checkout
  'pricing_viewed','plan_card_clicked','checkout_started','purchase_completed',
  -- human-review upsells
  'expert_review_viewed','expert_review_added','expert_review_removed',
  'human_revision_viewed','human_revision_added','human_revision_removed',
  -- free audit + paywall
  'free_audit_started','free_audit_completed','paywall_seen',
  -- content interactions
  'refund_policy_clicked','faq_opened',
  -- resume feedback (rules engine)
  'resume_feedback_suggestions_surfaced','resume_feedback_suggestion_clicked',
  'resume_feedback_suggestion_expanded','resume_feedback_suggestion_applied',
  'resume_feedback_suggestion_dismissed',
  -- legacy names (already-shipped instrumentation)
  'pricing_view','checkout_start','checkout_success','credit_gate_shown','limit_hit'
));
