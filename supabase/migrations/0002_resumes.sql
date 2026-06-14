-- ============================================================
-- TailorMe: persistent resume profile ("upload once")
-- One saved resume per user, reused across applications.
-- RLS restricts every row to its owning user.
-- ============================================================

create table if not exists public.resumes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null default 'My resume',
  raw_text text not null,
  stats jsonb, -- ResumeStats snapshot (roles/bullets/skills)
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- One saved resume per user → POST upserts on this key.
create unique index if not exists resumes_user_uniq on public.resumes (user_id);

alter table public.resumes enable row level security;

drop policy if exists "resumes_all_own" on public.resumes;
create policy "resumes_all_own" on public.resumes
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
