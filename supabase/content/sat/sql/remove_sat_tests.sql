-- Removes the imported SAT Practice Test exams (and their questions, passages, attempts) so the
-- corrected sat_test_NN.sql files can be loaded again. Touches nothing else.
do $$
declare
  v_exams uuid[];
  v_questions uuid[];
  v_stimuli uuid[];
begin
  select array_agg(id) into v_exams from public.exams where slug like 'sat-practice-test-%';
  if v_exams is null then
    raise notice 'No SAT practice test exams found. Nothing to remove.';
    return;
  end if;

  select array_agg(distinct eq.question_id) into v_questions
    from public.exam_questions eq where eq.exam_id = any (v_exams);
  select array_agg(distinct q.stimulus_id) into v_stimuli
    from public.questions q where q.id = any (v_questions) and q.stimulus_id is not null;

  -- Unpublish first: published exams lock their questions against changes.
  update public.exams set status = 'draft' where id = any (v_exams);

  delete from public.exam_attempts where exam_id = any (v_exams);      -- answers go with them
  delete from public.exams where id = any (v_exams);                   -- sections and exam links go with them
  delete from public.questions where id = any (v_questions);           -- choices, bookmarks, practice answers go with them
  delete from public.stimuli where id = any (coalesce(v_stimuli, '{}'));

  raise notice 'Removed % exams and % questions.', cardinality(v_exams), cardinality(v_questions);
end $$;
