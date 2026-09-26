-- Design Tips / Hunda Design — YouTube lecture playback
-- Safe migration: adds a protected video-source table and keeps all existing lectures/files unchanged.

begin;

create table if not exists public.lecture_video_sources (
  lecture_id uuid primary key references public.lectures(id) on delete cascade,
  provider text not null default 'youtube' check (provider in ('youtube')),
  provider_video_id text not null check (provider_video_id ~ '^[A-Za-z0-9_-]{11}$'),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.lecture_video_sources enable row level security;

drop trigger if exists set_updated_at_lecture_video_sources on public.lecture_video_sources;
create trigger set_updated_at_lecture_video_sources
before update on public.lecture_video_sources
for each row execute function public.set_updated_at();

drop policy if exists lecture_video_sources_admin_all on public.lecture_video_sources;
create policy lecture_video_sources_admin_all
on public.lecture_video_sources
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

-- Authenticated admins need table privileges; RLS still blocks every non-admin direct query.
grant select, insert, update, delete on public.lecture_video_sources to authenticated;
revoke all on public.lecture_video_sources from anon;

create or replace function public.get_lecture_playback(p_lecture_id uuid)
returns table (
  provider text,
  provider_video_id text
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  if not public.can_access_lecture(p_lecture_id) and not public.is_admin() then
    return;
  end if;

  return query
  select s.provider, s.provider_video_id
  from public.lecture_video_sources s
  where s.lecture_id = p_lecture_id;
end;
$$;

revoke all on function public.get_lecture_playback(uuid) from public;
grant execute on function public.get_lecture_playback(uuid) to anon, authenticated;

comment on table public.lecture_video_sources is
'Protected external video identifiers. Students receive a source only through get_lecture_playback after lecture-access checks.';

commit;
