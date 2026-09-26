-- Design Tips — reliable and idempotent activation-code redemption
-- Fixes:
-- 1) A retry by the same student after a successful redemption returns success.
-- 2) Used codes are reported as used instead of the misleading "disabled" message.
-- 3) The function still requires a real authenticated Supabase session.

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
  v_already_enrolled boolean := false;
begin
  if v_user is null then
    raise exception 'Authentication required';
  end if;

  if nullif(trim(coalesce(p_code, '')), '') is null then
    raise exception 'Invalid activation code';
  end if;

  v_hash := encode(
    digest(public.normalize_activation_code(p_code), 'sha256'),
    'hex'
  );

  select * into v_code
  from public.activation_codes
  where code_hash = v_hash
  for update;

  if not found then
    raise exception 'Invalid activation code';
  end if;

  select * into v_course
  from public.courses
  where id = v_code.course_id;

  if not found or not v_course.published then
    raise exception 'Course is not available';
  end if;

  select exists (
    select 1
    from public.enrollments
    where user_id = v_user
      and course_id = v_code.course_id
      and active = true
  ) into v_already_enrolled;

  -- A mobile/network retry can reach the server after the first redemption
  -- already succeeded. Return success for the same owner instead of an error.
  if v_code.used_at is not null then
    if v_code.used_by = v_user and v_already_enrolled then
      return jsonb_build_object(
        'success', true,
        'course_id', v_course.id,
        'course_title', v_course.title,
        'already_enrolled', true,
        'retried', true
      );
    end if;

    raise exception 'Activation code was already used';
  end if;

  -- A disabled unused code was intentionally stopped by the administration.
  if not v_code.is_active then
    raise exception 'Activation code is disabled';
  end if;

  if v_code.expires_at is not null and v_code.expires_at <= now() then
    raise exception 'Activation code has expired';
  end if;

  insert into public.enrollments (
    user_id,
    course_id,
    source,
    activation_code_id,
    active
  )
  values (
    v_user,
    v_code.course_id,
    'activation_code',
    v_code.id,
    true
  )
  on conflict (user_id, course_id)
  do update set
    active = true,
    source = 'activation_code',
    activation_code_id = excluded.activation_code_id,
    updated_at = now();

  update public.activation_codes
  set
    used_by = v_user,
    used_at = now(),
    is_active = false
  where activation_codes.id = v_code.id;

  return jsonb_build_object(
    'success', true,
    'course_id', v_course.id,
    'course_title', v_course.title,
    'already_enrolled', v_already_enrolled,
    'retried', false
  );
end;
$$;

revoke all on function public.redeem_activation_code(text) from public;
grant execute on function public.redeem_activation_code(text) to authenticated;
