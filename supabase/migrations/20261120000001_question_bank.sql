-- =====================================================================
-- Question bank
-- Students practise untimed from the published question pool (approved
-- questions that sit in at least one published exam), by subject, topic
-- and difficulty, with progress, bookmarks and resumable sessions.
-- A question is free when any published free exam contains it.
-- Answer keys reach the browser only after an answer is revealed:
-- immediately in tutor mode, at the end of the session in test mode.
-- =====================================================================

create table public.practice_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  subject_id uuid not null references public.subjects (id),
  mode text not null check (mode in ('new', 'mistakes', 'bookmarked', 'all')),
  tutor boolean not null default true,              -- reveal after each answer (false = test mode)
  filters jsonb not null default '{}',
  question_ids uuid[] not null check (cardinality(question_ids) between 1 and 100),
  created_at timestamptz not null default now(),
  last_activity_at timestamptz not null default now(),
  completed_at timestamptz
);
create index practice_sessions_user_idx on public.practice_sessions (user_id, created_at desc);

create table public.practice_answers (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  question_id uuid not null references public.questions (id) on delete cascade,
  session_id uuid references public.practice_sessions (id) on delete cascade,
  -- Options are replaced when an admin edits a question; the result is kept.
  selected_option_id uuid references public.question_options (id) on delete set null,
  selected_label char(1),
  is_correct boolean not null,
  time_ms int check (time_ms between 0 and 3600000),
  created_at timestamptz not null default now(),
  unique (session_id, question_id)
);
create index practice_answers_user_idx on public.practice_answers (user_id, question_id, created_at desc);
create index practice_answers_question_idx on public.practice_answers (question_id);

create table public.question_bookmarks (
  user_id uuid not null references public.profiles (id) on delete cascade,
  question_id uuid not null references public.questions (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, question_id)
);

alter table public.practice_sessions  enable row level security;
alter table public.practice_answers   enable row level security;
alter table public.question_bookmarks enable row level security;
create policy practice_sessions_owner_read on public.practice_sessions for select using (user_id = auth.uid() or public.is_admin());
create policy practice_answers_owner_read on public.practice_answers for select using (user_id = auth.uid() or public.is_admin());
create policy question_bookmarks_owner_read on public.question_bookmarks for select using (user_id = auth.uid() or public.is_admin());
-- Writes go through the functions below.

-- ---------------------------------------------------------------------
-- Internal helpers
-- ---------------------------------------------------------------------

-- The practice pool. category = skill when set (Literacy), else topic (Math).
create or replace function public.bank_pool()
returns table (question_id uuid, subject_id uuid, category_id uuid, difficulty public.difficulty,
               stimulus_id uuid, stimulus_marker int, source_question_number int, is_free boolean)
language sql stable security definer set search_path = public as $$
  select q.id, q.subject_id, coalesce(q.skill_id, q.topic_id), q.difficulty,
         q.stimulus_id, q.stimulus_marker, q.source_question_number, bool_or(e.access = 'free')
    from public.questions q
    join public.exam_questions eq on eq.question_id = q.id
    join public.exams e on e.id = eq.exam_id
   where e.status = 'published' and q.status = 'approved'
   group by q.id;
$$;

-- A student's latest answer per question, counting only answers already revealed to them
-- (tutor sessions, finished test sessions). Unfinished test answers stay private.
create or replace function public.bank_latest_answers(uid uuid)
returns table (question_id uuid, is_correct boolean, attempts bigint)
language sql stable security definer set search_path = public as $$
  select distinct on (pa.question_id) pa.question_id, pa.is_correct,
         count(*) over (partition by pa.question_id)
    from public.practice_answers pa
    left join public.practice_sessions s on s.id = pa.session_id
   where pa.user_id = uid and (s.id is null or s.tutor or s.completed_at is not null)
   order by pa.question_id, pa.created_at desc;
$$;

-- Share of revealed practice answers that were correct, once enough students have tried.
create or replace function public.bank_peer_correct(p_question uuid)
returns int language sql stable security definer set search_path = public as $$
  select case when count(*) >= 10 then round(100.0 * count(*) filter (where pa.is_correct) / count(*))::int end
    from public.practice_answers pa
    left join public.practice_sessions s on s.id = pa.session_id
   where pa.question_id = p_question and (s.id is null or s.tutor or s.completed_at is not null);
$$;

-- ---------------------------------------------------------------------
-- Student API
-- ---------------------------------------------------------------------

-- Everything the bank home needs: subjects, categories with progress, totals, open session.
create or replace function public.bank_overview()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  premium boolean;
  result jsonb;
begin
  if uid is null then
    raise exception 'AUTH_REQUIRED' using errcode = '28000';
  end if;
  premium := public.has_premium_access(uid);

  with pool as (select * from public.bank_pool()),
  latest as (select * from public.bank_latest_answers(uid)),
  marks as (select question_id from public.question_bookmarks where user_id = uid),
  per_q as (
    select p.*, l.is_correct, l.question_id is not null as answered, m.question_id is not null as bookmarked,
           (premium or p.is_free) as available
      from pool p
      left join latest l on l.question_id = p.question_id
      left join marks m on m.question_id = p.question_id
  )
  select jsonb_build_object(
    'premium', premium,
    'subjects', (
      select coalesce(jsonb_agg(jsonb_build_object(
               'id', s.id, 'code', s.code, 'name', s.name, 'short_name', s.short_name, 'family', s.test_family,
               'total', x.total, 'available', x.available, 'answered', x.answered, 'correct', x.correct,
               'mistakes', x.mistakes, 'bookmarked', x.bookmarked) order by s.sort_order), '[]')
        from public.subjects s
        join (select subject_id,
                     count(*) as total,
                     count(*) filter (where available) as available,
                     count(*) filter (where answered and available) as answered,
                     count(*) filter (where is_correct and available) as correct,
                     count(*) filter (where answered and not is_correct and available) as mistakes,
                     count(*) filter (where bookmarked and available) as bookmarked
                from per_q group by subject_id) x on x.subject_id = s.id
       where s.is_active),
    'categories', (
      select coalesce(jsonb_agg(jsonb_build_object(
               'id', x.category_id, 'subject_id', x.subject_id, 'name', coalesce(t.name, 'Other'),
               'kind', t.kind, 'total', x.total, 'available', x.available, 'answered', x.answered,
               'correct', x.correct, 'mistakes', x.mistakes,
               'easy', x.easy, 'medium', x.medium, 'hard', x.hard)
               order by t.sort_order nulls last, t.name), '[]')
        from (select subject_id, category_id,
                     count(*) as total,
                     count(*) filter (where available) as available,
                     count(*) filter (where answered and available) as answered,
                     count(*) filter (where is_correct and available) as correct,
                     count(*) filter (where answered and not is_correct and available) as mistakes,
                     count(*) filter (where available and difficulty = 'easy') as easy,
                     count(*) filter (where available and difficulty = 'medium') as medium,
                     count(*) filter (where available and difficulty = 'hard') as hard
                from per_q group by subject_id, category_id) x
        left join public.topics t on t.id = x.category_id),
    'totals', jsonb_build_object(
      'answers', (select count(*) from public.practice_answers pa
                    left join public.practice_sessions s on s.id = pa.session_id
                   where pa.user_id = uid and (s.id is null or s.tutor or s.completed_at is not null)),
      'correct', (select count(*) from public.practice_answers pa
                    left join public.practice_sessions s on s.id = pa.session_id
                   where pa.user_id = uid and pa.is_correct and (s.id is null or s.tutor or s.completed_at is not null)),
      'minutes', (select coalesce(round(sum(time_ms) / 60000.0), 0) from public.practice_answers where user_id = uid),
      'sessions', (select count(*) from public.practice_sessions where user_id = uid and completed_at is not null)),
    'open_session', (
      select jsonb_build_object('id', s.id, 'mode', s.mode, 'tutor', s.tutor, 'created_at', s.created_at,
               'subject', sub.name, 'total', cardinality(s.question_ids),
               'answered', (select count(*) from public.practice_answers pa where pa.session_id = s.id))
        from public.practice_sessions s join public.subjects sub on sub.id = s.subject_id
       where s.user_id = uid and s.completed_at is null
       order by s.last_activity_at desc limit 1),
    'recent', (
      select coalesce(jsonb_agg(r order by r.created_at desc), '[]') from (
        select s.id, s.mode, s.tutor, s.created_at, s.completed_at, sub.name as subject,
               cardinality(s.question_ids) as total,
               (select count(*) from public.practice_answers pa where pa.session_id = s.id) as answered,
               (select count(*) from public.practice_answers pa where pa.session_id = s.id and pa.is_correct) as correct
          from public.practice_sessions s join public.subjects sub on sub.id = s.subject_id
         where s.user_id = uid and s.completed_at is not null
         order by s.created_at desc limit 8) r)
  ) into result;
  return result;
end $$;

-- Build a session from filters. Questions that share a passage stay together, in passage order.
create or replace function public.bank_create_session(
  p_subject uuid,
  p_categories uuid[] default null,
  p_difficulties text[] default null,
  p_mode text default 'new',
  p_count int default 10,
  p_tutor boolean default true
)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  premium boolean;
  seed text := gen_random_uuid()::text;
  ids uuid[];
  new_id uuid;
begin
  if uid is null then
    raise exception 'AUTH_REQUIRED' using errcode = '28000';
  end if;
  if p_mode not in ('new', 'mistakes', 'bookmarked', 'all') then
    raise exception 'BAD_MODE' using errcode = '22023';
  end if;
  premium := public.has_premium_access(uid);

  select array_agg(c.question_id order by c.grp, c.stimulus_marker nulls last, c.source_question_number nulls last, c.question_id)
    into ids
    from (
      select p.*, md5(coalesce(p.stimulus_id, p.question_id)::text || seed) as grp
        from public.bank_pool() p
        left join public.bank_latest_answers(uid) l on l.question_id = p.question_id
       where p.subject_id = p_subject
         and (premium or p.is_free)
         and (coalesce(cardinality(p_categories), 0) = 0 or p.category_id = any (p_categories))
         and (coalesce(cardinality(p_difficulties), 0) = 0 or p.difficulty::text = any (p_difficulties))
         and case p_mode
               when 'new' then l.question_id is null
               when 'mistakes' then l.question_id is not null and not l.is_correct
               when 'bookmarked' then exists (select 1 from public.question_bookmarks b
                                               where b.user_id = uid and b.question_id = p.question_id)
               else true
             end
       order by grp, p.stimulus_marker nulls last, p.source_question_number nulls last
       limit greatest(1, least(coalesce(p_count, 10), 100))
    ) c;

  if ids is null then
    raise exception 'NO_QUESTIONS' using errcode = 'P0002';
  end if;

  insert into public.practice_sessions (user_id, subject_id, mode, tutor, filters, question_ids)
  values (uid, p_subject, p_mode, coalesce(p_tutor, true),
          jsonb_build_object('categories', coalesce(to_jsonb(p_categories), '[]'),
                             'difficulties', coalesce(to_jsonb(p_difficulties), '[]'),
                             'count', p_count),
          ids)
  returning id into new_id;
  return new_id;
end $$;

-- The full session for the runner. Keys and explanations only for revealed answers.
create or replace function public.bank_session(p_session uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  s public.practice_sessions;
  reveal_all boolean;
begin
  select * into s from public.practice_sessions where id = p_session and user_id = auth.uid();
  if not found then
    raise exception 'SESSION_NOT_FOUND' using errcode = 'P0002';
  end if;
  reveal_all := s.completed_at is not null;

  return jsonb_build_object(
    'session', jsonb_build_object(
      'id', s.id, 'mode', s.mode, 'tutor', s.tutor, 'created_at', s.created_at, 'completed_at', s.completed_at,
      'subject', (select jsonb_build_object('id', sub.id, 'code', sub.code, 'name', sub.name)
                    from public.subjects sub where sub.id = s.subject_id)),
    'questions', (
      select coalesce(jsonb_agg(jsonb_build_object(
               'id', q.id, 'n', x.n,
               'stem', q.stem, 'stimulus_id', q.stimulus_id, 'stimulus_marker', q.stimulus_marker,
               'difficulty', q.difficulty, 'category', coalesce(sk.name, t.name),
               'bookmarked', exists (select 1 from public.question_bookmarks b where b.user_id = s.user_id and b.question_id = q.id),
               'options', (select coalesce(jsonb_agg(jsonb_build_object('id', o.id, 'label', o.label, 'content', o.content)
                                    order by o.label), '[]')
                             from public.question_options o where o.question_id = q.id),
               'answer', case when pa.id is null then null else jsonb_build_object(
                   'option_id', pa.selected_option_id, 'time_ms', pa.time_ms,
                   'revealed', reveal_all or s.tutor,
                   'is_correct', case when reveal_all or s.tutor then pa.is_correct end,
                   'correct_option_id', case when reveal_all or s.tutor then
                       (select o.id from public.question_options o where o.question_id = q.id and o.is_correct) end,
                   'explanation', case when reveal_all or s.tutor then q.explanation end,
                   'peer_correct', case when reveal_all or s.tutor then public.bank_peer_correct(q.id) end) end,
               -- Skipped questions in a finished session still show their key.
               'key', case when reveal_all and pa.id is null then jsonb_build_object(
                   'correct_option_id', (select o.id from public.question_options o where o.question_id = q.id and o.is_correct),
                   'explanation', q.explanation) end)
               order by x.n), '[]')
        from unnest(s.question_ids) with ordinality as x(qid, n)
        join public.questions q on q.id = x.qid
        left join public.topics t on t.id = q.topic_id
        left join public.topics sk on sk.id = q.skill_id
        left join public.practice_answers pa on pa.session_id = s.id and pa.question_id = q.id),
    'stimuli', (
      select coalesce(jsonb_agg(jsonb_build_object('id', st.id, 'kind', st.kind, 'title', st.title,
               'attribution', st.attribution, 'content', st.content)), '[]')
        from public.stimuli st
       where st.id in (select q.stimulus_id from public.questions q where q.id = any (s.question_ids)))
  );
end $$;

-- Record an answer. Tutor mode locks the first answer and returns the key at once;
-- test mode may change answers until the session is finished.
create or replace function public.bank_answer(p_session uuid, p_question uuid, p_option uuid, p_time_ms int default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  s public.practice_sessions;
  opt public.question_options;
  existing public.practice_answers;
  correct_id uuid;
begin
  select * into s from public.practice_sessions where id = p_session and user_id = auth.uid() for update;
  if not found then
    raise exception 'SESSION_NOT_FOUND' using errcode = 'P0002';
  end if;
  if s.completed_at is not null then
    raise exception 'SESSION_FINISHED' using errcode = 'P0001';
  end if;
  if not (p_question = any (s.question_ids)) then
    raise exception 'INVALID_QUESTION' using errcode = '22023';
  end if;
  select * into opt from public.question_options where id = p_option and question_id = p_question;
  if not found then
    raise exception 'INVALID_OPTION' using errcode = '22023';
  end if;

  select * into existing from public.practice_answers where session_id = s.id and question_id = p_question;
  if found and s.tutor then
    opt := null;                                     -- already answered: return the stored result
  else
    insert into public.practice_answers as pa (user_id, question_id, session_id, selected_option_id, selected_label, is_correct, time_ms)
    values (s.user_id, p_question, s.id, p_option, opt.label, opt.is_correct,
            least(greatest(coalesce(p_time_ms, 0), 0), 3600000))
    on conflict (session_id, question_id) do update
       set selected_option_id = excluded.selected_option_id,
           selected_label = excluded.selected_label,
           is_correct = excluded.is_correct,
           time_ms = coalesce(pa.time_ms, 0) + coalesce(excluded.time_ms, 0),
           created_at = now()
    returning * into existing;
  end if;
  update public.practice_sessions set last_activity_at = now() where id = s.id;

  if not s.tutor then
    return jsonb_build_object('saved', true, 'option_id', existing.selected_option_id);
  end if;
  select o.id into correct_id from public.question_options o where o.question_id = p_question and o.is_correct;
  return jsonb_build_object(
    'saved', true, 'option_id', existing.selected_option_id, 'is_correct', existing.is_correct,
    'correct_option_id', correct_id, 'time_ms', existing.time_ms,
    'explanation', (select q.explanation from public.questions q where q.id = p_question),
    'peer_correct', public.bank_peer_correct(p_question));
end $$;

create or replace function public.bank_finish_session(p_session uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  update public.practice_sessions
     set completed_at = coalesce(completed_at, now()), last_activity_at = now()
   where id = p_session and user_id = auth.uid();
  if not found then
    raise exception 'SESSION_NOT_FOUND' using errcode = 'P0002';
  end if;
end $$;

-- Toggle a bookmark on a question the student can see. Returns the new state.
create or replace function public.bank_toggle_bookmark(p_question uuid)
returns boolean language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'AUTH_REQUIRED' using errcode = '28000';
  end if;
  if exists (select 1 from public.question_bookmarks where user_id = uid and question_id = p_question) then
    delete from public.question_bookmarks where user_id = uid and question_id = p_question;
    return false;
  end if;
  if not exists (select 1 from public.bank_pool() p where p.question_id = p_question) then
    raise exception 'INVALID_QUESTION' using errcode = '22023';
  end if;
  insert into public.question_bookmarks (user_id, question_id) values (uid, p_question);
  return true;
end $$;

-- ---------------------------------------------------------------------
-- Admin API
-- ---------------------------------------------------------------------

-- One page of the admin bank with every filter applied in SQL, plus status counts.
create or replace function public.admin_search_questions(
  p_q text default null,
  p_subject uuid default null,
  p_category uuid default null,
  p_difficulty text default null,
  p_status text default null,
  p_origin text default null,
  p_usage text default null,          -- 'live' (in a published exam) | 'unused' (in no exam)
  p_sort text default 'updated',      -- 'updated' | 'hardest' | 'most_answered' | 'oldest'
  p_limit int default 50,
  p_offset int default 0
)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  result jsonb;
begin
  if not public.is_admin() then
    raise exception 'Not authorized' using errcode = '42501';
  end if;

  with base as (
    select q.id, q.subject_id, q.topic_id, q.skill_id, q.difficulty, q.status, q.origin, q.stem,
           q.stimulus_id, q.updated_at, q.created_at, q.review_notes,
           (select count(*) from public.question_options o where o.question_id = q.id) as option_count,
           (select count(*) from public.question_options o where o.question_id = q.id and o.is_correct) as correct_count,
           exists (select 1 from public.exam_questions eq join public.exams e on e.id = eq.exam_id
                    where eq.question_id = q.id and e.status = 'published') as live,
           exists (select 1 from public.exam_questions eq where eq.question_id = q.id) as used
      from public.questions q
     where (p_subject is null or q.subject_id = p_subject)
       and (p_category is null or q.topic_id = p_category or q.skill_id = p_category)
       and (p_difficulty is null or q.difficulty::text = p_difficulty)
       and (p_origin is null or q.origin::text = p_origin)
       and (coalesce(trim(p_q), '') = '' or q.stem::text ilike '%' || trim(p_q) || '%' or q.id::text = trim(p_q))
  ),
  filtered as (
    select b.*,
           coalesce(ps.attempts, 0) as attempts, coalesce(ps.correct, 0) as correct
      from base b
      left join lateral (select count(*) as attempts, count(*) filter (where pa.is_correct) as correct
                           from public.practice_answers pa where pa.question_id = b.id) ps on true
     where (p_status is null or b.status::text = p_status)
       and (p_usage is null or (p_usage = 'live' and b.live) or (p_usage = 'unused' and not b.used)
            or (p_usage = 'broken' and (b.correct_count <> 1 or b.option_count < 2)))
  ),
  page as (
    select * from filtered
     order by
       case when p_sort = 'hardest' and attempts >= 5 then correct::numeric / attempts end asc nulls last,
       case when p_sort = 'most_answered' then attempts end desc nulls last,
       case when p_sort = 'oldest' then created_at end asc,
       updated_at desc, id
     limit greatest(1, least(coalesce(p_limit, 50), 200)) offset greatest(coalesce(p_offset, 0), 0)
  )
  select jsonb_build_object(
    'total', (select count(*) from filtered),
    'counts', jsonb_build_object(
      'all', (select count(*) from base),
      'approved', (select count(*) from base where status = 'approved'),
      'draft', (select count(*) from base where status = 'draft'),
      'retired', (select count(*) from base where status = 'retired'),
      'live', (select count(*) from base where live),
      'unused', (select count(*) from base where not used),
      'broken', (select count(*) from base where correct_count <> 1 or option_count < 2)),
    'rows', (
      select coalesce(jsonb_agg(jsonb_build_object(
               'id', p.id, 'stem', p.stem, 'difficulty', p.difficulty, 'status', p.status, 'origin', p.origin,
               'updated_at', p.updated_at, 'has_stimulus', p.stimulus_id is not null,
               'subject', (select jsonb_build_object('code', s.code, 'name', s.name) from public.subjects s where s.id = p.subject_id),
               'topic', (select t.name from public.topics t where t.id = p.topic_id),
               'skill', (select t.name from public.topics t where t.id = p.skill_id),
               'broken', p.correct_count <> 1 or p.option_count < 2,
               'has_notes', coalesce(p.review_notes, '') <> '',
               'attempts', p.attempts, 'correct', p.correct, 'live', p.live,
               'exams', (select coalesce(jsonb_agg(jsonb_build_object('id', e.id, 'title', e.title, 'status', e.status)
                                  order by e.status = 'published' desc, e.title), '[]')
                           from public.exam_questions eq join public.exams e on e.id = eq.exam_id
                          where eq.question_id = p.id))
             ), '[]')
        from page p)
  ) into result;
  return result;
end $$;

-- Bank coverage: questions per subject × category × difficulty, live vs total.
create or replace function public.admin_bank_coverage()
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then
    raise exception 'Not authorized' using errcode = '42501';
  end if;
  return (
    with pool as (select question_id from public.bank_pool())
    select coalesce(jsonb_agg(jsonb_build_object(
             'subject_id', x.subject_id, 'category_id', x.category_id, 'difficulty', x.difficulty,
             'total', x.total, 'live', x.live)), '[]')
      from (select q.subject_id, coalesce(q.skill_id, q.topic_id) as category_id, q.difficulty,
                   count(*) filter (where q.status <> 'retired') as total,
                   count(*) filter (where p.question_id is not null) as live
              from public.questions q
              left join pool p on p.question_id = q.id
             group by 1, 2, 3) x
  );
end $$;

-- How students answered one question, in practice and in timed exams.
create or replace function public.admin_question_insights(p_question uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then
    raise exception 'Not authorized' using errcode = '42501';
  end if;
  return jsonb_build_object(
    'options', (
      select coalesce(jsonb_agg(jsonb_build_object(
               'id', o.id, 'label', o.label, 'is_correct', o.is_correct,
               'practice', (select count(*) from public.practice_answers pa
                             where pa.question_id = p_question and pa.selected_label = o.label),
               'exam', (select count(*) from public.attempt_answers aa
                          join public.exam_questions eq on eq.id = aa.exam_question_id
                         where eq.question_id = p_question and aa.selected_option_id = o.id))
               order by o.label), '[]')
        from public.question_options o where o.question_id = p_question),
    'practice', (select jsonb_build_object('attempts', count(*), 'correct', count(*) filter (where is_correct),
                          'avg_ms', round(avg(time_ms)), 'students', count(distinct user_id), 'bookmarks',
                          (select count(*) from public.question_bookmarks b where b.question_id = p_question))
                   from public.practice_answers where question_id = p_question),
    'exam', (select jsonb_build_object('attempts', count(*) filter (where aa.selected_option_id is not null),
                      'correct', count(*) filter (where aa.is_correct), 'skipped', count(*) filter (where aa.selected_option_id is null))
               from public.attempt_answers aa
               join public.exam_questions eq on eq.id = aa.exam_question_id
               join public.exam_attempts a on a.id = aa.attempt_id and a.status <> 'in_progress'
              where eq.question_id = p_question)
  );
end $$;

-- ---------------------------------------------------------------------
-- Privileges
-- ---------------------------------------------------------------------
revoke execute on function public.bank_pool() from public, anon, authenticated;
revoke execute on function public.bank_latest_answers(uuid) from public, anon, authenticated;
revoke execute on function public.bank_peer_correct(uuid) from public, anon, authenticated;

revoke execute on function public.bank_overview() from public, anon;
revoke execute on function public.bank_create_session(uuid, uuid[], text[], text, int, boolean) from public, anon;
revoke execute on function public.bank_session(uuid) from public, anon;
revoke execute on function public.bank_answer(uuid, uuid, uuid, int) from public, anon;
revoke execute on function public.bank_finish_session(uuid) from public, anon;
revoke execute on function public.bank_toggle_bookmark(uuid) from public, anon;
grant execute on function public.bank_overview() to authenticated;
grant execute on function public.bank_create_session(uuid, uuid[], text[], text, int, boolean) to authenticated;
grant execute on function public.bank_session(uuid) to authenticated;
grant execute on function public.bank_answer(uuid, uuid, uuid, int) to authenticated;
grant execute on function public.bank_finish_session(uuid) to authenticated;
grant execute on function public.bank_toggle_bookmark(uuid) to authenticated;

revoke execute on function public.admin_search_questions(text, uuid, uuid, text, text, text, text, text, int, int) from public, anon;
revoke execute on function public.admin_bank_coverage() from public, anon;
revoke execute on function public.admin_question_insights(uuid) from public, anon;
grant execute on function public.admin_search_questions(text, uuid, uuid, text, text, text, text, text, int, int) to authenticated;  -- checks is_admin() inside
grant execute on function public.admin_bank_coverage() to authenticated;
grant execute on function public.admin_question_insights(uuid) to authenticated;
