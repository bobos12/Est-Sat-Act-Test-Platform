-- SAT and ACT tracks (shown as "Soon" until their exams are published) and the three membership plans.

insert into public.subjects (code, name, short_name, test_family, description,
                             official_duration_minutes, official_question_count, official_sections, is_active, sort_order)
values
  ('sat-math', 'SAT Math', 'Math', 'SAT', 'Algebra, advanced math, problem solving and data analysis, geometry and trigonometry.', 70, 44, 2, true, 20),
  ('sat-english', 'SAT Reading and Writing', 'English', 'SAT', 'Craft and structure, information and ideas, standard English conventions, expression of ideas.', 64, 54, 2, true, 21),
  ('act-math', 'ACT Math', 'Math', 'ACT', '', 50, 45, 1, true, 30),
  ('act-english', 'ACT English', 'English', 'ACT', '', 35, 50, 1, true, 31),
  ('act-biology', 'ACT Science (Biology)', 'Biology', 'ACT', '', 40, 40, 1, true, 32)
on conflict (code) do nothing;

insert into public.plans (code, name, description, price_cents, currency, interval_months, features, is_active, sort_order)
values
  ('monthly', 'Monthly', 'Billed monthly', 40000, 'EGP', 1,
   '["Every EST, SAT and ACT exam", "Unlimited timed practice tests", "Explanations for every answer", "Score out of 800 and topic breakdown"]', true, 1),
  ('quarterly', '3 Months', 'Billed every 3 months', 100000, 'EGP', 3,
   '["Every EST, SAT and ACT exam", "Unlimited timed practice tests", "Explanations for every answer", "Score out of 800 and topic breakdown", "Priority access to new exams"]', true, 2),
  ('yearly', 'Yearly', 'Billed once a year', 230000, 'EGP', 12,
   '["Every EST, SAT and ACT exam", "Unlimited timed practice tests", "Explanations for every answer", "Score out of 800 and topic breakdown", "Priority access to new exams", "Price locked for 12 months"]', true, 3)
on conflict (code) do update set
  name = excluded.name, description = excluded.description, price_cents = excluded.price_cents,
  interval_months = excluded.interval_months, features = excluded.features, is_active = true, sort_order = excluded.sort_order;
