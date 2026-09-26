-- Hunda Design V7 Complete — compatibility and media fixes (corrected)
begin;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'public-media',
  'public-media',
  true,
  262144000,
  array[
    'image/gif',
    'image/webp',
    'image/svg+xml',
    'video/webm',
    'video/mp4',
    'video/quicktime'
  ]
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

update public.site_settings
set settings = jsonb_set(
  settings,
  '{paymentMethods}',
  coalesce(
    settings->'paymentMethods',
    '{"paymob":false,"fawry":false,"paypal":false,"trc20":false}'::jsonb
  ),
  true
)
where id = 'public';

-- The frontend calls admin_set_payment_status.
-- Reuse the payment review logic created by migration 002.
create or replace function public.admin_set_payment_status(
  p_payment_id uuid,
  p_action text
)
returns jsonb
language sql
security definer
set search_path = public
as $$
  select public.admin_review_payment(p_payment_id, p_action);
$$;

revoke all on function public.admin_set_payment_status(uuid, text) from public;
grant execute on function public.admin_set_payment_status(uuid, text) to authenticated;

commit;
