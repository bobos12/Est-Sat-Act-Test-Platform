-- Question bank resets: wipe a student's progress in one subject, and restart a session.

-- Deletes the student's practice sessions and answers for one subject. Bookmarks are kept.
create or replace function public.bank_reset_progress(p_subject uuid)
returns int language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  n int;
begin
  if uid is null then
    raise exception 'AUTH_REQUIRED' using errcode = '28000';
  end if;
  delete from public.practice_answers pa
   using public.questions q
   where pa.user_id = uid and q.id = pa.question_id and q.subject_id = p_subject;
  get diagnostics n = row_count;
  delete from public.practice_sessions where user_id = uid and subject_id = p_subject;
  return n;
end $$;

-- A fresh session with the same questions, mode and feedback style. Returns the new session id.
create or replace function public.bank_restart_session(p_session uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  s public.practice_sessions;
  new_id uuid;
begin
  select * into s from public.practice_sessions where id = p_session and user_id = auth.uid();
  if not found then
    raise exception 'SESSION_NOT_FOUND' using errcode = 'P0002';
  end if;
  insert into public.practice_sessions (user_id, subject_id, mode, tutor, filters, question_ids)
  values (s.user_id, s.subject_id, s.mode, s.tutor, s.filters, s.question_ids)
  returning id into new_id;
  return new_id;
end $$;

revoke execute on function public.bank_reset_progress(uuid) from public, anon;
revoke execute on function public.bank_restart_session(uuid) from public, anon;
grant execute on function public.bank_reset_progress(uuid) to authenticated;
grant execute on function public.bank_restart_session(uuid) to authenticated;
