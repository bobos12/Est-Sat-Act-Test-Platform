-- =====================================================================
-- Northmark — official EST reference data
-- Names copied verbatim from the answer-key distribution tables
-- (see docs/EST_BLUEPRINT.md). This is reference taxonomy, not sample content.
-- =====================================================================

insert into public.subjects (code, name, short_name, test_family, description,
                             official_duration_minutes, official_question_count, official_sections, is_active, sort_order)
values
  ('est1-math', 'EST I Math', 'Math', 'EST I',
   'Algebra, data analysis, functions, geometry and trigonometry. Calculator allowed.', 75, 50, 1, true, 1),
  ('est1-literacy', 'EST I Literacy', 'Literacy', 'EST I',
   'Reading and writing across literature, history, social studies and science passages, in three modules.', 90, 85, 3, true, 2),
  ('est2-math1', 'EST II Math Level 1', 'Math Level 1', 'EST II', '', 60, 40, 1, false, 10),
  ('est2-math2', 'EST II Math Level 2', 'Math Level 2', 'EST II', '', 60, 40, 1, false, 11),
  ('est2-biology', 'EST II Biology', 'Biology', 'EST II', '', 60, 60, 1, false, 12),
  ('est2-chemistry', 'EST II Chemistry', 'Chemistry', 'EST II', '', 60, 60, 1, false, 13);

insert into public.topics (subject_id, kind, name, sort_order)
select s.id, v.kind::public.topic_kind, v.name, v.ord
  from (values
    ('est1-math', 'topic', 'Foundational Algebra', 1),
    ('est1-math', 'topic', 'Data Analysis and Probability', 2),
    ('est1-math', 'topic', 'Advanced Algebra and Functions', 3),
    ('est1-math', 'topic', 'Geometry and Trigonometry', 4),

    ('est1-literacy', 'skill', 'Words in Context', 1),
    ('est1-literacy', 'skill', 'Expression of Ideas', 2),
    ('est1-literacy', 'skill', 'Standard English Conventions', 3),
    ('est1-literacy', 'domain', 'Analysis in Literature', 1),
    ('est1-literacy', 'domain', 'Analysis in History', 2),
    ('est1-literacy', 'domain', 'Analysis in History/Social Studies', 3),
    ('est1-literacy', 'domain', 'Analysis in Social Studies', 4),
    ('est1-literacy', 'domain', 'Analysis in Social Science', 5),
    ('est1-literacy', 'domain', 'Analysis in Science', 6),
    ('est1-literacy', 'domain', 'Analysis in Humanities', 7),
    ('est1-literacy', 'domain', 'Analysis in Biography', 8),
    ('est1-literacy', 'domain', 'Analysis in Autobiography', 9),
    ('est1-literacy', 'domain', 'Analysis in Technical', 10),

    ('est2-math1', 'topic', 'Numerations and Operations', 1),
    ('est2-math1', 'topic', 'Algebra and Functions', 2),
    ('est2-math1', 'topic', 'Plane Shapes', 3),
    ('est2-math1', 'topic', 'Measurements', 4),
    ('est2-math1', 'topic', 'Coordinate Systems', 5),
    ('est2-math1', 'topic', 'Trigonometry', 6),
    ('est2-math1', 'topic', 'Data Analysis, Statistics, and Probability', 7),

    ('est2-math2', 'topic', 'Numerations and Operations', 1),
    ('est2-math2', 'topic', 'Algebra and Functions', 2),
    ('est2-math2', 'topic', 'Coordinate Systems', 3),
    ('est2-math2', 'topic', 'Solid Shapes', 4),
    ('est2-math2', 'topic', 'Trigonometry', 5),
    ('est2-math2', 'topic', 'Data Analysis, Statistics, and Probability', 6),

    ('est2-biology', 'topic', 'Cell Structure and Molecular Biology', 1),
    ('est2-biology', 'topic', 'Ecology', 2),
    ('est2-biology', 'topic', 'Genetics and Heredity', 3),
    ('est2-biology', 'topic', 'Body Systems and plants', 4),
    ('est2-biology', 'topic', 'Classification and Evolution', 5),

    ('est2-chemistry', 'topic', 'Foundation of Chemistry: Atoms, Bonds and Periodic Properties', 1),
    ('est2-chemistry', 'topic', 'Chemical Reactions and Quantitative Chemistry', 2),
    ('est2-chemistry', 'topic', 'Chemical Behavior (aqueous solutions and gaseous state)', 3),
    ('est2-chemistry', 'topic', 'Chemical Kinetics and Chemical Equilibrium', 4),
    ('est2-chemistry', 'topic', 'Experimental Chemistry', 5)
  ) as v(code, kind, name, ord)
  join public.subjects s on s.code = v.code;

-- Free-access configuration (editable in the admin dashboard).
insert into public.app_settings (key, value) values
  ('free_access', '{"require_account": true, "max_attempts_per_free_exam": null}');
