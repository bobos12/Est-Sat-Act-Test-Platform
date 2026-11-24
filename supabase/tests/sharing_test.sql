-- Account sharing: single session, device/geo logging, sharing signals, admin tools.
-- Run after supabase_stubs.sql + migrations (run.sh does). Everything is rolled back.
\set ON_ERROR_STOP 1
begin;

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-00000000000a', 'admin@test.local', '{}'),
  ('00000000-0000-0000-0000-00000000000b', 'sharer@test.local', '{}'),
  ('00000000-0000-0000-0000-00000000000c', 'student@test.local', '{}');
update profiles set role = 'admin' where id = '00000000-0000-0000-0000-00000000000a';
insert into auth.sessions (id, user_id) values
  ('a0000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000000a'),
  ('c0000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000000c'),
  ('b0000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000000b'),
  ('b0000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-00000000000b');
select private.set_server_gate('s3cret');

create or replace function pg_temp.act_as(uid text, sid text) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', uid, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  perform set_config('request.jwt.claims',
    case when sid is null then '{}' else json_build_object('sub', uid, 'session_id', sid)::text end, true);
end $$;

create or replace function pg_temp.via_server(device text, lat text, lon text) returns void language plpgsql as $$
begin
  perform set_config('request.headers', json_build_object(
    'x-ts-gate', 's3cret', 'x-ts-client-ip', '203.0.113.7', 'x-ts-user-agent', 'Mozilla/5.0 (Windows NT 10.0) Chrome/130',
    'x-ts-device', device, 'x-ts-country', 'EG', 'x-ts-city', 'Cairo', 'x-ts-lat', lat, 'x-ts-lon', lon)::text, true);
end $$;

create or replace function pg_temp.expect_error(sql text, needle text) returns text language plpgsql as $$
begin
  execute sql;
  raise exception 'EXPECTED ERROR "%" BUT STATEMENT SUCCEEDED: %', needle, sql;
exception when others then
  if position(needle in sqlerrm) = 0 then
    raise exception 'EXPECTED "%" GOT "%"', needle, sqlerrm;
  end if;
  return 'ok: ' || needle;
end $$;

-- ---------------- Sign-in is logged with device and location ----------------
select pg_temp.act_as('00000000-0000-0000-0000-00000000000c', 'c0000000-0000-0000-0000-000000000001');
select pg_temp.via_server('d1111111-1111-1111-1111-111111111111', '30.0444', '31.2357');
set local role authenticated;
select record_sign_in();
select 'live session can read' as check, bank_overview() is not null as pass;
reset role;
select 'sign-in logged with device and geo' as check,
       count(*) = 1 and bool_and(device_id = 'd1111111-1111-1111-1111-111111111111' and country = 'EG' and city = 'Cairo' and round(lat) = 30) as pass
  from private.access_log where user_id = '00000000-0000-0000-0000-00000000000c' and action = 'sign_in';

-- ---------------- A signed-out session loses access at once ----------------
delete from auth.sessions where id = 'c0000000-0000-0000-0000-000000000001';   -- what signOut({scope:'others'}) does
select pg_temp.act_as('00000000-0000-0000-0000-00000000000c', 'c0000000-0000-0000-0000-000000000001');
set local role authenticated;
select pg_temp.expect_error($$select bank_overview()$$, 'SESSION_REVOKED');
select pg_temp.expect_error($$select start_attempt('20000000-0000-0000-0000-000000000001')$$, 'SESSION_REVOKED');
select pg_temp.expect_error($$select record_sign_in()$$, 'SESSION_REVOKED');
-- a token without a session id (service tasks) is not affected
select pg_temp.act_as('00000000-0000-0000-0000-00000000000c', null);
select 'token without session id passes' as check, bank_overview() is not null as pass;

reset role;
select 'one-device student not flagged' as check, private.risk_score(private.risk_signals('00000000-0000-0000-0000-00000000000c')) < 60 as pass;
-- ---------------- Blocked calls never trust device/geo headers ----------------
select pg_temp.act_as('00000000-0000-0000-0000-00000000000c', null);
set local role authenticated;
select from set_config('request.headers', '{"x-ts-device":"forged","x-ts-lat":"51.5","x-ts-lon":"-0.12","x-forwarded-for":"198.51.100.9"}', true);
select 'blocked call returns nothing' as check, bank_overview() is null as pass;
reset role;
select 'blocked row has no device or geo' as check, device_id is null and lat is null and ip = '198.51.100.9' as pass
  from private.access_log where user_id = '00000000-0000-0000-0000-00000000000c' and action = 'blocked';

-- ---------------- Sharing signals (sharer b) ----------------
insert into private.access_log (user_id, action, device_id, lat, lon, created_at) values
  -- 4 devices this month, 3 of them signing in today
  ('00000000-0000-0000-0000-00000000000b', 'sign_in', 'dev-1', 30.0444, 31.2357, now() - interval '20 days'),
  ('00000000-0000-0000-0000-00000000000b', 'sign_in', 'dev-2', 30.0444, 31.2357, now() - interval '5 hours'),
  ('00000000-0000-0000-0000-00000000000b', 'sign_in', 'dev-3', 31.2001, 29.9187, now() - interval '3 hours'),   -- Alexandria, 2 h later: fine
  ('00000000-0000-0000-0000-00000000000b', 'sign_in', 'dev-4', 51.5072, -0.1276, now() - interval '170 minutes'); -- London 10 min later: impossible
select 'devices counted' as check, (private.risk_signals('00000000-0000-0000-0000-00000000000b') ->> 'devices_30d')::int = 4 as pass;
select 'sign-in devices today' as check, (private.risk_signals('00000000-0000-0000-0000-00000000000b') ->> 'signin_devices_24h')::int = 3 as pass;
select 'one impossible jump' as check, (private.risk_signals('00000000-0000-0000-0000-00000000000b') ->> 'travel_7d')::int = 1 as pass;
select 'sharer flagged' as check, private.risk_score(private.risk_signals('00000000-0000-0000-0000-00000000000b')) = 70 as pass;   -- 20 + 20 + 30
select 'Cairo to London is about 3,500 km' as check, private.km(30.0444, 31.2357, 51.5072, -0.1276) between 3400 and 3600 as pass;

-- ---------------- Admin tools ----------------
select pg_temp.act_as('00000000-0000-0000-0000-00000000000b', 'b0000000-0000-0000-0000-000000000001');
select pg_temp.via_server('dev-4', '51.5072', '-0.1276');
set local role authenticated;
select pg_temp.expect_error($$select admin_user_security('00000000-0000-0000-0000-00000000000b')$$, 'FORBIDDEN');
select pg_temp.expect_error($$select admin_revoke_sessions('00000000-0000-0000-0000-00000000000c')$$, 'FORBIDDEN');

select pg_temp.act_as('00000000-0000-0000-0000-00000000000a', 'a0000000-0000-0000-0000-000000000001');
select 'admin sees devices and sessions' as check,
       jsonb_array_length(s -> 'devices') = 4 and (s ->> 'active_sessions')::int = 2 and (s ->> 'score')::int = 70 as pass
  from (select admin_user_security('00000000-0000-0000-0000-00000000000b') as s) x;
select 'sign out everywhere' as check, admin_revoke_sessions('00000000-0000-0000-0000-00000000000b') = 2 as pass;
reset role;
select 'revoke is audited' as check, count(*) = 1 as pass from admin_audit_log
 where action = 'sessions.revoke' and target_id = '00000000-0000-0000-0000-00000000000b';
select pg_temp.act_as('00000000-0000-0000-0000-00000000000b', 'b0000000-0000-0000-0000-000000000002');
set local role authenticated;
select pg_temp.expect_error($$select bank_overview()$$, 'SESSION_REVOKED');

rollback;
