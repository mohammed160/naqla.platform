-- Naqla — one lifetime membership that unlocks every published course.
-- MUST run last: it replaces admin_review_payment / generate_activation_codes / redeem_activation_code
-- (also defined in 20260805 and 20260815) and needs activation_codes.code_value from 20260815.
-- The date prefix makes it sort after every other migration. Safe to re-run.
--
-- Model:
--   plans        the thing that is sold (today: one lifetime plan)
--   memberships  one row per member; expires_at is NULL for lifetime plans
--   Access       can_access_course() now returns true for an admin, an active
--                per-course enrollment (kept for gifts/legacy), or an active membership.
--                Lectures, materials, video sources and storage policies already call
--                can_access_course(), so they pick the membership up automatically.

begin;

-- ---------- Plans ----------
create table if not exists public.plans (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  description text not null default '',
  price_egp numeric(12,2) not null default 0 check (price_egp >= 0),
  price_usd numeric(12,2) check (price_usd is null or price_usd >= 0),
  price_usdt numeric(12,2) check (price_usdt is null or price_usdt >= 0),
  is_lifetime boolean not null default true,
  duration_days integer check (duration_days is null or duration_days > 0),
  published boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (is_lifetime = true or duration_days is not null)
);

-- ---------- Memberships ----------
create table if not exists public.memberships (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  plan_id uuid not null references public.plans(id) on delete restrict,
  source text not null default 'manual' check (source in ('payment', 'activation_code', 'manual', 'gift')),
  payment_id uuid references public.payments(id) on delete set null,
  activation_code_id uuid references public.activation_codes(id) on delete set null,
  active boolean not null default true,
  granted_at timestamptz not null default now(),
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_memberships_active on public.memberships (user_id) where active = true;

-- ---------- Payments and codes may now target a plan instead of a course ----------
alter table public.payments alter column course_id drop not null;
alter table public.payments add column if not exists plan_id uuid references public.plans(id) on delete restrict;
alter table public.payments drop constraint if exists payments_target_check;
alter table public.payments add constraint payments_target_check check (course_id is not null or plan_id is not null);

alter table public.activation_codes alter column course_id drop not null;
alter table public.activation_codes add column if not exists plan_id uuid references public.plans(id) on delete cascade;
alter table public.activation_codes drop constraint if exists activation_codes_target_check;
alter table public.activation_codes add constraint activation_codes_target_check check (course_id is not null or plan_id is not null);

-- ---------- Track presentation on courses ----------
alter table public.courses add column if not exists accent text check (accent is null or accent in ('pink', 'purple', 'orange', 'teal'));
alter table public.courses add column if not exists sort_order integer not null default 100;

-- ---------- updated_at triggers ----------
drop trigger if exists set_updated_at_plans on public.plans;
create trigger set_updated_at_plans before update on public.plans
for each row execute function public.set_updated_at();

drop trigger if exists set_updated_at_memberships on public.memberships;
create trigger set_updated_at_memberships before update on public.memberships
for each row execute function public.set_updated_at();

-- ---------- Access ----------
create or replace function public.has_active_membership(p_user uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select p_user is not null and exists (
    select 1 from public.memberships
    where user_id = p_user
      and active = true
      and (expires_at is null or expires_at > now())
  );
$$;

create or replace function public.can_access_course(p_course_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_admin()
    or public.has_active_membership(auth.uid())
    or exists (
      select 1 from public.enrollments
      where user_id = auth.uid() and course_id = p_course_id and active = true
    );
$$;

-- ---------- Granting (server-side only) ----------
create or replace function public.grant_membership(
  p_user uuid,
  p_plan uuid,
  p_source text default 'manual',
  p_payment uuid default null,
  p_code uuid default null
)
returns public.memberships
language plpgsql
security definer
set search_path = public
as $$
declare
  v_plan public.plans%rowtype;
  v_row public.memberships%rowtype;
begin
  select * into v_plan from public.plans where id = p_plan;
  if not found then
    raise exception 'Plan not found';
  end if;

  insert into public.memberships (user_id, plan_id, source, payment_id, activation_code_id, active, granted_at, expires_at)
  values (
    p_user, p_plan, p_source, p_payment, p_code, true, now(),
    case when v_plan.is_lifetime then null else now() + make_interval(days => v_plan.duration_days) end
  )
  on conflict (user_id) do update
    set plan_id = excluded.plan_id,
        source = excluded.source,
        payment_id = coalesce(excluded.payment_id, public.memberships.payment_id),
        activation_code_id = coalesce(excluded.activation_code_id, public.memberships.activation_code_id),
        active = true,
        granted_at = now(),
        expires_at = excluded.expires_at,
        updated_at = now()
  returning * into v_row;

  return v_row;
end;
$$;

revoke all on function public.grant_membership(uuid, uuid, text, uuid, uuid) from public, anon, authenticated;
grant execute on function public.grant_membership(uuid, uuid, text, uuid, uuid) to service_role;

-- Default plan used by membership codes and manual grants.
create or replace function public.default_plan_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select id from public.plans where published = true order by created_at asc limit 1;
$$;

-- ---------- Payment review (approve = membership when the payment targets a plan) ----------
create or replace function public.admin_review_payment(
  p_payment_id uuid,
  p_action text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_payment public.payments%rowtype;
begin
  if not public.is_admin() then
    raise exception 'Admin permission required';
  end if;

  if p_action not in ('approve', 'reject') then
    raise exception 'Invalid action';
  end if;

  select * into v_payment from public.payments where id = p_payment_id for update;
  if not found then
    raise exception 'Payment not found';
  end if;

  if p_action = 'approve' then
    update public.payments
    set status = 'paid', paid_at = coalesce(paid_at, now()), updated_at = now()
    where id = p_payment_id;

    if v_payment.plan_id is not null then
      perform public.grant_membership(v_payment.user_id, v_payment.plan_id, 'payment', v_payment.id, null);
    else
      insert into public.enrollments (user_id, course_id, source, payment_id, active)
      values (v_payment.user_id, v_payment.course_id, 'payment', v_payment.id, true)
      on conflict (user_id, course_id)
      do update set active = true, source = 'payment', payment_id = excluded.payment_id, updated_at = now();
    end if;
  else
    update public.payments set status = 'failed', updated_at = now() where id = p_payment_id;
  end if;

  return jsonb_build_object('success', true, 'status', case when p_action = 'approve' then 'paid' else 'failed' end);
end;
$$;

revoke all on function public.admin_review_payment(uuid, text) from public;
grant execute on function public.admin_review_payment(uuid, text) to authenticated;

-- ---------- Activation codes ----------
-- Passing NULL as p_course_id creates membership codes (prefix NQ-).
-- Passing a course id keeps the old single-course behaviour.
create or replace function public.generate_activation_codes(
  p_course_id uuid default null,
  p_quantity integer default 1,
  p_expires_at timestamptz default null
)
returns table (id uuid, code text, code_preview text)
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  i integer;
  v_code text;
  v_hash text;
  v_id uuid;
  v_preview text;
  v_plan uuid;
  v_prefix text;
begin
  if not public.is_admin() then
    raise exception 'Admin permission required';
  end if;

  if p_quantity < 1 or p_quantity > 500 then
    raise exception 'Quantity must be between 1 and 500';
  end if;

  if p_course_id is null then
    v_plan := public.default_plan_id();
    if v_plan is null then
      raise exception 'No published plan found';
    end if;
    v_prefix := 'NQ';
  else
    if not exists (select 1 from public.courses where courses.id = p_course_id) then
      raise exception 'Course not found';
    end if;
    v_prefix := 'HD';
  end if;

  for i in 1..p_quantity loop
    loop
      v_code := v_prefix || '-' || upper(substr(encode(gen_random_bytes(4), 'hex'), 1, 4)) || '-' || upper(substr(encode(gen_random_bytes(4), 'hex'), 1, 4));
      v_hash := encode(digest(public.normalize_activation_code(v_code), 'sha256'), 'hex');
      v_preview := v_prefix || '-****-' || right(v_code, 4);

      begin
        insert into public.activation_codes (course_id, plan_id, code_hash, code_preview, code_value, expires_at, created_by)
        values (p_course_id, v_plan, v_hash, v_preview, v_code, p_expires_at, auth.uid())
        returning activation_codes.id into v_id;
        exit;
      exception when unique_violation then
        -- Extremely unlikely; generate another random code.
      end;
    end loop;

    id := v_id;
    code := v_code;
    code_preview := v_preview;
    return next;
  end loop;
end;
$$;

revoke all on function public.generate_activation_codes(uuid, integer, timestamptz) from public;
grant execute on function public.generate_activation_codes(uuid, integer, timestamptz) to authenticated;

create or replace function public.redeem_activation_code(p_code text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_user uuid := auth.uid();
  v_hash text;
  v_code public.activation_codes%rowtype;
  v_course public.courses%rowtype;
  v_plan public.plans%rowtype;
  v_already boolean := false;
begin
  if v_user is null then
    raise exception 'Authentication required';
  end if;

  if nullif(trim(coalesce(p_code, '')), '') is null then
    raise exception 'Invalid activation code';
  end if;

  v_hash := encode(digest(public.normalize_activation_code(p_code), 'sha256'), 'hex');

  select * into v_code from public.activation_codes where code_hash = v_hash for update;
  if not found then
    raise exception 'Invalid activation code';
  end if;

  -- Membership code
  if v_code.plan_id is not null then
    select * into v_plan from public.plans where id = v_code.plan_id;
    if not found or not v_plan.published then
      raise exception 'Plan is not available';
    end if;

    v_already := public.has_active_membership(v_user);

    if v_code.used_at is not null then
      if v_code.used_by = v_user and v_already then
        return jsonb_build_object('success', true, 'kind', 'membership', 'plan_title', v_plan.title, 'already_enrolled', true, 'retried', true);
      end if;
      raise exception 'Activation code was already used';
    end if;

    if not v_code.is_active then raise exception 'Activation code is disabled'; end if;
    if v_code.expires_at is not null and v_code.expires_at <= now() then raise exception 'Activation code has expired'; end if;

    perform public.grant_membership(v_user, v_plan.id, 'activation_code', null, v_code.id);

    update public.activation_codes
    set used_by = v_user, used_at = now(), is_active = false
    where activation_codes.id = v_code.id;

    return jsonb_build_object('success', true, 'kind', 'membership', 'plan_title', v_plan.title, 'already_enrolled', v_already, 'retried', false);
  end if;

  -- Single-course code (legacy behaviour)
  select * into v_course from public.courses where id = v_code.course_id;
  if not found or not v_course.published then
    raise exception 'Course is not available';
  end if;

  select exists (
    select 1 from public.enrollments
    where user_id = v_user and course_id = v_code.course_id and active = true
  ) into v_already;

  if v_code.used_at is not null then
    if v_code.used_by = v_user and v_already then
      return jsonb_build_object('success', true, 'kind', 'course', 'course_id', v_course.id, 'course_title', v_course.title, 'already_enrolled', true, 'retried', true);
    end if;
    raise exception 'Activation code was already used';
  end if;

  if not v_code.is_active then raise exception 'Activation code is disabled'; end if;
  if v_code.expires_at is not null and v_code.expires_at <= now() then raise exception 'Activation code has expired'; end if;

  insert into public.enrollments (user_id, course_id, source, activation_code_id, active)
  values (v_user, v_code.course_id, 'activation_code', v_code.id, true)
  on conflict (user_id, course_id)
  do update set active = true, source = 'activation_code', activation_code_id = excluded.activation_code_id, updated_at = now();

  update public.activation_codes
  set used_by = v_user, used_at = now(), is_active = false
  where activation_codes.id = v_code.id;

  return jsonb_build_object('success', true, 'kind', 'course', 'course_id', v_course.id, 'course_title', v_course.title, 'already_enrolled', v_already, 'retried', false);
end;
$$;

revoke all on function public.redeem_activation_code(text) from public;
grant execute on function public.redeem_activation_code(text) to authenticated;

-- ---------- Admin: grant / revoke by email ----------
create or replace function public.admin_grant_membership(p_email text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid;
  v_plan uuid;
begin
  if not public.is_admin() then
    raise exception 'Admin permission required';
  end if;

  select id into v_user from public.profiles where lower(email) = lower(trim(p_email));
  if v_user is null then
    raise exception 'User not found';
  end if;

  v_plan := public.default_plan_id();
  if v_plan is null then
    raise exception 'No published plan found';
  end if;

  perform public.grant_membership(v_user, v_plan, 'manual', null, null);
  return jsonb_build_object('success', true, 'user_id', v_user);
end;
$$;

create or replace function public.admin_set_membership_active(p_user uuid, p_active boolean)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Admin permission required';
  end if;

  update public.memberships set active = p_active, updated_at = now() where user_id = p_user;
  return jsonb_build_object('success', true, 'active', p_active);
end;
$$;

revoke all on function public.admin_grant_membership(text) from public;
revoke all on function public.admin_set_membership_active(uuid, boolean) from public;
grant execute on function public.admin_grant_membership(text) to authenticated;
grant execute on function public.admin_set_membership_active(uuid, boolean) to authenticated;

-- ---------- RLS ----------
alter table public.plans enable row level security;
alter table public.memberships enable row level security;

drop policy if exists plans_public_read on public.plans;
create policy plans_public_read on public.plans
for select to anon, authenticated
using (published = true or public.is_admin());

drop policy if exists plans_admin_all on public.plans;
create policy plans_admin_all on public.plans
for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists memberships_select_own_or_admin on public.memberships;
create policy memberships_select_own_or_admin on public.memberships
for select to authenticated using (user_id = auth.uid() or public.is_admin());

drop policy if exists memberships_admin_all on public.memberships;
create policy memberships_admin_all on public.memberships
for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- ---------- Seed: one plan and the three tracks ----------
-- The price below is a placeholder. Change it from the admin portal (Plan page).
insert into public.plans (slug, title, description, price_egp, is_lifetime, published)
values (
  'naqla-lifetime',
  'عضوية نقلة مدى الحياة',
  'دفعة واحدة تفتح لك الكورسات الثلاثة، وأي كورس نضيفه لاحقًا.',
  1999,
  true,
  true
)
on conflict (slug) do nothing;

insert into public.courses (title, description, price, published, featured, accent, sort_order)
select v.title, v.description, 0, true, v.featured, v.accent, v.sort_order
from (values
  ('تصميم المحتوى الجرافيكي', 'ابنِ هوية بصرية لمحتواك: من فكرة الشريحة والبوستر إلى غلاف الكورس والإعلان، بأدوات عملية وخطوات واضحة.', true, 'pink', 10),
  ('بناء المنصات بالـ Vibe Coding', 'اصنع منصتك ومنتجك الرقمي بنفسك بمساعدة الذكاء الاصطناعي، من غير ما تكون مبرمج.', false, 'purple', 20),
  ('الإعلانات الممولة', 'اعرف تستهدف العميل المناسب لك، وتبني حملة تجيب نتيجة وتقيس أثرها.', false, 'orange', 30)
) as v(title, description, featured, accent, sort_order)
where not exists (select 1 from public.courses c where c.title = v.title);

commit;
