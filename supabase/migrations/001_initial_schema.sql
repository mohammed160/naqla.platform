-- Hunda Design — Supabase initial database schema
-- Run once from Supabase Dashboard > SQL Editor > New query > Run

begin;

create extension if not exists pgcrypto;

-- ---------- Helpers ----------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.normalize_activation_code(p_code text)
returns text
language sql
immutable
strict
as $$
  select upper(regexp_replace(trim(p_code), '[^A-Za-z0-9]', '', 'g'));
$$;

-- ---------- Core tables ----------
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  display_name text,
  experience text,
  phone text,
  avatar_path text,
  role text not null default 'student' check (role in ('student', 'admin')),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.site_settings (
  id text primary key default 'public',
  settings jsonb not null default '{}'::jsonb,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.courses (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text not null default '',
  price numeric(12,2) not null default 0 check (price >= 0),
  paypal_price_usd numeric(12,2) check (paypal_price_usd is null or paypal_price_usd >= 0),
  trc20_price_usdt numeric(12,2) check (trc20_price_usdt is null or trc20_price_usdt >= 0),
  published boolean not null default true,
  featured boolean not null default false,
  thumbnail_path text,
  thumbnail_url text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.lectures (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses(id) on delete cascade,
  title text not null,
  description text not null default '',
  duration_text text not null default '',
  sort_order integer not null default 1 check (sort_order > 0),
  is_free boolean not null default false,
  published boolean not null default true,
  video_path text,
  video_name text,
  thumbnail_path text,
  thumbnail_url text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (course_id, sort_order)
);

create table if not exists public.materials (
  id uuid primary key default gen_random_uuid(),
  lecture_id uuid not null references public.lectures(id) on delete cascade,
  title text not null,
  file_path text not null,
  file_name text,
  file_size bigint check (file_size is null or file_size >= 0),
  mime_type text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  course_id uuid not null references public.courses(id) on delete restrict,
  provider text not null check (provider in ('paymob','fawry','paypal','instapay','vodafone_cash','trc20','manual')),
  status text not null default 'pending' check (status in ('created','pending','awaiting_transfer','paid','failed','cancelled','refunded')),
  amount numeric(12,2) not null check (amount >= 0),
  currency text not null default 'EGP',
  external_reference text,
  provider_order_id text,
  payment_proof_path text,
  metadata jsonb not null default '{}'::jsonb,
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.activation_codes (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses(id) on delete cascade,
  code_hash text not null unique,
  code_preview text not null,
  is_active boolean not null default true,
  expires_at timestamptz,
  used_by uuid references auth.users(id) on delete set null,
  used_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  check ((used_at is null and used_by is null) or (used_at is not null and used_by is not null))
);

create table if not exists public.enrollments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  course_id uuid not null references public.courses(id) on delete cascade,
  source text not null default 'manual' check (source in ('activation_code','payment','manual','gift')),
  payment_id uuid references public.payments(id) on delete set null,
  activation_code_id uuid references public.activation_codes(id) on delete set null,
  active boolean not null default true,
  enrolled_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, course_id)
);

create table if not exists public.lecture_progress (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  lecture_id uuid not null references public.lectures(id) on delete cascade,
  completed boolean not null default false,
  watched_seconds integer not null default 0 check (watched_seconds >= 0),
  last_position_seconds integer not null default 0 check (last_position_seconds >= 0),
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, lecture_id)
);

create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  student_name text not null,
  experience text not null default 'مبتدئ',
  title text not null,
  description text not null default '',
  image_path text not null,
  image_url text,
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  admin_note text,
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.favorites (
  user_id uuid not null references auth.users(id) on delete cascade,
  lecture_id uuid not null references public.lectures(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, lecture_id)
);

create table if not exists public.certificates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  course_id uuid not null references public.courses(id) on delete cascade,
  certificate_code text not null unique,
  issued_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  unique (user_id, course_id)
);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  body text not null,
  link text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

-- ---------- Useful indexes ----------
create index if not exists idx_courses_published on public.courses (published, featured);
create index if not exists idx_lectures_course_order on public.lectures (course_id, sort_order);
create index if not exists idx_materials_lecture on public.materials (lecture_id);
create index if not exists idx_enrollments_user_active on public.enrollments (user_id, active);
create index if not exists idx_projects_status_created on public.projects (status, created_at desc);
create index if not exists idx_payments_user_created on public.payments (user_id, created_at desc);
create index if not exists idx_activation_codes_course on public.activation_codes (course_id, is_active);
create index if not exists idx_notifications_user_created on public.notifications (user_id, created_at desc);

-- ---------- Auth profile trigger ----------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, display_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'display_name', new.raw_user_meta_data ->> 'full_name', split_part(coalesce(new.email, ''), '@', 1))
  )
  on conflict (id) do update set
    email = excluded.email,
    updated_at = now();
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert or update of email on auth.users
for each row execute function public.handle_new_user();

-- Backfill profiles for any existing Auth users.
insert into public.profiles (id, email, display_name)
select id, email, coalesce(raw_user_meta_data ->> 'display_name', raw_user_meta_data ->> 'full_name', split_part(coalesce(email, ''), '@', 1))
from auth.users
on conflict (id) do update set email = excluded.email;

-- ---------- Authorization helpers ----------
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin' and is_active = true
  );
$$;

create or replace function public.can_access_course(p_course_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_admin() or exists (
    select 1 from public.enrollments
    where user_id = auth.uid() and course_id = p_course_id and active = true
  );
$$;

create or replace function public.can_access_lecture(p_lecture_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.lectures l
    where l.id = p_lecture_id
      and l.published = true
      and (l.is_free = true or public.can_access_course(l.course_id))
  );
$$;

create or replace function public.can_access_lecture_path(p_path text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.lectures l
    where l.video_path = p_path and public.can_access_lecture(l.id)
  );
$$;

create or replace function public.can_access_material_path(p_path text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.materials m
    where m.file_path = p_path and public.can_access_lecture(m.lecture_id)
  );
$$;

-- Prevent users from promoting themselves.
create or replace function public.prevent_role_escalation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.role is distinct from old.role
     and coalesce(auth.role(), '') <> 'service_role'
     and not public.is_admin() then
    raise exception 'Only an admin can change user roles';
  end if;
  return new;
end;
$$;

drop trigger if exists prevent_role_escalation_trigger on public.profiles;
create trigger prevent_role_escalation_trigger
before update on public.profiles
for each row execute function public.prevent_role_escalation();

-- ---------- Single-use activation code RPCs ----------
-- Drop first: later migrations change the parameter defaults, which CREATE OR REPLACE cannot undo.
drop function if exists public.generate_activation_codes(uuid, integer, timestamptz);
create or replace function public.generate_activation_codes(
  p_course_id uuid,
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
begin
  if not public.is_admin() then
    raise exception 'Admin permission required';
  end if;
  if p_quantity < 1 or p_quantity > 500 then
    raise exception 'Quantity must be between 1 and 500';
  end if;
  if not exists (select 1 from public.courses where courses.id = p_course_id) then
    raise exception 'Course not found';
  end if;

  for i in 1..p_quantity loop
    loop
      v_code := 'HD-' || upper(substr(encode(gen_random_bytes(4), 'hex'), 1, 4)) || '-' || upper(substr(encode(gen_random_bytes(4), 'hex'), 1, 4));
      v_hash := encode(digest(public.normalize_activation_code(v_code), 'sha256'), 'hex');
      v_preview := 'HD-****-' || right(v_code, 4);
      begin
        insert into public.activation_codes (course_id, code_hash, code_preview, expires_at, created_by)
        values (p_course_id, v_hash, v_preview, p_expires_at, auth.uid())
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
  v_already_enrolled boolean;
begin
  if v_user is null then
    raise exception 'Authentication required';
  end if;

  v_hash := encode(digest(public.normalize_activation_code(p_code), 'sha256'), 'hex');

  select * into v_code
  from public.activation_codes
  where code_hash = v_hash
  for update;

  if not found then raise exception 'Invalid activation code'; end if;
  if not v_code.is_active then raise exception 'Activation code is disabled'; end if;
  if v_code.used_at is not null then raise exception 'Activation code was already used'; end if;
  if v_code.expires_at is not null and v_code.expires_at <= now() then raise exception 'Activation code has expired'; end if;

  select * into v_course from public.courses where id = v_code.course_id;
  if not found or not v_course.published then raise exception 'Course is not available'; end if;

  select exists (
    select 1 from public.enrollments
    where user_id = v_user and course_id = v_code.course_id and active = true
  ) into v_already_enrolled;

  insert into public.enrollments (user_id, course_id, source, activation_code_id, active)
  values (v_user, v_code.course_id, 'activation_code', v_code.id, true)
  on conflict (user_id, course_id)
  do update set active = true, source = 'activation_code', activation_code_id = excluded.activation_code_id, updated_at = now();

  update public.activation_codes
  set used_by = v_user, used_at = now(), is_active = false
  where activation_codes.id = v_code.id;

  return jsonb_build_object(
    'success', true,
    'course_id', v_course.id,
    'course_title', v_course.title,
    'already_enrolled', v_already_enrolled
  );
end;
$$;

revoke all on function public.generate_activation_codes(uuid, integer, timestamptz) from public;
revoke all on function public.redeem_activation_code(text) from public;
grant execute on function public.generate_activation_codes(uuid, integer, timestamptz) to authenticated;
grant execute on function public.redeem_activation_code(text) to authenticated;

-- ---------- Updated-at triggers ----------
do $$
declare
  t text;
begin
  foreach t in array array['profiles','site_settings','courses','lectures','materials','payments','enrollments','lecture_progress','projects']
  loop
    execute format('drop trigger if exists set_updated_at_%I on public.%I', t, t);
    execute format('create trigger set_updated_at_%I before update on public.%I for each row execute function public.set_updated_at()', t, t);
  end loop;
end $$;

-- ---------- Row Level Security ----------
alter table public.profiles enable row level security;
alter table public.site_settings enable row level security;
alter table public.courses enable row level security;
alter table public.lectures enable row level security;
alter table public.materials enable row level security;
alter table public.payments enable row level security;
alter table public.activation_codes enable row level security;
alter table public.enrollments enable row level security;
alter table public.lecture_progress enable row level security;
alter table public.projects enable row level security;
alter table public.favorites enable row level security;
alter table public.certificates enable row level security;
alter table public.notifications enable row level security;

-- Drop/recreate policies so the script can be safely re-run without deleting data.
do $$
declare r record;
begin
  for r in select schemaname, tablename, policyname from pg_policies where schemaname = 'public'
  loop
    execute format('drop policy if exists %I on %I.%I', r.policyname, r.schemaname, r.tablename);
  end loop;
end $$;

create policy profiles_select_own_or_admin on public.profiles
for select to authenticated
using (id = auth.uid() or public.is_admin());

create policy profiles_update_own_or_admin on public.profiles
for update to authenticated
using (id = auth.uid() or public.is_admin())
with check (id = auth.uid() or public.is_admin());

create policy site_settings_public_read on public.site_settings
for select to anon, authenticated using (true);
create policy site_settings_admin_all on public.site_settings
for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy courses_public_read on public.courses
for select to anon, authenticated
using (published = true or public.is_admin());
create policy courses_admin_all on public.courses
for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy lectures_accessible_read on public.lectures
for select to anon, authenticated
using (public.can_access_lecture(id) or public.is_admin());
create policy lectures_admin_all on public.lectures
for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy materials_accessible_read on public.materials
for select to anon, authenticated
using (public.can_access_lecture(lecture_id) or public.is_admin());
create policy materials_admin_all on public.materials
for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy payments_select_own_or_admin on public.payments
for select to authenticated using (user_id = auth.uid() or public.is_admin());
create policy payments_insert_own on public.payments
for insert to authenticated with check (user_id = auth.uid());
create policy payments_admin_update on public.payments
for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy payments_admin_delete on public.payments
for delete to authenticated using (public.is_admin());

create policy activation_codes_admin_only on public.activation_codes
for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy enrollments_select_own_or_admin on public.enrollments
for select to authenticated using (user_id = auth.uid() or public.is_admin());
create policy enrollments_admin_all on public.enrollments
for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy progress_own_all on public.lecture_progress
for all to authenticated
using (user_id = auth.uid() or public.is_admin())
with check (user_id = auth.uid() or public.is_admin());

create policy projects_public_approved_or_own on public.projects
for select to anon, authenticated
using (status = 'approved' or user_id = auth.uid() or public.is_admin());
create policy projects_insert_own on public.projects
for insert to authenticated with check (user_id = auth.uid());
create policy projects_update_own_pending_or_admin on public.projects
for update to authenticated
using ((user_id = auth.uid() and status = 'pending') or public.is_admin())
with check (user_id = auth.uid() or public.is_admin());
create policy projects_delete_own_pending_or_admin on public.projects
for delete to authenticated
using ((user_id = auth.uid() and status = 'pending') or public.is_admin());

create policy favorites_own_all on public.favorites
for all to authenticated
using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy certificates_select_own_or_admin on public.certificates
for select to authenticated using (user_id = auth.uid() or public.is_admin());
create policy certificates_admin_all on public.certificates
for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy notifications_own_select on public.notifications
for select to authenticated using (user_id = auth.uid() or public.is_admin());
create policy notifications_own_update on public.notifications
for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy notifications_admin_all on public.notifications
for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- ---------- Storage buckets ----------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('public-assets', 'public-assets', true, 10485760, array['image/jpeg','image/png','image/webp','image/svg+xml']),
  ('lecture-videos', 'lecture-videos', false, 1073741824, array['video/mp4','application/vnd.apple.mpegurl','video/mp2t']),
  ('course-materials', 'course-materials', false, 104857600, null),
  ('student-projects', 'student-projects', false, 20971520, array['image/jpeg','image/png','image/webp']),
  ('payment-proofs', 'payment-proofs', false, 10485760, array['image/jpeg','image/png','image/webp','application/pdf'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Storage RLS policies.
do $$
declare r record;
begin
  for r in select policyname from pg_policies where schemaname = 'storage' and tablename = 'objects'
  loop
    if r.policyname like 'hunda_%' then
      execute format('drop policy if exists %I on storage.objects', r.policyname);
    end if;
  end loop;
end $$;

create policy hunda_public_assets_read on storage.objects
for select to anon, authenticated
using (bucket_id = 'public-assets');

create policy hunda_admin_storage_all on storage.objects
for all to authenticated
using (public.is_admin())
with check (public.is_admin());

create policy hunda_lecture_videos_read on storage.objects
for select to anon, authenticated
using (bucket_id = 'lecture-videos' and public.can_access_lecture_path(name));

create policy hunda_materials_read on storage.objects
for select to anon, authenticated
using (bucket_id = 'course-materials' and public.can_access_material_path(name));

create policy hunda_student_projects_upload_own on storage.objects
for insert to authenticated
with check (
  bucket_id = 'student-projects'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy hunda_student_projects_read on storage.objects
for select to anon, authenticated
using (
  bucket_id = 'student-projects'
  and (
    (storage.foldername(name))[1] = auth.uid()::text
    or public.is_admin()
    or exists (select 1 from public.projects p where p.image_path = name and p.status = 'approved')
  )
);

create policy hunda_student_projects_delete_own on storage.objects
for delete to authenticated
using (
  bucket_id = 'student-projects'
  and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin())
);

create policy hunda_payment_proofs_upload_own on storage.objects
for insert to authenticated
with check (
  bucket_id = 'payment-proofs'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy hunda_payment_proofs_read_own_or_admin on storage.objects
for select to authenticated
using (
  bucket_id = 'payment-proofs'
  and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin())
);

-- ---------- Default site content ----------
insert into public.site_settings (id, settings)
values (
  'public',
  jsonb_build_object(
    'siteName', 'hunda design',
    'brandName', 'hunda design',
    'logoUrl', '',
    'footerLogoUrl', '',
    'heroTitle', 'طوّر مهاراتك في التصميم',
    'heroDescription', 'محاضرات عملية ومجتمع يساعدك تبني شغل أقوى.',
    'footerDescription', 'منصة عربية لتعلّم التصميم بشكل عملي.',
    'copyrightText', '© {year} {siteName}. جميع الحقوق محفوظة.',
    'socialLinks', jsonb_build_array(),
    'footerSections', jsonb_build_array()
  )
)
on conflict (id) do nothing;

commit;
