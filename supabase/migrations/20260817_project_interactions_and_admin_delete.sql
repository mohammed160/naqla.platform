-- Design Tips — interactive student projects + safe admin user deletion prerequisites

begin;

-- Keep activation-code audit data valid when an Auth user is deleted.
-- A used code stays disabled and keeps used_at, while used_by may become NULL via ON DELETE SET NULL.
alter table public.activation_codes drop constraint if exists activation_codes_check;
alter table public.activation_codes drop constraint if exists activation_codes_usage_consistency;
alter table public.activation_codes
  add constraint activation_codes_usage_consistency
  check (used_by is null or used_at is not null);

-- Cached counters keep the public gallery fast.
alter table public.projects add column if not exists likes_count integer not null default 0 check (likes_count >= 0);
alter table public.projects add column if not exists saves_count integer not null default 0 check (saves_count >= 0);
alter table public.projects add column if not exists comments_count integer not null default 0 check (comments_count >= 0);
alter table public.projects add column if not exists views_count integer not null default 0 check (views_count >= 0);

-- Project interaction counters are database-managed. The existing student-review
-- trigger must allow trusted counter refreshes without allowing students to spoof them.
create or replace function public.enforce_student_project_review_state()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_counter_refresh boolean := coalesce(current_setting('app.project_counter_refresh', true), '') = '1';
  v_only_counters_touched boolean :=
    (to_jsonb(new) - array['likes_count','saves_count','comments_count','views_count'])
    = (to_jsonb(old) - array['likes_count','saves_count','comments_count','views_count']);
  v_counters_changed boolean :=
    new.likes_count is distinct from old.likes_count
    or new.saves_count is distinct from old.saves_count
    or new.comments_count is distinct from old.comments_count
    or new.views_count is distinct from old.views_count;
begin
  -- Trusted internal refreshes are allowed even when 0 is rewritten as 0 during backfill,
  -- but they may not modify any non-counter project field.
  if v_counter_refresh then
    if v_only_counters_touched then
      return new;
    end if;
    raise exception 'Internal project counter refresh attempted to change project content';
  end if;

  -- Outside trusted refreshes, nobody can write cached counters directly.
  if v_counters_changed then
    raise exception 'Project interaction counters are managed automatically';
  end if;

  -- Admin/service updates retain full moderation control.
  if coalesce(auth.role(), '') = 'service_role' or public.is_admin() then
    return new;
  end if;

  -- A student may only edit their own project and can never transfer ownership.
  if old.user_id is distinct from auth.uid() then
    raise exception 'You can only edit your own project';
  end if;

  new.user_id := old.user_id;
  new.status := 'pending';
  new.reviewed_by := null;
  new.reviewed_at := null;
  new.admin_note := old.admin_note;
  return new;
end;
$$;

create table if not exists public.project_likes (
  project_id uuid not null references public.projects(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (project_id, user_id)
);

create table if not exists public.project_saves (
  project_id uuid not null references public.projects(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (project_id, user_id)
);

create table if not exists public.project_comments (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  commenter_name text not null default 'طالب في المنصة',
  body text not null check (char_length(trim(body)) between 1 and 800),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.project_views (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  visitor_id uuid,
  created_at timestamptz not null default now(),
  constraint project_views_one_identity check (num_nonnulls(user_id, visitor_id) = 1)
);

create unique index if not exists project_views_unique_user
  on public.project_views (project_id, user_id)
  where user_id is not null;

create unique index if not exists project_views_unique_visitor
  on public.project_views (project_id, visitor_id)
  where visitor_id is not null;

create index if not exists idx_project_comments_project_created
  on public.project_comments (project_id, created_at desc);
create index if not exists idx_project_likes_user on public.project_likes (user_id);
create index if not exists idx_project_saves_user on public.project_saves (user_id);

create or replace function public.prepare_project_comment()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name text;
begin
  if tg_op = 'INSERT' then
    if auth.uid() is null then
      raise exception 'Authentication required';
    end if;

    new.user_id := auth.uid();
    select nullif(trim(display_name), '') into v_name
    from public.profiles
    where id = auth.uid();
    new.commenter_name := coalesce(v_name, 'طالب في المنصة');
  else
    new.project_id := old.project_id;
    new.user_id := old.user_id;
    new.commenter_name := old.commenter_name;
  end if;

  new.body := trim(new.body);
  return new;
end;
$$;

drop trigger if exists prepare_project_comment_trigger on public.project_comments;
create trigger prepare_project_comment_trigger
before insert or update on public.project_comments
for each row execute function public.prepare_project_comment();

drop trigger if exists set_updated_at_project_comments on public.project_comments;
create trigger set_updated_at_project_comments
before update on public.project_comments
for each row execute function public.set_updated_at();

create or replace function public.refresh_project_interaction_counts()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_project_id uuid;
begin
  if tg_op = 'DELETE' then
    v_project_id := old.project_id;
  else
    v_project_id := new.project_id;
  end if;

  perform set_config('app.project_counter_refresh', '1', true);

  update public.projects p
  set
    likes_count = (select count(*)::integer from public.project_likes l where l.project_id = v_project_id),
    saves_count = (select count(*)::integer from public.project_saves s where s.project_id = v_project_id),
    comments_count = (select count(*)::integer from public.project_comments c where c.project_id = v_project_id),
    views_count = (select count(*)::integer from public.project_views v where v.project_id = v_project_id)
  where p.id = v_project_id;

  perform set_config('app.project_counter_refresh', '0', true);
  return null;
end;
$$;

drop trigger if exists refresh_project_likes_count on public.project_likes;
create trigger refresh_project_likes_count
after insert or delete on public.project_likes
for each row execute function public.refresh_project_interaction_counts();

drop trigger if exists refresh_project_saves_count on public.project_saves;
create trigger refresh_project_saves_count
after insert or delete on public.project_saves
for each row execute function public.refresh_project_interaction_counts();

drop trigger if exists refresh_project_comments_count on public.project_comments;
create trigger refresh_project_comments_count
after insert or delete on public.project_comments
for each row execute function public.refresh_project_interaction_counts();

drop trigger if exists refresh_project_views_count on public.project_views;
create trigger refresh_project_views_count
after insert or delete on public.project_views
for each row execute function public.refresh_project_interaction_counts();

create or replace function public.register_project_view(
  p_project_id uuid,
  p_visitor_id uuid default null
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_rows bigint := 0;
begin
  if not exists (
    select 1 from public.projects
    where id = p_project_id and status = 'approved'
  ) then
    return false;
  end if;

  if v_user_id is not null then
    insert into public.project_views (project_id, user_id)
    values (p_project_id, v_user_id)
    on conflict do nothing;
  else
    if p_visitor_id is null then return false; end if;
    insert into public.project_views (project_id, visitor_id)
    values (p_project_id, p_visitor_id)
    on conflict do nothing;
  end if;

  get diagnostics v_rows = row_count;
  return v_rows > 0;
end;
$$;

-- Backfill counters if this migration is applied to an existing production database.
select set_config('app.project_counter_refresh', '1', true);

update public.projects p set
  likes_count = (select count(*)::integer from public.project_likes l where l.project_id = p.id),
  saves_count = (select count(*)::integer from public.project_saves s where s.project_id = p.id),
  comments_count = (select count(*)::integer from public.project_comments c where c.project_id = p.id),
  views_count = (select count(*)::integer from public.project_views v where v.project_id = p.id);

select set_config('app.project_counter_refresh', '0', true);

alter table public.project_likes enable row level security;
alter table public.project_saves enable row level security;
alter table public.project_comments enable row level security;
alter table public.project_views enable row level security;

drop policy if exists project_likes_select_own_or_admin on public.project_likes;
create policy project_likes_select_own_or_admin on public.project_likes
for select to authenticated
using (user_id = auth.uid() or public.is_admin());

drop policy if exists project_likes_insert_own on public.project_likes;
create policy project_likes_insert_own on public.project_likes
for insert to authenticated
with check (
  user_id = auth.uid()
  and exists (
    select 1 from public.projects p
    where p.id = project_id and p.status = 'approved'
  )
);

drop policy if exists project_likes_delete_own_or_admin on public.project_likes;
create policy project_likes_delete_own_or_admin on public.project_likes
for delete to authenticated
using (user_id = auth.uid() or public.is_admin());

drop policy if exists project_saves_select_own_or_admin on public.project_saves;
create policy project_saves_select_own_or_admin on public.project_saves
for select to authenticated
using (user_id = auth.uid() or public.is_admin());

drop policy if exists project_saves_insert_own on public.project_saves;
create policy project_saves_insert_own on public.project_saves
for insert to authenticated
with check (
  user_id = auth.uid()
  and exists (
    select 1 from public.projects p
    where p.id = project_id and p.status = 'approved'
  )
);

drop policy if exists project_saves_delete_own_or_admin on public.project_saves;
create policy project_saves_delete_own_or_admin on public.project_saves
for delete to authenticated
using (user_id = auth.uid() or public.is_admin());

drop policy if exists project_comments_public_read on public.project_comments;
create policy project_comments_public_read on public.project_comments
for select to anon, authenticated
using (
  exists (
    select 1 from public.projects p
    where p.id = project_id and p.status = 'approved'
  )
  or user_id = auth.uid()
  or public.is_admin()
);

drop policy if exists project_comments_insert_own on public.project_comments;
create policy project_comments_insert_own on public.project_comments
for insert to authenticated
with check (
  user_id = auth.uid()
  and exists (
    select 1 from public.projects p
    where p.id = project_id and p.status = 'approved'
  )
);

drop policy if exists project_comments_update_own on public.project_comments;
create policy project_comments_update_own on public.project_comments
for update to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists project_comments_delete_own_or_admin on public.project_comments;
create policy project_comments_delete_own_or_admin on public.project_comments
for delete to authenticated
using (user_id = auth.uid() or public.is_admin());

revoke all on public.project_likes from anon, authenticated;
revoke all on public.project_saves from anon, authenticated;
revoke all on public.project_comments from anon, authenticated;
revoke all on public.project_views from anon, authenticated;

grant select, insert, delete on public.project_likes to authenticated;
grant select, insert, delete on public.project_saves to authenticated;
grant select on public.project_comments to anon, authenticated;
grant insert, update, delete on public.project_comments to authenticated;

revoke all on function public.register_project_view(uuid, uuid) from public;
grant execute on function public.register_project_view(uuid, uuid) to anon, authenticated;

commit;
