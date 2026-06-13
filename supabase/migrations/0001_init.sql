-- ============================================================
-- TailorMe initial schema
-- Run in the Supabase SQL editor (or `supabase db push`).
-- Tables: profiles, credit_transactions, applications.
-- Row-Level Security restricts every row to its owning user.
-- New users get a profile + 1 free application credit automatically.
-- ============================================================

-- ---------- profiles ----------
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  full_name text,
  credits integer not null default 1, -- 1 free application on signup
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own" on public.profiles
  for select using (auth.uid() = id);

-- No client UPDATE policy on purpose: the credit balance must only change via
-- the SECURITY DEFINER functions below (consume_credit / add_credits), never a
-- direct client write — otherwise a user could set their own balance.

-- ---------- credit_transactions (audit log) ----------
create table if not exists public.credit_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  delta integer not null, -- +credits on purchase, -1 on consume
  reason text not null, -- 'signup_free' | 'purchase' | 'consume' | 'refund'
  stripe_session_id text, -- idempotency key for purchases
  created_at timestamptz not null default now()
);

create index if not exists credit_tx_user_idx
  on public.credit_transactions (user_id, created_at desc);
create unique index if not exists credit_tx_stripe_session_uniq
  on public.credit_transactions (stripe_session_id)
  where stripe_session_id is not null;

alter table public.credit_transactions enable row level security;

drop policy if exists "credit_tx_select_own" on public.credit_transactions;
create policy "credit_tx_select_own" on public.credit_transactions
  for select using (auth.uid() = user_id);

-- ---------- applications ----------
create table if not exists public.applications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  company text not null,
  role text not null,
  posting text, -- url or pasted text
  fit_score integer,
  status text not null default 'scored', -- scored|running|ready|human_review
  michael_status text not null default 'none', -- none|requested|in_review|returned
  result jsonb, -- full ApplyResult payload
  created_at timestamptz not null default now()
);

create index if not exists applications_user_idx
  on public.applications (user_id, created_at desc);

alter table public.applications enable row level security;

drop policy if exists "applications_all_own" on public.applications;
create policy "applications_all_own" on public.applications
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ---------- new-user trigger: profile + free credit ----------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (
    new.id,
    coalesce(new.email, ''),
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name')
  )
  on conflict (id) do nothing;

  insert into public.credit_transactions (user_id, delta, reason)
  values (new.id, 1, 'signup_free');

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------- add_credits (service role, e.g. Stripe webhook) ----------
-- Idempotent on stripe_session_id: a replayed webhook grants nothing extra.
create or replace function public.add_credits(
  p_user_id uuid,
  p_credits integer,
  p_reason text,
  p_stripe_session_id text default null
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_balance integer;
begin
  if p_stripe_session_id is not null and exists (
    select 1 from public.credit_transactions
    where stripe_session_id = p_stripe_session_id
  ) then
    select credits into v_balance from public.profiles where id = p_user_id;
    return v_balance; -- already processed
  end if;

  insert into public.credit_transactions (user_id, delta, reason, stripe_session_id)
  values (p_user_id, p_credits, p_reason, p_stripe_session_id);

  update public.profiles
    set credits = credits + p_credits
    where id = p_user_id
    returning credits into v_balance;

  return v_balance;
end;
$$;

-- ---------- consume_credit (atomic decrement for the caller) ----------
-- Uses auth.uid() (not a parameter) so a caller can only spend their OWN
-- credit. Returns true if a credit was spent, false if the balance was 0.
create or replace function public.consume_credit()
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_ok boolean := false;
begin
  if v_uid is null then
    return false;
  end if;

  update public.profiles
    set credits = credits - 1
    where id = v_uid and credits > 0
    returning true into v_ok;

  if v_ok then
    insert into public.credit_transactions (user_id, delta, reason)
    values (v_uid, -1, 'consume');
  end if;

  return coalesce(v_ok, false);
end;
$$;

-- Lock down add_credits: only the service role (Stripe webhook) may grant
-- credits. Authenticated/anon callers cannot.
revoke all on function public.add_credits(uuid, integer, text, text)
  from public, anon, authenticated;
