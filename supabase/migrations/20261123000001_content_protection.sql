-- =====================================================================
-- TargetScore — content protection (phase 1)
--
-- 1. Server gate: the student content functions answer only requests that
--    come through our Next.js server (shared secret in the x-ts-gate header),
--    so a student's own token can't be used to script them directly.
-- 2. Daily limits on new exam attempts and new practice questions, halved
--    for accounts whose risk score crosses the flag threshold.
-- 3. Access log + risk signals for the admin Security page.
-- 4. question-media becomes private; the app hands out signed URLs.
--
-- The original function bodies move unchanged into the private schema and
-- the public functions become thin wrappers. To change exam/bank behaviour,
-- edit private.<fn>. Never `create or replace function public.<fn>` with a
-- full body again: that silently removes the gate and the limits.
-- =====================================================================

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- Move the originals out of the API
-- ---------------------------------------------------------------------
alter function public.start_attempt(uuid) set schema private;
alter function public.get_attempt_payload(uuid) set schema private;
alter function public.save_answer(uuid, uuid, uuid, boolean, boolean, text) set schema private;
alter function public.submit_attempt(uuid) set schema private;
alter function public.get_attempt_review(uuid) set schema private;
alter function public.bank_overview() set schema private;
alter function public.bank_create_session(uuid, uuid[], text[], text, int, boolean) set schema private;
alter function public.bank_session(uuid) set schema private;
alter function public.bank_answer(uuid, uuid, uuid, int) set schema private;
alter function public.bank_finish_session(uuid) set schema private;
alter function public.bank_toggle_bookmark(uuid) set schema private;
alter function public.bank_reset_progress(uuid) set schema private;
alter function public.bank_restart_session(uuid) set schema private;

revoke execute on all functions in schema private from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- Settings (editable on /admin/security)
-- ---------------------------------------------------------------------
insert into public.app_settings (key, value)
values ('content_protection', '{"max_new_attempts_per_day": 8, "max_practice_questions_per_day": 400, "flag_score": 60}')
on conflict (key) do nothing;

create or replace function private.protection_setting(p_key text, p_default int)
returns int language sql stable security definer set search_path = public as $$
  select coalesce((select (value ->> p_key)::int from public.app_settings where key = 'content_protection'), p_default)
$$;

-- ---------------------------------------------------------------------
-- Server gate
-- ---------------------------------------------------------------------
create table private.server_gate (
  id boolean primary key default true check (id),
  secret_hash text not null,
  updated_at timestamptz not null default now()
);
alter table private.server_gate enable row level security;

-- Run once in the SQL editor with the same value as SUPABASE_GATE_SECRET:
--   select private.set_server_gate('...');
create or replace function private.set_server_gate(p_secret text)
returns void language sql security definer set search_path = private as $$
  insert into private.server_gate (secret_hash) values (encode(sha256(convert_to(p_secret, 'UTF8')), 'hex'))
  on conflict (id) do update set secret_hash = excluded.secret_hash, updated_at = now();
$$;

create or replace function private.request_header(p_name text)
returns text language sql stable as $$
  select nullif(current_setting('request.headers', true), '')::json ->> p_name
$$;

create table private.access_log (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  action text not null,       -- exam_start, exam_load, exam_review, practice_create, practice_load, blocked
  ref_id uuid,
  item_count int,
  ip text,
  user_agent text,
  created_at timestamptz not null default now()
);
create index access_log_user_idx on private.access_log (user_id, created_at desc);
create index access_log_time_idx on private.access_log (created_at);
alter table private.access_log enable row level security;

create or replace function private.log_access(p_action text, p_ref uuid default null, p_items int default null)
returns void language sql security definer set search_path = public, private as $$
  insert into private.access_log (user_id, action, ref_id, item_count, ip, user_agent)
  select auth.uid(), p_action, p_ref, p_items,
         left(case when p_action = 'blocked'
                   then btrim(split_part(private.request_header('x-forwarded-for'), ',', 1))
                   else private.request_header('x-ts-client-ip') end, 64),
         left(case when p_action = 'blocked'
                   then private.request_header('user-agent')
                   else private.request_header('x-ts-user-agent') end, 300)
   where auth.uid() is not null;
$$;

-- True when the request carries our server's secret (or no secret is set yet:
-- the gate stays open until configured, and /admin/security warns about it).
-- A failed check is logged and the caller returns null instead of raising,
-- so the log row survives.
create or replace function private.gate(p_action text, p_ref uuid default null)
returns boolean language plpgsql security definer set search_path = public, private as $$
declare
  h text;
begin
  select secret_hash into h from private.server_gate;
  if h is null
     or encode(sha256(convert_to(private.request_header('x-ts-gate'), 'UTF8')), 'hex') = h then
    return true;
  end if;
  perform private.log_access('blocked', p_ref);
  return false;
end $$;

-- ---------------------------------------------------------------------
-- Risk signals and score
-- ---------------------------------------------------------------------
create or replace function private.risk_signals(p_uid uuid)
returns jsonb language sql stable security definer set search_path = public, private as $$
  with att as (
    select count(*) filter (where started_at > now() - interval '24 hours') as attempts_24h,
           -- closed with under 20% answered: the pattern of starting exams just to read the review
           count(*) filter (where status <> 'in_progress' and coalesce(question_count, 0) > 0
                              and coalesce(answered_count, 0) < 0.2 * question_count) as rushed_7d
      from public.exam_attempts
     where user_id = p_uid and started_at > now() - interval '7 days'
  ), lg as (
    select coalesce(sum(item_count) filter (where action = 'practice_create' and created_at > now() - interval '24 hours'), 0) as practice_24h,
           count(distinct ip) filter (where action <> 'blocked' and created_at > now() - interval '24 hours') as ips_24h,
           count(*) filter (where action = 'blocked') as blocked_7d,
           max(created_at) as last_seen
      from private.access_log
     where user_id = p_uid and created_at > now() - interval '7 days'
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
           'last_seen', lg.last_seen)
    from att, lg, pr
$$;

-- 0–100. Real students sit near 0; each signal alone stays under the default flag (60)
-- except direct API use, which a real student can never trigger.
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
  )
$$;

create or replace function private.effective_limit(p_uid uuid, p_key text, p_default int)
returns int language plpgsql stable security definer set search_path = public, private as $$
declare
  lim int := private.protection_setting(p_key, p_default);
begin
  if private.risk_score(private.risk_signals(p_uid)) >= private.protection_setting('flag_score', 60) then
    return greatest(1, lim / 2);
  end if;
  return lim;
end $$;

-- ---------------------------------------------------------------------
-- Public wrappers: exams
-- ---------------------------------------------------------------------
create function public.start_attempt(p_exam uuid)
returns uuid language plpgsql security definer set search_path = public, private as $$
declare
  uid uuid := auth.uid();
  before int;
  new_id uuid;
begin
  if not private.gate('exam_start', p_exam) then return null; end if;
  select count(*) into before from public.exam_attempts where user_id = uid and exam_id = p_exam;
  new_id := private.start_attempt(p_exam);
  -- A resume returns the open attempt; only a newly created one counts toward the limit.
  if (select count(*) from public.exam_attempts where user_id = uid and exam_id = p_exam) > before then
    if not public.is_admin()
       and (select count(*) from public.exam_attempts where user_id = uid and started_at > now() - interval '24 hours')
           > private.effective_limit(uid, 'max_new_attempts_per_day', 8) then
      raise exception 'DAILY_LIMIT' using errcode = 'P0001';   -- rolls the new attempt back
    end if;
    perform private.log_access('exam_start', new_id);
  end if;
  return new_id;
end $$;

create function public.get_attempt_payload(p_attempt uuid)
returns jsonb language plpgsql security definer set search_path = public, private as $$
declare
  r jsonb;
begin
  if not private.gate('exam_load', p_attempt) then return null; end if;
  r := private.get_attempt_payload(p_attempt);
  if r -> 'attempt' ->> 'status' = 'in_progress' then
    perform private.log_access('exam_load', p_attempt);
  end if;
  return r;
end $$;

create function public.save_answer(
  p_attempt uuid,
  p_question uuid,
  p_option uuid default null,
  p_set_option boolean default true,
  p_flagged boolean default null,
  p_response text default null
)
returns jsonb language plpgsql security definer set search_path = public, private as $$
begin
  if not private.gate('exam_save', p_attempt) then return null; end if;
  return private.save_answer(p_attempt, p_question, p_option, p_set_option, p_flagged, p_response);
end $$;

create function public.submit_attempt(p_attempt uuid)
returns jsonb language plpgsql security definer set search_path = public, private as $$
begin
  if not private.gate('exam_submit', p_attempt) then return null; end if;
  return private.submit_attempt(p_attempt);
end $$;

create function public.get_attempt_review(p_attempt uuid)
returns jsonb language plpgsql security definer set search_path = public, private as $$
declare
  r jsonb;
begin
  if not private.gate('exam_review', p_attempt) then return null; end if;
  r := private.get_attempt_review(p_attempt);
  perform private.log_access('exam_review', p_attempt);
  return r;
end $$;

-- ---------------------------------------------------------------------
-- Public wrappers: question bank
-- ---------------------------------------------------------------------
create function public.bank_overview()
returns jsonb language plpgsql security definer set search_path = public, private as $$
begin
  if not private.gate('practice_overview') then return null; end if;
  return private.bank_overview();
end $$;

create function public.bank_create_session(
  p_subject uuid,
  p_categories uuid[] default null,
  p_difficulties text[] default null,
  p_mode text default 'new',
  p_count int default 10,
  p_tutor boolean default true
)
returns uuid language plpgsql security definer set search_path = public, private as $$
declare
  uid uuid := auth.uid();
  counted boolean := coalesce(p_mode, 'new') in ('new', 'all');   -- mistakes/bookmarked were already seen
  remaining int;
  new_id uuid;
  n int;
begin
  if not private.gate('practice_create') then return null; end if;
  if counted and uid is not null and not public.is_admin() then
    remaining := private.effective_limit(uid, 'max_practice_questions_per_day', 400)
      - coalesce((select sum(item_count) from private.access_log
                   where user_id = uid and action = 'practice_create' and created_at > now() - interval '24 hours'), 0);
    if remaining < 1 then
      raise exception 'DAILY_LIMIT' using errcode = 'P0001';
    end if;
    p_count := least(coalesce(p_count, 10), remaining);
  end if;
  new_id := private.bank_create_session(p_subject, p_categories, p_difficulties, p_mode, p_count, p_tutor);
  if counted then
    select cardinality(question_ids) into n from public.practice_sessions where id = new_id;
    perform private.log_access('practice_create', new_id, n);
  end if;
  return new_id;
end $$;

create function public.bank_session(p_session uuid)
returns jsonb language plpgsql security definer set search_path = public, private as $$
declare
  r jsonb;
begin
  if not private.gate('practice_load', p_session) then return null; end if;
  r := private.bank_session(p_session);
  perform private.log_access('practice_load', p_session);
  return r;
end $$;

create function public.bank_answer(p_session uuid, p_question uuid, p_option uuid, p_time_ms int default null)
returns jsonb language plpgsql security definer set search_path = public, private as $$
begin
  if not private.gate('practice_answer', p_session) then return null; end if;
  return private.bank_answer(p_session, p_question, p_option, p_time_ms);
end $$;

create function public.bank_finish_session(p_session uuid)
returns void language plpgsql security definer set search_path = public, private as $$
begin
  if not private.gate('practice_finish', p_session) then return; end if;
  perform private.bank_finish_session(p_session);
end $$;

create function public.bank_toggle_bookmark(p_question uuid)
returns boolean language plpgsql security definer set search_path = public, private as $$
begin
  if not private.gate('practice_bookmark', p_question) then return null; end if;
  return private.bank_toggle_bookmark(p_question);
end $$;

create function public.bank_reset_progress(p_subject uuid)
returns int language plpgsql security definer set search_path = public, private as $$
begin
  if not private.gate('practice_reset', p_subject) then return null; end if;
  return private.bank_reset_progress(p_subject);
end $$;

create function public.bank_restart_session(p_session uuid)
returns uuid language plpgsql security definer set search_path = public, private as $$
begin
  if not private.gate('practice_restart', p_session) then return null; end if;
  return private.bank_restart_session(p_session);
end $$;

revoke execute on function public.start_attempt(uuid) from public, anon;
revoke execute on function public.get_attempt_payload(uuid) from public, anon;
revoke execute on function public.save_answer(uuid, uuid, uuid, boolean, boolean, text) from public, anon;
revoke execute on function public.submit_attempt(uuid) from public, anon;
revoke execute on function public.get_attempt_review(uuid) from public, anon;
revoke execute on function public.bank_overview() from public, anon;
revoke execute on function public.bank_create_session(uuid, uuid[], text[], text, int, boolean) from public, anon;
revoke execute on function public.bank_session(uuid) from public, anon;
revoke execute on function public.bank_answer(uuid, uuid, uuid, int) from public, anon;
revoke execute on function public.bank_finish_session(uuid) from public, anon;
revoke execute on function public.bank_toggle_bookmark(uuid) from public, anon;
revoke execute on function public.bank_reset_progress(uuid) from public, anon;
revoke execute on function public.bank_restart_session(uuid) from public, anon;
grant execute on function public.start_attempt(uuid) to authenticated;
grant execute on function public.get_attempt_payload(uuid) to authenticated;
grant execute on function public.save_answer(uuid, uuid, uuid, boolean, boolean, text) to authenticated;
grant execute on function public.submit_attempt(uuid) to authenticated;
grant execute on function public.get_attempt_review(uuid) to authenticated;
grant execute on function public.bank_overview() to authenticated;
grant execute on function public.bank_create_session(uuid, uuid[], text[], text, int, boolean) to authenticated;
grant execute on function public.bank_session(uuid) to authenticated;
grant execute on function public.bank_answer(uuid, uuid, uuid, int) to authenticated;
grant execute on function public.bank_finish_session(uuid) to authenticated;
grant execute on function public.bank_toggle_bookmark(uuid) to authenticated;
grant execute on function public.bank_reset_progress(uuid) to authenticated;
grant execute on function public.bank_restart_session(uuid) to authenticated;

-- ---------------------------------------------------------------------
-- Admin: risk overview and protection status
-- ---------------------------------------------------------------------
create or replace function public.admin_risk_overview(p_limit int default 50)
returns jsonb language plpgsql stable security definer set search_path = public, private as $$
begin
  if not public.is_admin() then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  return (
    select coalesce(jsonb_agg(to_jsonb(t) order by t.score desc, t.last_seen desc nulls last), '[]')
      from (
        select p.id, p.email, p.full_name, public.has_premium_access(p.id) as premium,
               s.sig as signals, private.risk_score(s.sig) as score, s.sig ->> 'last_seen' as last_seen
          from (select user_id from private.access_log where created_at > now() - interval '7 days'
                union select user_id from public.exam_attempts where started_at > now() - interval '7 days'
                union select user_id from public.practice_sessions where created_at > now() - interval '7 days') a
          join public.profiles p on p.id = a.user_id and p.role = 'student'
          cross join lateral (select private.risk_signals(p.id) as sig) s
         order by private.risk_score(s.sig) desc, s.sig ->> 'last_seen' desc nulls last
         limit greatest(1, least(coalesce(p_limit, 50), 200))
      ) t
  );
end $$;

create or replace function public.admin_protection_status()
returns jsonb language plpgsql stable security definer set search_path = public, private as $$
begin
  if not public.is_admin() then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  return jsonb_build_object(
    'gate_configured', exists (select 1 from private.server_gate),
    'gate_updated_at', (select updated_at from private.server_gate),
    'blocked_24h', (select count(*) from private.access_log where action = 'blocked' and created_at > now() - interval '24 hours'),
    'settings', (select value from public.app_settings where key = 'content_protection'));
end $$;

revoke execute on function public.admin_risk_overview(int) from public, anon;
revoke execute on function public.admin_protection_status() from public, anon;
grant execute on function public.admin_risk_overview(int) to authenticated;      -- checks is_admin() inside
grant execute on function public.admin_protection_status() to authenticated;

-- Helpers created above are internal too.
revoke execute on all functions in schema private from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- Question images: private bucket, signed URLs only
-- ---------------------------------------------------------------------
update storage.buckets set public = false where id = 'question-media';
drop policy if exists "question media: public read" on storage.objects;
create policy "question media: admin read"
  on storage.objects for select using (bucket_id = 'question-media' and public.is_admin());
