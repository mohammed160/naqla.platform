-- Allow admins to create portfolio projects on behalf of students.
-- Existing update/delete policies already allow admins to manage all projects.

drop policy if exists projects_insert_admin on public.projects;
create policy projects_insert_admin on public.projects
for insert to authenticated
with check (public.is_admin());
