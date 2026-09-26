-- Design Tips — student reviews for courses and lectures
-- Run once after 004_youtube_lecture_sources.sql.

begin;

create table if not exists public.student_reviews (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  course_id uuid references public.courses(id) on delete cascade,
  lecture_id uuid references public.lectures(id) on delete cascade,
  rating smallint not null check (rating between 1 and 5),
  comment text not null check (char_length(trim(comment)) between 3 and 1000),
  reviewer_name text not null default 'طالب في المنصة',
  is_hidden boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint student_reviews_single_target check (
    (course_id is not null and lecture_id is null)
    or (course_id is null and lecture_id is not null)
  )
);

create unique index if not exists student_reviews_one_course_review_per_user
on public.student_reviews (user_id, course_id)
where course_id is not null;

create unique index if not exists student_reviews_one_lecture_review_per_user
on public.student_reviews (user_id, lecture_id)
where lecture_id is not null;

create index if not exists idx_student_reviews_course_created
on public.student_reviews (course_id, created_at desc)
where course_id is not null;

create index if not exists idx_student_reviews_lecture_created
on public.student_reviews (lecture_id, created_at desc)
where lecture_id is not null;

create or replace function public.prepare_student_review()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_name text;
begin
  if tg_op = 'INSERT' then
    if v_uid is null then
      raise exception 'Authentication required';
    end if;

    if new.user_id is distinct from v_uid and not public.is_admin() then
      raise exception 'You can only submit your own review';
    end if;

    if new.course_id is not null
       and not public.can_access_course(new.course_id)
       and not public.is_admin() then
      raise exception 'Course access is required before reviewing it';
    end if;

    if new.lecture_id is not null
       and not public.can_access_lecture(new.lecture_id)
       and not public.is_admin() then
      raise exception 'Lecture access is required before reviewing it';
    end if;

    select nullif(trim(display_name), '') into v_name
    from public.profiles
    where id = new.user_id;

    new.reviewer_name := coalesce(v_name, 'طالب في المنصة');
    new.comment := trim(new.comment);
    new.is_hidden := false;
  elsif not public.is_admin() then
    if old.user_id is distinct from v_uid then
      raise exception 'You can only edit your own review';
    end if;

    new.user_id := old.user_id;
    new.course_id := old.course_id;
    new.lecture_id := old.lecture_id;
    new.reviewer_name := old.reviewer_name;
    new.is_hidden := old.is_hidden;
    new.comment := trim(new.comment);
  end if;

  return new;
end;
$$;

drop trigger if exists prepare_student_review_trigger on public.student_reviews;
create trigger prepare_student_review_trigger
before insert or update on public.student_reviews
for each row execute function public.prepare_student_review();

drop trigger if exists set_updated_at_student_reviews on public.student_reviews;
create trigger set_updated_at_student_reviews
before update on public.student_reviews
for each row execute function public.set_updated_at();

alter table public.student_reviews enable row level security;

drop policy if exists student_reviews_own_or_admin_read on public.student_reviews;
create policy student_reviews_own_or_admin_read
on public.student_reviews
for select
to authenticated
using (user_id = auth.uid() or public.is_admin());

drop policy if exists student_reviews_insert_own on public.student_reviews;
create policy student_reviews_insert_own
on public.student_reviews
for insert
to authenticated
with check (
  user_id = auth.uid()
  and (
    (course_id is not null and public.can_access_course(course_id))
    or (lecture_id is not null and public.can_access_lecture(lecture_id))
  )
);

drop policy if exists student_reviews_update_own_or_admin on public.student_reviews;
create policy student_reviews_update_own_or_admin
on public.student_reviews
for update
to authenticated
using (user_id = auth.uid() or public.is_admin())
with check (user_id = auth.uid() or public.is_admin());

drop policy if exists student_reviews_delete_own_or_admin on public.student_reviews;
create policy student_reviews_delete_own_or_admin
on public.student_reviews
for delete
to authenticated
using (user_id = auth.uid() or public.is_admin());

create or replace function public.get_student_reviews(
  p_course_id uuid default null,
  p_lecture_id uuid default null
)
returns table (
  id uuid,
  rating smallint,
  comment text,
  reviewer_name text,
  is_hidden boolean,
  created_at timestamptz,
  updated_at timestamptz,
  is_own boolean
)
language sql
stable
security definer
set search_path = public
as $$
  select
    r.id,
    r.rating,
    r.comment,
    r.reviewer_name,
    r.is_hidden,
    r.created_at,
    r.updated_at,
    (r.user_id = auth.uid()) as is_own
  from public.student_reviews r
  where (
    (
      p_course_id is not null
      and p_lecture_id is null
      and r.course_id = p_course_id
      and exists (
        select 1 from public.courses c
        where c.id = p_course_id
          and (c.published = true or public.can_access_course(c.id) or public.is_admin())
      )
    )
    or (
      p_lecture_id is not null
      and p_course_id is null
      and r.lecture_id = p_lecture_id
      and (public.can_access_lecture(p_lecture_id) or public.is_admin())
    )
  )
  and (r.is_hidden = false or r.user_id = auth.uid() or public.is_admin())
  order by r.created_at desc;
$$;

revoke all on function public.get_student_reviews(uuid, uuid) from public;
grant execute on function public.get_student_reviews(uuid, uuid) to anon, authenticated;

revoke all on public.student_reviews from anon;
grant select, insert, update, delete on public.student_reviews to authenticated;

comment on table public.student_reviews is
'One review per student for each course or lecture. Public review reading is exposed through get_student_reviews without user identifiers.';

commit;
