-- =====================================================================
-- TargetScore — leak tracing (content protection phase 3)
-- Watermark codes are the first 40 bits (10 hex characters) of a user id;
-- see src/lib/watermark.ts. This finds the account behind a code.
-- =====================================================================

create or replace function public.admin_find_by_watermark(p_prefix text)
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  if p_prefix !~ '^[0-9a-f]{10}$' then
    raise exception 'BAD_CODE' using errcode = '22023';
  end if;
  return (
    select coalesce(jsonb_agg(jsonb_build_object(
             'id', p.id, 'email', p.email, 'full_name', p.full_name, 'role', p.role,
             'premium', public.has_premium_access(p.id), 'created_at', p.created_at)), '[]')
      from public.profiles p
     where p.id >= (substr(p_prefix, 1, 8) || '-' || substr(p_prefix, 9, 2) || '00-0000-0000-000000000000')::uuid
       and p.id <= (substr(p_prefix, 1, 8) || '-' || substr(p_prefix, 9, 2) || 'ff-ffff-ffff-ffffffffffff')::uuid
  );
end $$;

revoke execute on function public.admin_find_by_watermark(text) from public, anon;
grant execute on function public.admin_find_by_watermark(text) to authenticated;   -- checks is_admin() inside
