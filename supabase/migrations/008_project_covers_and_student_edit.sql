-- Dedicated project covers + safe student editing workflow.
-- Student edits are always returned to pending review; only admins can approve/publish.

begin;

alter table public.projects
  add column if not exists cover_path text,
  add column if not exists cover_url text;

-- Existing projects keep using their first image as the visual fallback until a dedicated cover is uploaded.
update public.projects
set cover_path = coalesce(nullif(cover_path, ''), nullif(image_path, '')),
    cover_url = coalesce(nullif(cover_url, ''), nullif(image_url, ''))
where nullif(cover_path, '') is null;

create or replace function public.enforce_student_project_review_state()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
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

drop trigger if exists enforce_student_project_review_state_trigger on public.projects;
create trigger enforce_student_project_review_state_trigger
before update on public.projects
for each row execute function public.enforce_student_project_review_state();

-- Students can revise any of their own projects; the trigger above forces re-review.
drop policy if exists projects_update_own_pending_or_admin on public.projects;
drop policy if exists projects_update_own_or_admin on public.projects;
create policy projects_update_own_or_admin on public.projects
for update to authenticated
using (user_id = auth.uid() or public.is_admin())
with check (user_id = auth.uid() or public.is_admin());

-- Approved public projects can read every internal image and any legacy/private cover.
drop policy if exists hunda_student_projects_read on storage.objects;
create policy hunda_student_projects_read on storage.objects
for select to anon, authenticated
using (
  bucket_id = 'student-projects'
  and (
    (storage.foldername(name))[1] = auth.uid()::text
    or public.is_admin()
    or exists (
      select 1
      from public.projects p
      where p.status = 'approved'
        and (
          p.image_path = name
          or p.cover_path = name
          or name = any(coalesce(p.image_paths, '{}'::text[]))
        )
    )
  )
);

-- Students may upload only their own public project covers.
drop policy if exists hunda_project_covers_upload_own on storage.objects;
create policy hunda_project_covers_upload_own on storage.objects
for insert to authenticated
with check (
  bucket_id = 'public-assets'
  and (storage.foldername(name))[1] = 'project-covers'
  and (storage.foldername(name))[2] = auth.uid()::text
);

-- A student cannot directly remove media from a currently-approved project.
-- The UI updates the project first (trigger => pending), then deletes removed files safely.
drop policy if exists hunda_student_projects_delete_own on storage.objects;
create policy hunda_student_projects_delete_own on storage.objects
for delete to authenticated
using (
  bucket_id = 'student-projects'
  and (
    public.is_admin()
    or (
      (storage.foldername(name))[1] = auth.uid()::text
      and not exists (
        select 1
        from public.projects p
        where p.user_id = auth.uid()
          and p.status = 'approved'
          and (
            p.image_path = name
            or p.cover_path = name
            or name = any(coalesce(p.image_paths, '{}'::text[]))
          )
      )
    )
  )
);

drop policy if exists hunda_project_covers_delete_own on storage.objects;
create policy hunda_project_covers_delete_own on storage.objects
for delete to authenticated
using (
  bucket_id = 'public-assets'
  and (
    public.is_admin()
    or (
      (storage.foldername(name))[1] = 'project-covers'
      and (storage.foldername(name))[2] = auth.uid()::text
      and not exists (
        select 1
        from public.projects p
        where p.user_id = auth.uid()
          and p.status = 'approved'
          and p.cover_path = name
      )
    )
  )
);

commit;
