-- =====================================================================
-- TargetScore — admins signed in from an email link open the dashboard
--
-- Admin rights still need more than a password: either the authenticator
-- code (aal2) or a session opened from an email sign-in link (amr "otp" /
-- "magiclink"), which proves control of the admin's inbox. A password-only
-- or Google sign-in still needs the authenticator code.
-- Requests without an aal claim (SQL editor, migrations, service tasks)
-- are unchanged.
-- =====================================================================

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
     and (
       coalesce(auth.jwt() ->> 'aal', 'aal2') = 'aal2'
       or exists (
         select 1 from jsonb_array_elements(coalesce(auth.jwt() -> 'amr', '[]'::jsonb)) e
          where e ->> 'method' in ('otp', 'magiclink')
       )
     );
$$;
