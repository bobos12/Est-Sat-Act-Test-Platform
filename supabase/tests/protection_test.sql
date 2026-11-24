-- Content protection: server gate, daily limits, risk score, private media.
-- Run after supabase_stubs.sql + migrations (run.sh does). Everything is rolled back.
\set ON_ERROR_STOP 1
begin;

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-00000000000a', 'admin@test.local', '{"full_name":"Admin"}'),
  ('00000000-0000-0000-0000-00000000000b', 'scraper@test.local', '{}'),
  ('00000000-0000-0000-0000-00000000000c', 'student@test.local', '{}');
update profiles set role = 'admin' where id = '00000000-0000-0000-0000-00000000000a';

create or replace function pg_temp.act_as(uid text, r text) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', uid, true);
  perform set_config('request.jwt.claim.role', r, true);
end $$;

create or replace function pg_temp.via_server(on_ boolean) returns void language plpgsql as $$
begin
  perform set_config('request.headers',
    case when on_ then '{"x-ts-gate":"s3cret","x-ts-client-ip":"203.0.113.7","x-ts-user-agent":"test"}'
         else '{"x-forwarded-for":"198.51.100.9"}' end, true);
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

-- ---------------- Content: 3 free exams sharing 3 questions ----------------
insert into questions (id, subject_id, topic_id, origin, status, stem)
select ('10000000-0000-0000-0000-00000000000' || n)::uuid, s.id, t.id, 'manual', 'approved',
       jsonb_build_object('blocks', jsonb_build_array(jsonb_build_object('type','paragraph','text','Q'||n)))
  from generate_series(1,3) n, subjects s join topics t on t.subject_id = s.id and t.name = 'Foundational Algebra'
 where s.code = 'est1-math';
insert into question_options (question_id, label, is_correct)
select q.id, l, l = 'B' from questions q, unnest(array['A','B','C','D']) l;
insert into exams (id, subject_id, slug, title, access, duration_minutes)
select ('20000000-0000-0000-0000-00000000000' || n)::uuid, s.id, 'free-' || n, 'Free ' || n, 'free', 20
  from generate_series(1,3) n, subjects s where s.code = 'est1-math';
insert into exam_sections (id, exam_id, position, title)
select ('30000000-0000-0000-0000-00000000000' || n)::uuid, ('20000000-0000-0000-0000-00000000000' || n)::uuid, 1, 'S'
  from generate_series(1,3) n;
insert into exam_questions (exam_id, section_id, question_id, position)
select ('20000000-0000-0000-0000-00000000000' || n)::uuid, ('30000000-0000-0000-0000-00000000000' || n)::uuid, q.id,
       row_number() over (partition by n order by q.id)
  from generate_series(1,3) n, questions q;
update exams set status = 'published';
update app_settings set value = '{"max_new_attempts_per_day": 2, "max_practice_questions_per_day": 3, "flag_score": 60}'
 where key = 'content_protection';

-- ---------------- Gate open until configured ----------------
select pg_temp.act_as('00000000-0000-0000-0000-00000000000c', 'authenticated');
set local role authenticated;
select 'gate open before configured' as check, bank_overview() is not null as pass;
reset role;
select private.set_server_gate('s3cret');

-- ---------------- Internals are not reachable ----------------
select pg_temp.act_as('00000000-0000-0000-0000-00000000000c', 'authenticated');
set local role authenticated;
select pg_temp.expect_error($$select private.start_attempt('20000000-0000-0000-0000-000000000001')$$, 'permission denied');
select pg_temp.expect_error($$select * from private.access_log$$, 'permission denied');
select pg_temp.expect_error($$select private.set_server_gate('mine')$$, 'permission denied');
select pg_temp.expect_error($$select admin_risk_overview()$$, 'FORBIDDEN');

-- ---------------- Daily exam limit (student c, through the server) ----------------
select pg_temp.via_server(true);
select start_attempt('20000000-0000-0000-0000-000000000001') as a1 \gset
select 'resume does not count' as check, start_attempt('20000000-0000-0000-0000-000000000001') = :'a1' as pass;
select 'second exam allowed' as check, start_attempt('20000000-0000-0000-0000-000000000002') is not null as pass;
select pg_temp.expect_error($$select start_attempt('20000000-0000-0000-0000-000000000003')$$, 'DAILY_LIMIT');
select 'over-limit attempt rolled back' as check, count(*) = 2 as pass from exam_attempts where user_id = auth.uid();
select 'payload loads through server' as check, (get_attempt_payload(:'a1') -> 'questions') is not null as pass;

-- ---------------- Daily practice limit ----------------
select bank_create_session((select id from subjects where code = 'est1-math'), null, null, 'new', 10, true) as s1 \gset
select 'practice clamped to remaining' as check, cardinality(question_ids) = 3 as pass from practice_sessions where id = :'s1';
select pg_temp.expect_error($$select bank_create_session((select id from subjects where code = 'est1-math'), null, null, 'all', 5, true)$$, 'DAILY_LIMIT');
select pg_temp.expect_error($$select bank_create_session((select id from subjects where code = 'est1-math'), null, null, 'mistakes', 5, true)$$, 'NO_QUESTIONS');
select 'practice session loads' as check, jsonb_array_length(bank_session(:'s1') -> 'questions') = 3 as pass;

-- ---------------- Direct API use is blocked and logged (student b) ----------------
select pg_temp.act_as('00000000-0000-0000-0000-00000000000b', 'authenticated');
select pg_temp.via_server(false);
select 'direct start returns nothing' as check, start_attempt('20000000-0000-0000-0000-000000000001') is null as pass;
select 'no attempt created' as check, count(*) = 0 as pass from exam_attempts where user_id = auth.uid();
select 'direct overview returns nothing' as check, bank_overview() is null as pass;
select 'direct review returns nothing' as check, get_attempt_review(:'a1') is null as pass;
select pg_temp.expect_error($$select private.gate('x')$$, 'permission denied');
-- flagged: exam limit halves from 2 to 1
select pg_temp.via_server(true);
select 'flagged account: first exam ok' as check, start_attempt('20000000-0000-0000-0000-000000000001') is not null as pass;
select pg_temp.expect_error($$select start_attempt('20000000-0000-0000-0000-000000000002')$$, 'DAILY_LIMIT');

-- ---------------- Admin view ----------------
reset role;
select 'blocked calls logged with real IP' as check, count(*) = 3 and bool_and(ip = '198.51.100.9') as pass
  from private.access_log where user_id = '00000000-0000-0000-0000-00000000000b' and action = 'blocked';
select 'server calls logged with client IP' as check, bool_and(ip = '203.0.113.7') as pass
  from private.access_log where user_id = '00000000-0000-0000-0000-00000000000c';
select pg_temp.act_as('00000000-0000-0000-0000-00000000000a', 'authenticated');
set local role authenticated;
select 'admin sees scraper on top' as check,
       (admin_risk_overview() -> 0 ->> 'email') = 'scraper@test.local' and (admin_risk_overview() -> 0 ->> 'score')::int = 100 as pass;
select 'normal student scored low' as check,
       (select (r ->> 'score')::int < 60 from jsonb_array_elements(admin_risk_overview()) r where r ->> 'email' = 'student@test.local') as pass;
select 'status shows gate on' as check, (admin_protection_status() ->> 'gate_configured')::boolean as pass;
select pg_temp.via_server(false);
select 'admins are gated too' as check, bank_overview() is null as pass;

-- ---------------- Media bucket ----------------
reset role;
select 'question-media is private' as check, not public as pass from storage.buckets where id = 'question-media';
select 'no public read policy' as check, count(*) = 0 as pass from pg_policies
 where schemaname = 'storage' and policyname = 'question media: public read';

rollback;
