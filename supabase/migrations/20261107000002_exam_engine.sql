-- =====================================================================
-- Northmark — examination engine
-- All state changes go through these functions. The database clock is
-- the only clock: the browser timer is a display of deadline_at.
-- =====================================================================

create table public.exam_attempts (
  id uuid primary key default gen_random_uuid(),
  exam_id uuid not null references public.exams (id),
  user_id uuid not null references public.profiles (id) on delete cascade,
  status public.attempt_status not null default 'in_progress',
  started_at timestamptz not null default now(),
  deadline_at timestamptz not null,
  submitted_at timestamptz,
  last_activity_at timestamptz not null default now(),
  score numeric(7,2),
  max_score numeric(7,2),
  percent numeric(5,2),
  correct_count int,
  answered_count int,
  question_count int,
  result_summary jsonb
);
create index exam_attempts_user_idx on public.exam_attempts (user_id, started_at desc);
create index exam_attempts_exam_idx on public.exam_attempts (exam_id);
-- One open attempt per student per exam: refresh/resume always returns to it.
create unique index exam_attempts_one_open on public.exam_attempts (user_id, exam_id) where status = 'in_progress';

create table public.attempt_answers (
  attempt_id uuid not null references public.exam_attempts (id) on delete cascade,
  exam_question_id uuid not null references public.exam_questions (id),
  selected_option_id uuid references public.question_options (id),
  is_flagged boolean not null default false,
  is_correct boolean,
  updated_at timestamptz not null default now(),
  primary key (attempt_id, exam_question_id)
);

-- Seconds of network grace accepted after the deadline.
create or replace function public.exam_grace_seconds() returns int language sql immutable as $$ select 15 $$;

-- ---------------------------------------------------------------------
-- Grading (internal)
-- ---------------------------------------------------------------------
create or replace function public.finalize_attempt(p_attempt uuid, p_status public.attempt_status)
returns void language plpgsql security definer set search_path = public as $$
declare
  a public.exam_attempts;
begin
  select * into a from public.exam_attempts where id = p_attempt for update;
  if a.status <> 'in_progress' then
    return;
  end if;

  -- Mark every saved answer right or wrong.
  update public.attempt_answers aa
     set is_correct = coalesce(
           (select o.is_correct from public.question_options o where o.id = aa.selected_option_id), false)
   where aa.attempt_id = p_attempt;

  with per_q as (
    select eq.id as eqid, eq.points, q.topic_id,
           coalesce(aa.is_correct, false) as correct,
           aa.selected_option_id is not null as answered
      from public.exam_questions eq
      join public.questions q on q.id = eq.question_id
      left join public.attempt_answers aa on aa.attempt_id = p_attempt and aa.exam_question_id = eq.id
     where eq.exam_id = a.exam_id
  ),
  totals as (
    select sum(points) filter (where correct) as score,
           sum(points) as max_score,
           count(*) filter (where correct) as correct_count,
           count(*) filter (where answered) as answered_count,
           count(*) as question_count
      from per_q
  ),
  by_topic as (
    select coalesce(jsonb_agg(jsonb_build_object(
             'topic_id', t.id, 'topic', coalesce(t.name, 'Uncategorised'),
             'correct', x.correct, 'total', x.total) order by t.sort_order nulls last), '[]') as topics
      from (select topic_id, count(*) filter (where correct) as correct, count(*) as total
              from per_q group by topic_id) x
      left join public.topics t on t.id = x.topic_id
  )
  update public.exam_attempts e
     set status = p_status,
         submitted_at = now(),
         score = coalesce(totals.score, 0),
         max_score = coalesce(totals.max_score, 0),
         percent = case when coalesce(totals.max_score, 0) = 0 then 0
                        else round(100 * coalesce(totals.score, 0) / totals.max_score, 2) end,
         correct_count = totals.correct_count,
         answered_count = totals.answered_count,
         question_count = totals.question_count,
         result_summary = jsonb_build_object('by_topic', by_topic.topics)
    from totals, by_topic
   where e.id = p_attempt;
end $$;

-- Close an open attempt if its time is up. Returns true when the attempt is (now) closed.
create or replace function public.close_if_expired(p_attempt uuid)
returns boolean language plpgsql security definer set search_path = public as $$
declare
  a public.exam_attempts;
begin
  select * into a from public.exam_attempts where id = p_attempt;
  if a.status <> 'in_progress' then
    return true;
  end if;
  if now() > a.deadline_at + make_interval(secs => public.exam_grace_seconds()) then
    perform public.finalize_attempt(p_attempt, 'expired');
    return true;
  end if;
  return false;
end $$;

-- Sweep for abandoned attempts (schedule with pg_cron every minute or two).
create or replace function public.close_expired_attempts()
returns int language plpgsql security definer set search_path = public as $$
declare
  r record;
  n int := 0;
begin
  for r in
    select id from public.exam_attempts
     where status = 'in_progress'
       and now() > deadline_at + make_interval(secs => public.exam_grace_seconds())
  loop
    perform public.finalize_attempt(r.id, 'expired');
    n := n + 1;
  end loop;
  return n;
end $$;

-- ---------------------------------------------------------------------
-- Student-facing API (called via supabase.rpc with the student's session)
-- ---------------------------------------------------------------------

-- Start a new attempt, or resume the open one.
create or replace function public.start_attempt(p_exam uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  ex public.exams;
  open_id uuid;
  new_id uuid;
begin
  if uid is null then
    raise exception 'AUTH_REQUIRED' using errcode = '28000';
  end if;

  select * into ex from public.exams where id = p_exam;
  if not found or ex.status <> 'published' then
    raise exception 'EXAM_UNAVAILABLE' using errcode = 'P0002';
  end if;
  if ex.access = 'premium' and not public.has_premium_access(uid) then
    raise exception 'SUBSCRIPTION_REQUIRED' using errcode = '42501';
  end if;

  select id into open_id from public.exam_attempts
   where user_id = uid and exam_id = p_exam and status = 'in_progress';
  if open_id is not null then
    if not public.close_if_expired(open_id) then
      return open_id;                       -- resume
    end if;
  end if;

  insert into public.exam_attempts (exam_id, user_id, deadline_at, question_count)
  values (p_exam, uid, now() + make_interval(mins => ex.duration_minutes), ex.question_count)
  returning id into new_id;
  return new_id;
end $$;

-- Everything the exam screen needs, without answer keys.
create or replace function public.get_attempt_payload(p_attempt uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  a public.exam_attempts;
  ex public.exams;
  result jsonb;
begin
  select * into a from public.exam_attempts where id = p_attempt and user_id = auth.uid();
  if not found then
    raise exception 'ATTEMPT_NOT_FOUND' using errcode = 'P0002';
  end if;

  perform public.close_if_expired(p_attempt);
  select * into a from public.exam_attempts where id = p_attempt;
  select * into ex from public.exams where id = a.exam_id;

  if a.status <> 'in_progress' then
    return jsonb_build_object('attempt', jsonb_build_object('id', a.id, 'status', a.status));
  end if;

  select jsonb_build_object(
    'attempt', jsonb_build_object(
      'id', a.id, 'status', a.status, 'started_at', a.started_at,
      'deadline_at', a.deadline_at, 'server_now', now()),
    'exam', jsonb_build_object(
      'id', ex.id, 'title', ex.title, 'duration_minutes', ex.duration_minutes,
      'subject', (select jsonb_build_object('code', s.code, 'name', s.name) from public.subjects s where s.id = ex.subject_id)),
    'sections', (
      select coalesce(jsonb_agg(jsonb_build_object(
               'id', s.id, 'position', s.position, 'title', s.title, 'instructions', s.instructions)
               order by s.position), '[]')
        from public.exam_sections s where s.exam_id = ex.id),
    'questions', (
      select coalesce(jsonb_agg(jsonb_build_object(
               'id', eq.id, 'position', eq.position, 'section_id', eq.section_id,
               'stem', q.stem, 'stimulus_id', q.stimulus_id, 'stimulus_marker', q.stimulus_marker,
               'options', (select coalesce(jsonb_agg(jsonb_build_object(
                                   'id', o.id, 'label', o.label, 'content', o.content) order by o.label), '[]')
                             from public.question_options o where o.question_id = q.id))
               order by eq.position), '[]')
        from public.exam_questions eq
        join public.questions q on q.id = eq.question_id
       where eq.exam_id = ex.id),
    'stimuli', (
      select coalesce(jsonb_agg(jsonb_build_object(
               'id', st.id, 'kind', st.kind, 'title', st.title,
               'attribution', st.attribution, 'content', st.content)), '[]')
        from public.stimuli st
       where st.id in (select q.stimulus_id from public.exam_questions eq
                         join public.questions q on q.id = eq.question_id
                        where eq.exam_id = ex.id and q.stimulus_id is not null)),
    'answers', (
      select coalesce(jsonb_agg(jsonb_build_object(
               'question_id', aa.exam_question_id,
               'option_id', aa.selected_option_id,
               'flagged', aa.is_flagged)), '[]')
        from public.attempt_answers aa where aa.attempt_id = a.id)
  ) into result;

  update public.exam_attempts set last_activity_at = now() where id = a.id;
  return result;
end $$;

-- Save one answer and/or flag. p_set_option=false leaves the answer unchanged
-- (used for flag-only updates); p_option null with p_set_option=true clears it.
create or replace function public.save_answer(
  p_attempt uuid,
  p_question uuid,               -- exam_questions.id
  p_option uuid default null,
  p_set_option boolean default true,
  p_flagged boolean default null
)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  a public.exam_attempts;
begin
  select * into a from public.exam_attempts where id = p_attempt and user_id = auth.uid() for update;
  if not found then
    raise exception 'ATTEMPT_NOT_FOUND' using errcode = 'P0002';
  end if;
  -- Closed attempts return a result instead of raising, so that an expiry
  -- triggered here is committed rather than rolled back with the error.
  if a.status <> 'in_progress' then
    return jsonb_build_object('closed', true, 'status', a.status);
  end if;
  if now() > a.deadline_at + make_interval(secs => public.exam_grace_seconds()) then
    perform public.finalize_attempt(p_attempt, 'expired');
    return jsonb_build_object('closed', true, 'status', 'expired');
  end if;

  if not exists (select 1 from public.exam_questions where id = p_question and exam_id = a.exam_id) then
    raise exception 'INVALID_QUESTION' using errcode = '22023';
  end if;
  if p_set_option and p_option is not null and not exists (
       select 1 from public.question_options o
         join public.exam_questions eq on eq.question_id = o.question_id
        where o.id = p_option and eq.id = p_question) then
    raise exception 'INVALID_OPTION' using errcode = '22023';
  end if;

  insert into public.attempt_answers as aa (attempt_id, exam_question_id, selected_option_id, is_flagged)
  values (p_attempt, p_question, case when p_set_option then p_option end, coalesce(p_flagged, false))
  on conflict (attempt_id, exam_question_id) do update
     set selected_option_id = case when p_set_option then excluded.selected_option_id else aa.selected_option_id end,
         is_flagged = coalesce(p_flagged, aa.is_flagged),
         updated_at = now();

  update public.exam_attempts set last_activity_at = now() where id = p_attempt;

  return jsonb_build_object('closed', false, 'saved_at', now(), 'deadline_at', a.deadline_at);
end $$;

-- Submit (idempotent). Late submissions beyond the grace period are recorded as expired.
create or replace function public.submit_attempt(p_attempt uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  a public.exam_attempts;
begin
  select * into a from public.exam_attempts where id = p_attempt and user_id = auth.uid();
  if not found then
    raise exception 'ATTEMPT_NOT_FOUND' using errcode = 'P0002';
  end if;
  if a.status = 'in_progress' then
    perform public.finalize_attempt(
      p_attempt,
      case when now() > a.deadline_at + make_interval(secs => public.exam_grace_seconds())
           then 'expired'::public.attempt_status else 'submitted'::public.attempt_status end);
  end if;
  select * into a from public.exam_attempts where id = p_attempt;
  return jsonb_build_object('id', a.id, 'status', a.status, 'score', a.score,
                            'max_score', a.max_score, 'percent', a.percent);
end $$;

-- Full review after the attempt is closed: correct answers and explanations.
create or replace function public.get_attempt_review(p_attempt uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  a public.exam_attempts;
begin
  select * into a from public.exam_attempts
   where id = p_attempt and (user_id = auth.uid() or public.is_admin());
  if not found then
    raise exception 'ATTEMPT_NOT_FOUND' using errcode = 'P0002';
  end if;
  perform public.close_if_expired(p_attempt);
  select * into a from public.exam_attempts where id = p_attempt;
  if a.status = 'in_progress' then
    raise exception 'ATTEMPT_OPEN' using errcode = 'P0001';
  end if;

  return jsonb_build_object(
    'attempt', to_jsonb(a) - 'user_id',
    'exam', (select jsonb_build_object('id', e.id, 'title', e.title, 'slug', e.slug) from public.exams e where e.id = a.exam_id),
    'questions', (
      select coalesce(jsonb_agg(jsonb_build_object(
               'id', eq.id, 'position', eq.position, 'section_id', eq.section_id,
               'stem', q.stem, 'explanation', q.explanation,
               'stimulus_id', q.stimulus_id,
               'topic', t.name, 'skill', sk.name,
               'selected_option_id', aa.selected_option_id,
               'is_correct', coalesce(aa.is_correct, false),
               'options', (select jsonb_agg(jsonb_build_object(
                                   'id', o.id, 'label', o.label, 'content', o.content, 'is_correct', o.is_correct)
                                   order by o.label)
                             from public.question_options o where o.question_id = q.id))
               order by eq.position), '[]')
        from public.exam_questions eq
        join public.questions q on q.id = eq.question_id
        left join public.topics t on t.id = q.topic_id
        left join public.topics sk on sk.id = q.skill_id
        left join public.attempt_answers aa on aa.attempt_id = a.id and aa.exam_question_id = eq.id
       where eq.exam_id = a.exam_id),
    'stimuli', (
      select coalesce(jsonb_agg(jsonb_build_object('id', st.id, 'kind', st.kind, 'title', st.title,
               'attribution', st.attribution, 'content', st.content)), '[]')
        from public.stimuli st
       where st.id in (select q.stimulus_id from public.exam_questions eq
                         join public.questions q on q.id = eq.question_id
                        where eq.exam_id = a.exam_id and q.stimulus_id is not null))
  );
end $$;
