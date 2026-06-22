-- ============================================================
-- TailorMe: product telemetry (interaction events only).
-- Records WHAT users click + small, safe metadata to inform
-- design and usage/monetization decisions. NEVER stores résumé
-- content or PII — the /api/events route allowlists event names
-- and bounds props to primitives. Insert is open (incl. anon);
-- there is no select policy, so reads are denied through the
-- anon/auth API — run analytics with the service role / SQL editor.
-- ============================================================

create table if not exists public.events (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  user_id uuid references auth.users (id) on delete set null,
  session_id text,
  name text not null,
  props jsonb not null default '{}'::jsonb
);

create index if not exists events_name_created_idx on public.events (name, created_at desc);
create index if not exists events_user_created_idx on public.events (user_id, created_at desc);

alter table public.events enable row level security;

-- Anyone (including anon visitors) may record an event; no SELECT policy means
-- reads are blocked through the public API — analytics uses the service role.
drop policy if exists "events_insert_any" on public.events;
create policy "events_insert_any" on public.events
  for insert to anon, authenticated with check (true);
