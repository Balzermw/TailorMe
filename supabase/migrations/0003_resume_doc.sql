-- ============================================================
-- TailorMe: structured base resume (build-from-scratch path).
-- Adds a structured `doc` (TailoredDoc) + `source` to the base
-- resume, and links tailored applications back to their base
-- resume. All columns nullable/defaulted, so existing rows are
-- unaffected. RLS policies on both tables already cover these.
-- ============================================================

alter table public.resumes
  add column if not exists doc jsonb,                                 -- TailoredDoc: structured base resume
  add column if not exists source text not null default 'uploaded';   -- 'uploaded' | 'scratch' | 'pasted'

alter table public.applications
  add column if not exists resume_id uuid
    references public.resumes (id) on delete set null;                -- base resume this version came from
