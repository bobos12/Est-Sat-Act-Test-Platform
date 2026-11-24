-- Admin hardening: admin rights need a 2-step (aal2) session.
-- Run after supabase_stubs.sql + migrations (run.sh does). Everything is rolled back.
\set ON_ERROR_STOP 1
begin;

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-00000000000a', 'admin@test.local', '{}'),
  ('00000000-0000-0000-0000-00000000000c', 'student@test.local', '{}');
update profiles set role = 'admin' where id = '00000000-0000-0000-0000-00000000000a';
insert into questions (subject_id, origin, status) select id, 'manual', 'approved' from subjects where code = 'est1-math';
insert into private.access_log (user_id, action, ip, city, country) values
  ('00000000-0000-0000-0000-00000000000a', 'sign_in', '203.0.113.1', 'Cairo', 'EG'),
  ('00000000-0000-0000-0000-00000000000c', 'sign_in', '203.0.113.2', 'Giza', 'EG');

create or replace function pg_temp.act_as(uid text, aal text) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', uid, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  perform set_config('request.jwt.claims',
    case when aal is null then '{}' else json_build_object('sub', uid, 'aal', aal)::text end, true);
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

set local role authenticated;

-- Password only (aal1): treated like a student
select pg_temp.act_as('00000000-0000-0000-0000-00000000000a', 'aal1');
select 'aal1 admin is not admin' as check, not is_admin() as pass;
select 'aal1 admin cannot read the bank' as check, count(*) = 0 as pass from questions;
select 'aal1 admin cannot read answer keys' as check, count(*) = 0 as pass from question_options;
select pg_temp.expect_error($$select admin_risk_overview()$$, 'FORBIDDEN');
select pg_temp.expect_error($$select admin_recent_sign_ins()$$, 'FORBIDDEN');
select pg_temp.expect_error($$select admin_find_by_watermark('abcdef1234')$$, 'FORBIDDEN');
select pg_temp.expect_error($$select admin_grant_access('00000000-0000-0000-0000-00000000000a', 30, 'self')$$, 'Not authorized');
select pg_temp.expect_error($$update profiles set role = 'admin' where id = '00000000-0000-0000-0000-00000000000c'$$, 'Only administrators');

-- After 2-step (aal2): full admin
select pg_temp.act_as('00000000-0000-0000-0000-00000000000a', 'aal2');
select 'aal2 admin is admin' as check, is_admin() as pass;
select 'aal2 admin reads the bank' as check, count(*) = 1 as pass from questions;
select 'admin sign-ins list admins only' as check,
       jsonb_array_length(admin_recent_sign_ins()) = 1 and admin_recent_sign_ins() -> 0 ->> 'place' = 'Cairo, EG' as pass;

-- Leak tracing: a code's 10 hex characters find exactly that account
reset role;
insert into auth.users (id, email) values
  ('abcdef12-3400-4000-8000-000000000001', 'leaker@test.local'),
  ('abcdef12-3500-4000-8000-000000000001', 'neighbour@test.local');
set local role authenticated;
select 'trace finds the leaker only' as check,
       jsonb_array_length(r) = 1 and r -> 0 ->> 'email' = 'leaker@test.local' as pass
  from (select admin_find_by_watermark('abcdef1234') as r) x;
select 'unknown code finds nobody' as check, jsonb_array_length(admin_find_by_watermark('ffffffffff')) = 0 as pass;
select pg_temp.expect_error($$select admin_find_by_watermark('not-a-code')$$, 'BAD_CODE');

-- Students never become admins, whatever their level
select pg_temp.act_as('00000000-0000-0000-0000-00000000000c', 'aal2');
select 'aal2 student is not admin' as check, not is_admin() as pass;

-- No aal claim (SQL editor, service tasks): unchanged behaviour
select pg_temp.act_as('00000000-0000-0000-0000-00000000000a', null);
select 'no aal claim keeps admin' as check, is_admin() as pass;

rollback;
