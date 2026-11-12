-- End-to-end checks for permissions and the exam engine.
-- Run against a fresh database after supabase_stubs.sql + migrations. Everything is rolled back.
\set ON_ERROR_STOP 1
begin;

-- Users (trigger creates profiles)
insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-00000000000a', 'admin@test.local', '{"full_name":"Admin"}'),
  ('00000000-0000-0000-0000-00000000000b', 'student@test.local', '{"full_name":"Student"}'),
  ('00000000-0000-0000-0000-00000000000c', 'other@test.local', '{}');
update profiles set role = 'admin' where id = '00000000-0000-0000-0000-00000000000a'; -- bootstrap as superuser

create or replace function pg_temp.act_as(uid text, r text) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', uid, true);
  perform set_config('request.jwt.claim.role', r, true);
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

-- ---------------- Admin builds an exam ----------------
select pg_temp.act_as('00000000-0000-0000-0000-00000000000a', 'authenticated');
set local role authenticated;

insert into questions (id, subject_id, topic_id, origin, status, stem)
select ('10000000-0000-0000-0000-00000000000' || n)::uuid, s.id, t.id, 'manual', 'approved',
       jsonb_build_object('blocks', jsonb_build_array(jsonb_build_object('type','paragraph','text','Q'||n)))
  from generate_series(1,3) n, subjects s join topics t on t.subject_id = s.id and t.name = 'Foundational Algebra'
 where s.code = 'est1-math';
insert into question_options (question_id, label, is_correct)
select q.id, l, l = 'B' from questions q, unnest(array['A','B','C','D']) l;

-- a source question cannot enter an exam
insert into questions (id, subject_id, origin, status) select '1000000000000000000000000000000f', id, 'source', 'approved' from subjects where code='est1-math';

insert into exams (id, subject_id, slug, title, access, duration_minutes)
select '20000000-0000-0000-0000-000000000001', id, 'algebra-1', 'Algebra Practice 1', 'free', 20 from subjects where code='est1-math';
insert into exams (id, subject_id, slug, title, access, duration_minutes)
select '20000000-0000-0000-0000-000000000002', id, 'premium-1', 'Premium Mock 1', 'premium', 75 from subjects where code='est1-math';
insert into exam_sections (id, exam_id, position, title) values
  ('30000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 1, 'Section 1'),
  ('30000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000002', 1, 'Section 1');
insert into exam_questions (exam_id, section_id, question_id, position)
select '20000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', q.id, row_number() over (order by q.id)
  from questions q where origin = 'manual';
insert into exam_questions (exam_id, section_id, question_id, position)
select '20000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000002', q.id, row_number() over (order by q.id)
  from questions q where origin = 'manual';

select pg_temp.expect_error($$insert into exam_questions (exam_id, section_id, question_id, position)
  values ('20000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000001','1000000000000000000000000000000f', 9)$$,
  'Official source questions');

select 'question_count' as check, question_count = 3 as pass from exams where slug = 'algebra-1';

-- publish guard: a draft question blocks publishing
update questions set status = 'draft' where id = '10000000-0000-0000-0000-000000000001';
select pg_temp.expect_error($$update exams set status='published' where slug='algebra-1'$$, 'not approved');
update questions set status = 'approved' where id = '10000000-0000-0000-0000-000000000001';
update exams set status = 'published';
select 'published' as check, count(*) = 2 as pass from exams where status = 'published' and published_at is not null;

-- ---------------- Student permissions ----------------
reset role;
-- ids the client would receive from get_attempt_payload
create temp table ids as
select eq.position, eq.id as eqid,
       (select o.id from question_options o where o.question_id = eq.question_id and o.label = 'A') as opt_a,
       (select o.id from question_options o where o.question_id = eq.question_id and o.label = 'B') as opt_b
  from exam_questions eq where eq.exam_id = '20000000-0000-0000-0000-000000000001';
grant select on ids to authenticated, anon;
select pg_temp.act_as('00000000-0000-0000-0000-00000000000b', 'authenticated');
set local role authenticated;

select 'student sees catalog' as check, count(*) = 2 as pass from exams;
select 'student cannot read answer keys' as check, count(*) = 0 as pass from question_options;
select 'student cannot read questions' as check, count(*) = 0 as pass from questions;
select 'student sees only own profile' as check, count(*) = 1 as pass from profiles;
select pg_temp.expect_error($$update profiles set role='admin' where id = auth.uid()$$, 'Only administrators');
select pg_temp.expect_error($$select admin_grant_access(auth.uid(), 30, 'self')$$, 'Not authorized');
select pg_temp.expect_error($$select start_attempt('20000000-0000-0000-0000-000000000002')$$, 'SUBSCRIPTION_REQUIRED');

-- ---------------- Exam flow ----------------
select start_attempt('20000000-0000-0000-0000-000000000001') as attempt_id \gset
select 'resume returns same attempt' as check, start_attempt('20000000-0000-0000-0000-000000000001') = :'attempt_id' as pass;

select get_attempt_payload(:'attempt_id') as payload \gset
select 'payload has 3 questions' as check, jsonb_array_length((:'payload')::jsonb -> 'questions') = 3 as pass;
select 'payload has no answer key' as check, position('is_correct' in :'payload') = 0 as pass;

-- answer Q1 correctly (B), Q2 wrong (A), flag Q3 without answering
select 'saved' as check, save_answer(:'attempt_id', eqid, case position when 1 then opt_b else opt_a end) is not null as pass
  from ids where position in (1,2);
select 'flagged' as check, save_answer(:'attempt_id', eqid, null, false, true) is not null as pass from ids where position = 3;
-- flag-only update must not clear an answer
select 'flag q1' as check, save_answer(:'attempt_id', eqid, null, false, true) is not null as pass from ids where position = 1;
select 'flag keeps answer' as check, selected_option_id is not null and is_flagged as pass
  from attempt_answers aa join ids on ids.eqid = aa.exam_question_id
 where aa.attempt_id = :'attempt_id' and ids.position = 1;

-- option from a different question is rejected
select pg_temp.expect_error(format($$select save_answer(%L, %L, %L)$$, :'attempt_id',
  (select eqid from ids where position=1), (select opt_a from ids where position=2)), 'INVALID_OPTION');

-- review is not available while open
select pg_temp.expect_error(format($$select get_attempt_review(%L)$$, :'attempt_id'), 'ATTEMPT_OPEN');

select submit_attempt(:'attempt_id') as result \gset
select 'score 1/3' as check, (:'result')::jsonb ->> 'score' = '1.00' and (:'result')::jsonb ->> 'max_score' = '3.00' as pass;
select 'submit idempotent' as check, submit_attempt(:'attempt_id') ->> 'status' = 'submitted' as pass;
select 'save after submit is refused' as check, (save_answer(:'attempt_id', eqid, null) ->> 'closed')::boolean as pass from ids where position = 1;
select 'review shows correct answers' as check,
       jsonb_array_length(get_attempt_review(:'attempt_id') -> 'questions') = 3 as pass;
select 'topic breakdown' as check, result_summary -> 'by_topic' -> 0 ->> 'topic' = 'Foundational Algebra' as pass
  from exam_attempts where id = :'attempt_id';

-- another student cannot see or touch this attempt
reset role;
select pg_temp.act_as('00000000-0000-0000-0000-00000000000c', 'authenticated');
set local role authenticated;
select 'other student cannot read attempt' as check, count(*) = 0 as pass from exam_attempts;
select pg_temp.expect_error(format($$select get_attempt_review(%L)$$, :'attempt_id'), 'ATTEMPT_NOT_FOUND');

-- ---------------- Server-side timer ----------------
select start_attempt('20000000-0000-0000-0000-000000000001') as late_attempt \gset
reset role;
update exam_attempts set deadline_at = now() - interval '1 minute' where id = :'late_attempt';  -- simulate time passing
select pg_temp.act_as('00000000-0000-0000-0000-00000000000c', 'authenticated');
set local role authenticated;
select 'late save is refused' as check, save_answer(:'late_attempt', eqid, null) ->> 'status' = 'expired' as pass from ids where position = 1;
select 'late attempt expired' as check, status = 'expired' as pass from exam_attempts where id = :'late_attempt';

-- ---------------- Manual access grant with audit ----------------
reset role;
select pg_temp.act_as('00000000-0000-0000-0000-00000000000a', 'authenticated');
set local role authenticated;
select admin_grant_access('00000000-0000-0000-0000-00000000000b', 30, 'Scholarship') is not null as granted;
select 'audit written' as check, count(*) = 1 as pass from admin_audit_log where action = 'access.grant';
select pg_temp.expect_error($$delete from admin_audit_log$$, 'append-only');
select pg_temp.expect_error($$select write_audit('fake','x','y')$$, 'permission denied');

reset role;
select pg_temp.act_as('00000000-0000-0000-0000-00000000000b', 'authenticated');
set local role authenticated;
select 'premium unlocked after grant' as check, start_attempt('20000000-0000-0000-0000-000000000002') is not null as pass;

reset role;
select pg_temp.act_as('00000000-0000-0000-0000-00000000000a', 'authenticated');
set local role authenticated;
select admin_revoke_access('00000000-0000-0000-0000-00000000000b', 'test') = 1 as revoked;
select 'access gone after revoke' as check, not has_premium_access('00000000-0000-0000-0000-00000000000b') as pass;

-- knowledge base is append-only
reset role;
insert into source_documents (subject_id, kind, title, storage_path, file_sha256, file_size_bytes)
select id, 'question_paper', 'Test', 'est1-math/test.pdf', 'abc', 1 from subjects where code='est1-math';
select pg_temp.expect_error($$insert into source_documents (subject_id, kind, title, storage_path, file_sha256, file_size_bytes)
  select id, 'question_paper', 'Dup', 'est1-math/dup.pdf', 'abc', 1 from subjects where code='est1-math'$$, 'duplicate key');
select pg_temp.expect_error($$update source_documents set storage_path = 'x.pdf'$$, 'immutable');
select pg_temp.expect_error($$delete from source_documents$$, 'cannot be deleted');

-- anon sees catalog but cannot start
select pg_temp.act_as('', 'anon');
set local role anon;
select 'anon sees published exams' as check, count(*) = 2 as pass from exams;
select pg_temp.expect_error($$select start_attempt('20000000-0000-0000-0000-000000000001')$$, 'permission denied');

-- ---------------- Admin stats & content freeze ----------------
reset role;
select pg_temp.act_as('00000000-0000-0000-0000-00000000000a', 'authenticated');
set local role authenticated;
select 'admin stats' as check, (admin_dashboard_stats() ->> 'published_exams')::int = 2 as pass;
select pg_temp.expect_error($$update questions set stem = '{"blocks":[]}' where id = '10000000-0000-0000-0000-000000000001'$$, 'published exam');
select pg_temp.expect_error($$update question_options set is_correct = false where question_id = '10000000-0000-0000-0000-000000000001'$$, 'published exam');
reset role;
select pg_temp.act_as('00000000-0000-0000-0000-00000000000b', 'authenticated');
set local role authenticated;
select pg_temp.expect_error($$select admin_dashboard_stats()$$, 'Not authorized');
select pg_temp.expect_error($$select apply_payment_success('00000000-0000-0000-0000-000000000000', 'x', 1, 'EGP', '{}')$$, 'permission denied');

-- ---------------- Payments (service role) ----------------
reset role;
insert into plans (id, code, name, price_cents, currency, interval_months, is_active)
values ('40000000-0000-0000-0000-000000000001', 'monthly', 'Monthly', 30000, 'EGP', 1, true);
insert into payments (id, user_id, plan_id, provider, merchant_reference, amount_cents, currency)
values ('50000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000000c', '40000000-0000-0000-0000-000000000001', 'paymob', 'NM-1', 30000, 'EGP'),
       ('50000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-00000000000c', '40000000-0000-0000-0000-000000000001', 'paymob', 'NM-2', 30000, 'EGP'),
       ('50000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-00000000000c', '40000000-0000-0000-0000-000000000001', 'paymob', 'NM-3', 30000, 'EGP');
select 'tampered amount returns no subscription' as check, apply_payment_success('50000000-0000-0000-0000-000000000002', 't2', 100, 'EGP', '{}') is null as pass;
select 'tampered amount marked failed' as check, status = 'failed' as pass from payments where id = '50000000-0000-0000-0000-000000000002';
select apply_payment_success('50000000-0000-0000-0000-000000000001', 't1', 30000, 'EGP', '{}') as sub1 \gset
select 'duplicate webhook is idempotent' as check, apply_payment_success('50000000-0000-0000-0000-000000000001', 't1', 30000, 'EGP', '{}') = :'sub1' as pass;
select 'one subscription created' as check, count(*) = 1 as pass from subscriptions where user_id = '00000000-0000-0000-0000-00000000000c' and source = 'payment';
select 'premium after payment' as check, has_premium_access('00000000-0000-0000-0000-00000000000c') as pass;
select 'renewal payment' as check, apply_payment_success('50000000-0000-0000-0000-000000000003', 't3', 30000, 'EGP', '{}') is not null as pass;
select 'renewal extends access' as check,
       (select max(current_period_end) from subscriptions where user_id = '00000000-0000-0000-0000-00000000000c')
       > (select current_period_end from subscriptions where id = :'sub1') + interval '27 days' as pass;
select 'late failure call' as check, true as pass from (select apply_payment_failure('50000000-0000-0000-0000-000000000001', 't1', 'late failure', '{}')) x;
select 'late failure never downgrades success' as check, status = 'succeeded' as pass from payments where id = '50000000-0000-0000-0000-000000000001';

rollback;
