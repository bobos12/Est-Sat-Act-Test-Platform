-- Official papers are now imported straight into student exams (owner decision, 2026-11-09).
-- Removes the guard that blocked questions with origin = 'source' from exam_questions.
drop trigger if exists exam_questions_origin on public.exam_questions;
drop function if exists public.guard_exam_question_origin();
