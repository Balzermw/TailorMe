-- ============================================================
-- Lock down SECURITY DEFINER functions so they aren't callable via the public
-- PostgREST RPC API (/rest/v1/rpc/...) by roles that shouldn't call them.
-- Bodies are unchanged — these functions legitimately need definer rights;
-- we only remove EXECUTE where it isn't intended (Supabase linter 0028/0029).
-- ============================================================

-- handle_new_user: a TRIGGER on auth.users. It fires with definer rights on
-- every signup regardless of these grants, so it never needs to be an RPC.
revoke execute on function public.handle_new_user() from public, anon, authenticated;

-- rls_auto_enable: maintenance/DDL helper, not a user-facing endpoint.
revoke execute on function public.rls_auto_enable() from public, anon, authenticated;

-- consume_credit: intentionally callable by SIGNED-IN users (it self-scopes via
-- auth.uid(), so a caller can only spend their own credit) — but never by
-- anonymous visitors. Keep authenticated + service_role; drop anon/public.
revoke execute on function public.consume_credit() from public, anon;
grant execute on function public.consume_credit() to authenticated, service_role;

-- add_credits: grants credits (Stripe webhook). Server/service-role only.
revoke execute on function public.add_credits(uuid, integer, text, text)
  from public, anon, authenticated;
grant execute on function public.add_credits(uuid, integer, text, text)
  to service_role;
