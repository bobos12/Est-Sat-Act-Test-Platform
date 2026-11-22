-- =====================================================================
-- Student-produced responses (SAT Math "grid-ins"): the student types an
-- answer instead of choosing an option. A question is either
--   answer_format = 'choice'  -> graded by question_options.is_correct
--   answer_format = 'spr'     -> graded against accepted_answers
-- Typed answers match an accepted answer exactly (ignoring spaces/case) or
-- by numeric value, so 0.5 = .5 = 1/2 = 2/4. Rounded forms are only accepted
-- when listed (e.g. {"2/3", ".6666", ".6667"}), as on the official tests.
-- =====================================================================

alter table public.questions
  add column answer_format text not null default 'choice' check (answer_format in ('choice', 'spr')),
  add column accepted_answers text[] not null default '{}';

alter table public.attempt_answers
  add column response_text text check (char_length(response_text) <= 12);

-- Official raw -> scaled conversion, index = number correct: [[lower, upper], ...] (SAT scoring guides).
alter table public.exams add column score_scale jsonb;

-- Numeric value of a typed answer (integer, decimal or fraction), else null.
create or replace function public.spr_value(p text)
returns numeric language plpgsql immutable set search_path = public as $$
declare
  s text := replace(replace(coalesce(p, ''), ' ', ''), '−', '-');
  d numeric;
begin
  if s ~ '^-?(\d+\.?\d*|\.\d+)$' then
    return s::numeric;
  end if;
  if s ~ '^-?\d+/\d+$' then
    d := split_part(s, '/', 2)::numeric;
    if d = 0 then return null; end if;
    return split_part(s, '/', 1)::numeric / d;
  end if;
  return null;
end $$;

create or replace function public.spr_is_correct(p_response text, p_accepted text[])
returns boolean language sql immutable set search_path = public as $$
  select coalesce(btrim(p_response), '') <> '' and exists (
    select 1 from unnest(p_accepted) acc
     where lower(regexp_replace(acc, '\s', '', 'g')) = lower(regexp_replace(p_response, '\s', '', 'g'))
        or abs(public.spr_value(acc) - public.spr_value(p_response)) < 0.000000001);
$$;

-- ---------------------------------------------------------------------
-- Grading
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
     set is_correct = case
           when q.answer_format = 'spr' then public.spr_is_correct(aa.response_text, q.accepted_answers)
           else coalesce((select o.is_correct from public.question_options o where o.id = aa.selected_option_id), false)
         end
    from public.exam_questions eq
    join public.questions q on q.id = eq.question_id
   where aa.attempt_id = p_attempt and eq.id = aa.exam_question_id;

  with per_q as (
    select eq.id as eqid, eq.points, q.topic_id,
           coalesce(aa.is_correct, false) as correct,
           (aa.selected_option_id is not null or coalesce(btrim(aa.response_text), '') <> '') as answered
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

-- ---------------------------------------------------------------------
-- Exam screen payload: adds each question's format and the typed answers.
-- ---------------------------------------------------------------------
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
               'format', q.answer_format,
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
               'response', aa.response_text,
               'flagged', aa.is_flagged)), '[]')
        from public.attempt_answers aa where aa.attempt_id = a.id)
  ) into result;

  update public.exam_attempts set last_activity_at = now() where id = a.id;
  return result;
end $$;

-- ---------------------------------------------------------------------
-- save_answer gains p_response (typed answer). p_set_option=true sets both
-- the option and the typed answer; flag-only updates leave both unchanged.
-- ---------------------------------------------------------------------
drop function public.save_answer(uuid, uuid, uuid, boolean, boolean);

create function public.save_answer(
  p_attempt uuid,
  p_question uuid,               -- exam_questions.id
  p_option uuid default null,
  p_set_option boolean default true,
  p_flagged boolean default null,
  p_response text default null
)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  a public.exam_attempts;
  fmt text;
  resp text := nullif(btrim(coalesce(p_response, '')), '');
begin
  select * into a from public.exam_attempts where id = p_attempt and user_id = auth.uid() for update;
  if not found then
    raise exception 'ATTEMPT_NOT_FOUND' using errcode = 'P0002';
  end if;
  if a.status <> 'in_progress' then
    return jsonb_build_object('closed', true, 'status', a.status);
  end if;
  if now() > a.deadline_at + make_interval(secs => public.exam_grace_seconds()) then
    perform public.finalize_attempt(p_attempt, 'expired');
    return jsonb_build_object('closed', true, 'status', 'expired');
  end if;

  select q.answer_format into fmt
    from public.exam_questions eq join public.questions q on q.id = eq.question_id
   where eq.id = p_question and eq.exam_id = a.exam_id;
  if fmt is null then
    raise exception 'INVALID_QUESTION' using errcode = '22023';
  end if;
  if p_set_option then
    if fmt = 'spr' and p_option is not null then
      raise exception 'INVALID_OPTION' using errcode = '22023';
    end if;
    if fmt = 'choice' and resp is not null then
      raise exception 'INVALID_RESPONSE' using errcode = '22023';
    end if;
    if resp is not null and (char_length(resp) > 12 or resp !~ '^[-−0-9./ ]+$') then
      raise exception 'INVALID_RESPONSE' using errcode = '22023';
    end if;
    if p_option is not null and not exists (
         select 1 from public.question_options o
           join public.exam_questions eq on eq.question_id = o.question_id
          where o.id = p_option and eq.id = p_question) then
      raise exception 'INVALID_OPTION' using errcode = '22023';
    end if;
  end if;

  insert into public.attempt_answers as aa (attempt_id, exam_question_id, selected_option_id, response_text, is_flagged)
  values (p_attempt, p_question, case when p_set_option then p_option end, case when p_set_option then resp end, coalesce(p_flagged, false))
  on conflict (attempt_id, exam_question_id) do update
     set selected_option_id = case when p_set_option then excluded.selected_option_id else aa.selected_option_id end,
         response_text = case when p_set_option then excluded.response_text else aa.response_text end,
         is_flagged = coalesce(p_flagged, aa.is_flagged),
         updated_at = now();

  update public.exam_attempts set last_activity_at = now() where id = p_attempt;

  return jsonb_build_object('closed', false, 'saved_at', now(), 'deadline_at', a.deadline_at);
end $$;

revoke execute on function public.save_answer(uuid, uuid, uuid, boolean, boolean, text) from public, anon;
grant execute on function public.save_answer(uuid, uuid, uuid, boolean, boolean, text) to authenticated;

-- ---------------------------------------------------------------------
-- Review: typed answer and accepted answers once the attempt is closed.
-- ---------------------------------------------------------------------
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
    'exam', (select jsonb_build_object('id', e.id, 'title', e.title, 'slug', e.slug, 'score_scale', e.score_scale,
                                       'subject', (select s.code from public.subjects s where s.id = e.subject_id))
               from public.exams e where e.id = a.exam_id),
    'questions', (
      select coalesce(jsonb_agg(jsonb_build_object(
               'id', eq.id, 'position', eq.position, 'section_id', eq.section_id,
               'stem', q.stem, 'explanation', q.explanation,
               'stimulus_id', q.stimulus_id,
               'topic', t.name, 'skill', sk.name,
               'format', q.answer_format,
               'response', aa.response_text,
               'accepted_answers', case when q.answer_format = 'spr' then to_jsonb(q.accepted_answers) end,
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

-- ---------------------------------------------------------------------
-- Publishing: a typed-answer question needs at least one accepted answer
-- instead of options.
-- ---------------------------------------------------------------------
create or replace function public.guard_exam_publish()
returns trigger language plpgsql as $$
declare
  bad int;
begin
  if new.status = 'published' and (old.status is distinct from 'published') then
    if new.question_count = 0 then
      raise exception 'Cannot publish an exam with no questions' using errcode = '23514';
    end if;
    select count(*) into bad
      from public.exam_questions eq
      join public.questions q on q.id = eq.question_id
     where eq.exam_id = new.id
       and (q.status <> 'approved'
            or case when q.answer_format = 'spr' then cardinality(q.accepted_answers) = 0
                    else (select count(*) from public.question_options o where o.question_id = q.id and o.is_correct) <> 1
                      or (select count(*) from public.question_options o where o.question_id = q.id) < 2
               end);
    if bad > 0 then
      raise exception '% question(s) are not approved or lack a correct answer', bad using errcode = '23514';
    end if;
    new.published_at := coalesce(new.published_at, now());
    new.reviewed_by := coalesce(new.reviewed_by, auth.uid());
  end if;
  if new.status = 'archived' and old.status <> 'archived' then
    new.archived_at := now();
  end if;
  return new;
end $$;

-- Published questions stay frozen, including their format and accepted answers.
create or replace function public.guard_published_question()
returns trigger language plpgsql as $$
declare
  qid uuid;
begin
  if tg_table_name = 'questions' then
    if new.stem = old.stem and new.explanation = old.explanation
       and new.stimulus_id is not distinct from old.stimulus_id
       and new.answer_format = old.answer_format and new.accepted_answers = old.accepted_answers then
      return new;
    end if;
    qid := new.id;
  elsif tg_op = 'DELETE' then
    qid := old.question_id;
  else
    qid := new.question_id;
  end if;
  if exists (select 1 from public.exam_questions eq join public.exams e on e.id = eq.exam_id
              where eq.question_id = qid and e.status = 'published') then
    raise exception 'This question is in a published exam. Unpublish the exam to edit it.' using errcode = '23514';
  end if;
  return coalesce(new, old);
end $$;

-- ---------------------------------------------------------------------
-- The practice bank answers by option only, so typed-answer questions stay
-- in timed exams and out of the bank pool.
-- ---------------------------------------------------------------------
create or replace function public.bank_pool()
returns table (question_id uuid, subject_id uuid, category_id uuid, difficulty public.difficulty,
               stimulus_id uuid, stimulus_marker int, source_question_number int, is_free boolean)
language sql stable security definer set search_path = public as $$
  select q.id, q.subject_id, coalesce(q.skill_id, q.topic_id), q.difficulty,
         q.stimulus_id, q.stimulus_marker, q.source_question_number, bool_or(e.access = 'free')
    from public.questions q
    join public.exam_questions eq on eq.question_id = q.id
    join public.exams e on e.id = eq.exam_id
   where e.status = 'published' and q.status = 'approved' and q.answer_format = 'choice'
   group by q.id;
$$;
