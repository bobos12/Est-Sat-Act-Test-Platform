-- =====================================================================
-- TargetScore — account sharing (content protection phase 2)
--
-- 1. One active session per account: the app signs other sessions out on
--    every sign-in, and the gate refuses JWTs whose session no longer exists
--    (an access token stays valid for up to an hour after sign-out otherwise).
-- 2. Device (first-party cookie) and location (Vercel IP geo) on the access
--    log, feeding three new risk signals: many devices in 30 days, sign-ins
--    bouncing between devices, and impossible travel.
-- 3. Admin: a student's devices, and "sign out everywhere".
-- =====================================================================

alter table private.access_log
  add column device_id text,
  add column country text,
  add column city text,
  add column lat double precision,
  add column lon double precision;

-- Device and location come only from our server's headers (never on blocked calls).
create or replace function private.log_access(p_action text, p_ref uuid default null, p_items int default null)
returns void language sql security definer set search_path = public, private as $$
  with h as (
    select coalesce(nullif(current_setting('request.headers', true), '')::jsonb, '{}'::jsonb) as j,
           p_action = 'blocked' as blocked
  )
  insert into private.access_log (user_id, action, ref_id, item_count, ip, user_agent, device_id, country, city, lat, lon)
  select auth.uid(), p_action, p_ref, p_items,
         left(case when blocked then btrim(split_part(j ->> 'x-forwarded-for', ',', 1)) else j ->> 'x-ts-client-ip' end, 64),
         left(case when blocked then j ->> 'user-agent' else j ->> 'x-ts-user-agent' end, 300),
         case when not blocked then left(j ->> 'x-ts-device', 64) end,
         case when not blocked then left(j ->> 'x-ts-country', 2) end,
         case when not blocked then left(j ->> 'x-ts-city', 80) end,
         case when not blocked and j ->> 'x-ts-lat' ~ '^-?\d{1,3}(\.\d+)?$' then (j ->> 'x-ts-lat')::double precision end,
         case when not blocked and j ->> 'x-ts-lon' ~ '^-?\d{1,3}(\.\d+)?$' then (j ->> 'x-ts-lon')::double precision end
    from h
   where auth.uid() is not null;
$$;

-- Same gate as phase 1, plus: the caller's session must still exist.
create or replace function private.gate(p_action text, p_ref uuid default null)
returns boolean language plpgsql security definer set search_path = public, private as $$
declare
  h text;
  sid uuid;
begin
  select secret_hash into h from private.server_gate;
  if h is not null
     and encode(sha256(convert_to(private.request_header('x-ts-gate'), 'UTF8')), 'hex') is distinct from h then
    perform private.log_access('blocked', p_ref);
    return false;
  end if;
  sid := nullif(auth.jwt() ->> 'session_id', '')::uuid;
  if sid is not null and not exists (select 1 from auth.sessions where id = sid) then
    raise exception 'SESSION_REVOKED' using errcode = '28000';
  end if;
  return true;
end $$;

-- Recorded by the app right after each sign-in (after it signs the other sessions out).
create function public.record_sign_in()
returns void language plpgsql security definer set search_path = public, private as $$
begin
  if not private.gate('sign_in') then return; end if;
  perform private.log_access('sign_in');
end $$;
revoke execute on function public.record_sign_in() from public, anon;
grant execute on function public.record_sign_in() to authenticated;

-- Great-circle distance in km.
create or replace function private.km(lat1 double precision, lon1 double precision, lat2 double precision, lon2 double precision)
returns double precision language sql immutable as $$
  select 2 * 6371 * asin(least(1, sqrt(power(sin(radians(lat2 - lat1) / 2), 2)
                                    + cos(radians(lat1)) * cos(radians(lat2)) * power(sin(radians(lon2 - lon1) / 2), 2))))
$$;

create or replace function private.risk_signals(p_uid uuid)
returns jsonb language sql stable security definer set search_path = public, private as $$
  with att as (
    select count(*) filter (where started_at > now() - interval '24 hours') as attempts_24h,
           count(*) filter (where status <> 'in_progress' and coalesce(question_count, 0) > 0
                              and coalesce(answered_count, 0) < 0.2 * question_count) as rushed_7d
      from public.exam_attempts
     where user_id = p_uid and started_at > now() - interval '7 days'
  ), lg as (
    select coalesce(sum(item_count) filter (where action = 'practice_create' and created_at > now() - interval '24 hours'), 0) as practice_24h,
           count(distinct ip) filter (where action <> 'blocked' and created_at > now() - interval '24 hours') as ips_24h,
           count(*) filter (where action = 'blocked' and created_at > now() - interval '7 days') as blocked_7d,
           count(distinct device_id) filter (where action <> 'blocked') as devices_30d,
           count(distinct device_id) filter (where action = 'sign_in' and created_at > now() - interval '24 hours') as signin_devices_24h,
           max(created_at) as last_seen
      from private.access_log
     where user_id = p_uid and created_at > now() - interval '30 days'
  ), tr as (
    -- consecutive located events further apart than 300 km at over 800 km/h
    select count(*) as travel_7d
      from (select lat, lon, created_at,
                   lag(lat) over w as plat, lag(lon) over w as plon, lag(created_at) over w as pt
              from private.access_log
             where user_id = p_uid and created_at > now() - interval '7 days'
               and action <> 'blocked' and lat is not null and lon is not null
            window w as (order by created_at)) x
     where plat is not null
       and private.km(plat, plon, lat, lon) > 300
       and private.km(plat, plon, lat, lon) / greatest(extract(epoch from created_at - pt) / 3600.0, 0.01) > 800
  ), pr as (
    select coalesce(sum(cardinality(s.question_ids)), 0) as finished,
           coalesce(sum(cardinality(s.question_ids)
                        - (select count(*) from public.practice_answers pa where pa.session_id = s.id)), 0) as skipped
      from public.practice_sessions s
     where s.user_id = p_uid and s.completed_at is not null and s.created_at > now() - interval '7 days'
  )
  select jsonb_build_object(
           'attempts_24h', att.attempts_24h, 'rushed_7d', att.rushed_7d,
           'practice_24h', lg.practice_24h, 'ips_24h', lg.ips_24h, 'blocked_7d', lg.blocked_7d,
           'practice_finished_7d', pr.finished, 'practice_skipped_7d', pr.skipped,
           'devices_30d', lg.devices_30d, 'signin_devices_24h', lg.signin_devices_24h, 'travel_7d', tr.travel_7d,
           'last_seen', lg.last_seen)
    from att, lg, tr, pr
$$;

create or replace function private.risk_score(s jsonb)
returns int language sql stable security definer set search_path = public, private as $$
  select least(100,
      case when (s ->> 'blocked_7d')::int > 0 then 100 else 0 end
    + least((s ->> 'rushed_7d')::int * 15, 45)
    + case when (s ->> 'practice_finished_7d')::int >= 100
            and (s ->> 'practice_skipped_7d')::int >= 0.8 * (s ->> 'practice_finished_7d')::int then 30 else 0 end
    + case when (s ->> 'ips_24h')::int >= 8 then 40 when (s ->> 'ips_24h')::int >= 4 then 20 else 0 end
    + case when (s ->> 'attempts_24h')::int >= private.protection_setting('max_new_attempts_per_day', 8) then 15 else 0 end
    + case when (s ->> 'practice_24h')::int >= private.protection_setting('max_practice_questions_per_day', 400) then 15 else 0 end
    + case when coalesce((s ->> 'devices_30d')::int, 0) >= 6 then 40 when coalesce((s ->> 'devices_30d')::int, 0) >= 4 then 20 else 0 end
    + case when coalesce((s ->> 'signin_devices_24h')::int, 0) >= 3 then 20 else 0 end
    + least(coalesce((s ->> 'travel_7d')::int, 0) * 30, 60)
  )
$$;

-- ---------------------------------------------------------------------
-- Admin
-- ---------------------------------------------------------------------
create or replace function public.admin_user_security(p_user uuid)
returns jsonb language plpgsql stable security definer set search_path = public, private as $$
declare
  sig jsonb;
begin
  if not public.is_admin() then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  sig := private.risk_signals(p_user);
  return jsonb_build_object(
    'score', private.risk_score(sig),
    'signals', sig,
    'active_sessions', (select count(*) from auth.sessions where user_id = p_user),
    'devices', (
      select coalesce(jsonb_agg(to_jsonb(d) order by d.last_seen desc), '[]')
        from (
          select l.device_id,
                 min(l.created_at) as first_seen,
                 max(l.created_at) as last_seen,
                 count(*) filter (where l.action = 'sign_in') as sign_ins,
                 (array_agg(l.ip order by l.created_at desc))[1] as ip,
                 (array_agg(l.user_agent order by l.created_at desc))[1] as user_agent,
                 (array_agg(concat_ws(', ', nullif(l.city, ''), nullif(l.country, '')) order by l.created_at desc))[1] as place
            from private.access_log l
           where l.user_id = p_user and l.action <> 'blocked' and l.device_id is not null
             and l.created_at > now() - interval '30 days'
           group by l.device_id
           order by max(l.created_at) desc
           limit 20
        ) d));
end $$;

create or replace function public.admin_revoke_sessions(p_user uuid)
returns int language plpgsql security definer set search_path = public, private as $$
declare
  n int;
begin
  if not public.is_admin() then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  delete from auth.sessions where user_id = p_user;    -- refresh tokens cascade
  get diagnostics n = row_count;
  perform public.write_audit('sessions.revoke', 'profile', p_user::text, jsonb_build_object('sessions', n));
  return n;
end $$;

revoke execute on function public.admin_user_security(uuid) from public, anon;
revoke execute on function public.admin_revoke_sessions(uuid) from public, anon;
grant execute on function public.admin_user_security(uuid) to authenticated;    -- checks is_admin() inside
grant execute on function public.admin_revoke_sessions(uuid) to authenticated;

revoke execute on all functions in schema private from public, anon, authenticated;
