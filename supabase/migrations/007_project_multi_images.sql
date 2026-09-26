-- Multiple images for student projects while keeping legacy single-image columns compatible.

alter table public.projects
  add column if not exists image_paths text[] not null default '{}'::text[],
  add column if not exists image_urls text[] not null default '{}'::text[];

-- Backfill existing projects so old records continue to work with the new UI.
update public.projects
set image_paths = case
      when coalesce(array_length(image_paths, 1), 0) = 0 and nullif(image_path, '') is not null
        then array[image_path]
      else image_paths
    end,
    image_urls = case
      when coalesce(array_length(image_urls, 1), 0) = 0 and nullif(image_url, '') is not null
        then array[image_url]
      else image_urls
    end;

-- Approved public projects must expose every stored project image, not just the legacy cover image.
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
          or name = any(coalesce(p.image_paths, '{}'::text[]))
        )
    )
  )
);
