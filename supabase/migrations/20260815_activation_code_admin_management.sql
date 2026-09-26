-- Design Tips — persistent admin-visible activation codes
-- New activation codes keep their plaintext value for admins only.
-- Existing codes created before this migration cannot be recovered from their hashes.

begin;

alter table public.activation_codes
  add column if not exists code_value text;

comment on column public.activation_codes.code_value is
  'Plain activation code retained for admin-only management. Protected by activation_codes_admin_only RLS policy.';

-- Drop first: later migrations change the parameter defaults, which CREATE OR REPLACE cannot undo.
drop function if exists public.generate_activation_codes(uuid, integer, timestamptz);
create or replace function public.generate_activation_codes(
  p_course_id uuid,
  p_quantity integer default 1,
  p_expires_at timestamptz default null
)
returns table (id uuid, code text, code_preview text)
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  i integer;
  v_code text;
  v_hash text;
  v_id uuid;
  v_preview text;
begin
  if not public.is_admin() then
    raise exception 'Admin permission required';
  end if;

  if p_quantity < 1 or p_quantity > 500 then
    raise exception 'Quantity must be between 1 and 500';
  end if;

  if not exists (select 1 from public.courses where courses.id = p_course_id) then
    raise exception 'Course not found';
  end if;

  for i in 1..p_quantity loop
    loop
      v_code := 'HD-' || upper(substr(encode(gen_random_bytes(4), 'hex'), 1, 4)) || '-' || upper(substr(encode(gen_random_bytes(4), 'hex'), 1, 4));
      v_hash := encode(digest(public.normalize_activation_code(v_code), 'sha256'), 'hex');
      v_preview := 'HD-****-' || right(v_code, 4);

      begin
        insert into public.activation_codes (
          course_id,
          code_hash,
          code_preview,
          code_value,
          expires_at,
          created_by
        )
        values (
          p_course_id,
          v_hash,
          v_preview,
          v_code,
          p_expires_at,
          auth.uid()
        )
        returning activation_codes.id into v_id;
        exit;
      exception when unique_violation then
        -- Extremely unlikely; generate another random code.
      end;
    end loop;

    id := v_id;
    code := v_code;
    code_preview := v_preview;
    return next;
  end loop;
end;
$$;

revoke all on function public.generate_activation_codes(uuid, integer, timestamptz) from public;
grant execute on function public.generate_activation_codes(uuid, integer, timestamptz) to authenticated;

commit;
