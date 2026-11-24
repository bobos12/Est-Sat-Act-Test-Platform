-- =====================================================================
-- TargetScore — admin hardening (content protection phase 5)
--
-- 1. Admin rights need 2-step verification: a login that has not passed
--    TOTP (aal1) is treated as a normal student by every RLS policy and
--    admin function, so a stolen admin password alone can't read the bank.
--    Requests without an aal claim (SQL editor, migrations, service tasks)
--    are unchanged.
-- 2. Admin sign-in history for /admin/security.
-- =====================================================================

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
     and coalesce(auth.jwt() ->> 'aal', 'aal2') = 'aal2';
$$;

create or replace function public.admin_recent_sign_ins(p_limit int default 20)
returns jsonb language plpgsql stable security definer set search_path = public, private as $$
begin
  if not public.is_admin() then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  return (
    select coalesce(jsonb_agg(to_jsonb(t) order by t.created_at desc), '[]')
      from (
        select l.created_at, p.email, p.full_name, l.ip, l.user_agent, l.device_id,
               concat_ws(', ', nullif(l.city, ''), nullif(l.country, '')) as place
          from private.access_log l
          join public.profiles p on p.id = l.user_id and p.role = 'admin'
         where l.action = 'sign_in' and l.created_at > now() - interval '30 days'
         order by l.created_at desc
         limit greatest(1, least(coalesce(p_limit, 20), 100))
      ) t
  );
end $$;

revoke execute on function public.admin_recent_sign_ins(int) from public, anon;
grant execute on function public.admin_recent_sign_ins(int) to authenticated;   -- checks is_admin() inside
