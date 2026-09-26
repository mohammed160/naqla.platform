-- Naqla: profile guard fix. Safe to re-run.
--
-- 1) Bootstrap: supabase/scripts/make_admin.sql failed in the SQL Editor with
--    "Only an admin can change user roles", because the editor sends no JWT and the
--    old guard only trusted service_role. A request with no JWT role is a direct
--    database connection (SQL Editor, psql), which only the project owner has.
--    Every API request (anon or signed-in) always carries a role claim.
-- 2) Hardening: a signed-in user could change their own is_active (a disabled admin
--    could re-enable themselves) and their own email copy in profiles (used by
--    admin_grant_membership to find users). Both are now admin-only, like role.
--    handle_new_user() still syncs email from auth.users: it runs inside the Auth
--    service, which uses service_role or no JWT.

begin;

create or replace function public.prevent_role_escalation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text := nullif(auth.role(), '');
begin
  if v_role is null or v_role = 'service_role' or public.is_admin() then
    return new;
  end if;

  if new.role is distinct from old.role then
    raise exception 'Only an admin can change user roles';
  end if;

  if new.is_active is distinct from old.is_active then
    raise exception 'Only an admin can change account status';
  end if;

  if new.email is distinct from old.email then
    raise exception 'Email is managed by the sign-in account';
  end if;

  return new;
end;
$$;

drop trigger if exists prevent_role_escalation_trigger on public.profiles;
create trigger prevent_role_escalation_trigger
before update on public.profiles
for each row execute function public.prevent_role_escalation();

commit;
