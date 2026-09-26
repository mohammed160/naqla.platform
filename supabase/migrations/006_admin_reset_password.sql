-- Design Tips / Hunda Design — Admin User Management (Reset Password & Delete User)
-- Allows authenticated admins to:
-- 1. Reset/set password directly for any student
-- 2. Delete student account and clean up related records

begin;

-- Function: Reset Student Password
create or replace function public.admin_reset_user_password(
  target_user_id uuid,
  new_password text
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth, extensions, pg_temp
as $$
declare
  caller_is_admin boolean;
begin
  caller_is_admin := public.is_admin();
  
  if not caller_is_admin then
    return jsonb_build_object('success', false, 'error', 'غير مصرح: هذه العملية مخصصة للمشرفين فقط.');
  end if;

  if target_user_id is null then
    return jsonb_build_object('success', false, 'error', 'معرف المستخدم غير صحيح.');
  end if;

  if new_password is null or length(trim(new_password)) < 6 then
    return jsonb_build_object('success', false, 'error', 'كلمة المرور يجب أن لا تقل عن 6 أحرف.');
  end if;

  update auth.users
  set encrypted_password = extensions.crypt(new_password, extensions.gen_salt('bf')),
      updated_at = now()
  where id = target_user_id;

  if not found then
    return jsonb_build_object('success', false, 'error', 'المستخدم غير موجود في سجلات الحسابات.');
  end if;

  return jsonb_build_object('success', true, 'message', 'تم تحديث كلمة المرور بنجاح.');
end;
$$;

-- Function: Delete Student Account
create or replace function public.admin_delete_user(
  target_user_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth, extensions, pg_temp
as $$
declare
  caller_is_admin boolean;
  target_role text;
begin
  caller_is_admin := public.is_admin();
  if not caller_is_admin then
    return jsonb_build_object('success', false, 'error', 'غير مصرح: هذه العملية مخصصة للمشرفين فقط.');
  end if;

  if target_user_id is null or target_user_id = auth.uid() then
    return jsonb_build_object('success', false, 'error', 'لا يمكنك حذف حسابك الإداري الحالي.');
  end if;

  select role into target_role from public.profiles where id = target_user_id;
  if target_role = 'admin' then
    return jsonb_build_object('success', false, 'error', 'لا يمكن حذف حساب الأدمن من شاشة الطلاب.');
  end if;

  -- Delete from auth.users (cascades to profiles, enrollments, reviews, etc.)
  delete from auth.users where id = target_user_id;

  return jsonb_build_object('success', true, 'message', 'تم حذف حساب الطالب بنجاح.');
end;
$$;

revoke all on function public.admin_reset_user_password(uuid, text) from public;
grant execute on function public.admin_reset_user_password(uuid, text) to authenticated;

revoke all on function public.admin_delete_user(uuid) from public;
grant execute on function public.admin_delete_user(uuid) to authenticated;

commit;
