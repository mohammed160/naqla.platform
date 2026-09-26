-- Promote an existing account to admin. Replace the email, then run in the Supabase SQL Editor.
-- The account must already exist (sign up on the site, or Authentication > Users > Add user).

update public.profiles
set role = 'admin', is_active = true
where lower(email) = lower('YOUR_EMAIL@example.com');

-- Check: should return exactly your row with role = admin.
select id, email, role, is_active from public.profiles where role = 'admin';
