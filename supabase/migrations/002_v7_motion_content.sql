-- Hunda Design V7 — animated branding and public hero video support
-- Run once in Supabase Dashboard > SQL Editor after 001_initial_schema.sql.

begin;

update storage.buckets
set
  file_size_limit = 52428800,
  allowed_mime_types = array[
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/gif',
    'image/svg+xml',
    'video/mp4',
    'video/webm',
    'application/json'
  ]
where id = 'public-assets';

-- The settings column is JSONB, so V7 fields do not require table alterations.
-- Existing settings remain untouched and are merged with application defaults.


create or replace function public.admin_review_payment(
  p_payment_id uuid,
  p_action text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_payment public.payments%rowtype;
begin
  if not public.is_admin() then
    raise exception 'Admin permission required';
  end if;

  if p_action not in ('approve', 'reject') then
    raise exception 'Invalid action';
  end if;

  select * into v_payment
  from public.payments
  where id = p_payment_id
  for update;

  if not found then
    raise exception 'Payment not found';
  end if;

  if p_action = 'approve' then
    update public.payments
    set status = 'paid', paid_at = coalesce(paid_at, now()), updated_at = now()
    where id = p_payment_id;

    insert into public.enrollments (user_id, course_id, source, payment_id, active)
    values (v_payment.user_id, v_payment.course_id, 'payment', v_payment.id, true)
    on conflict (user_id, course_id)
    do update set active = true, source = 'payment', payment_id = excluded.payment_id, updated_at = now();
  else
    update public.payments
    set status = 'failed', updated_at = now()
    where id = p_payment_id;
  end if;

  return jsonb_build_object('success', true, 'status', case when p_action = 'approve' then 'paid' else 'failed' end);
end;
$$;

revoke all on function public.admin_review_payment(uuid, text) from public;
grant execute on function public.admin_review_payment(uuid, text) to authenticated;

commit;
