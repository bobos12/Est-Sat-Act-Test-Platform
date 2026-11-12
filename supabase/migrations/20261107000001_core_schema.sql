-- =====================================================================
-- Northmark — core schema
-- Phase 2: accounts, content, exams, attempts, subscriptions, payments,
-- knowledge base, generation jobs, audit log.
-- =====================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------
create type public.user_role as enum ('student', 'admin');
create type public.topic_kind as enum ('topic', 'skill', 'domain');
create type public.cognitive_level as enum ('knowledge', 'application', 'reasoning', 'synthesis');
create type public.difficulty as enum ('easy', 'medium', 'hard');
create type public.content_origin as enum ('source', 'ai_generated', 'manual');
create type public.question_status as enum ('draft', 'approved', 'retired');
create type public.stimulus_kind as enum ('passage', 'figure', 'table', 'data_set', 'text');
create type public.exam_status as enum ('draft', 'in_review', 'published', 'archived');
create type public.exam_kind as enum ('full_mock', 'practice');
create type public.access_level as enum ('free', 'premium');
create type public.attempt_status as enum ('in_progress', 'submitted', 'expired');
create type public.subscription_status as enum ('pending', 'active', 'expired', 'canceled');
create type public.subscription_source as enum ('payment', 'manual_grant');
create type public.payment_status as enum ('pending', 'succeeded', 'failed', 'refunded');
create type public.document_kind as enum ('question_paper', 'answer_key', 'reference');
create type public.document_status as enum ('uploaded', 'processing', 'extracted', 'reviewed', 'failed');
create type public.job_status as enum ('queued', 'running', 'completed', 'failed');

-- ---------------------------------------------------------------------
-- Utility: updated_at
-- ---------------------------------------------------------------------
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

-- ---------------------------------------------------------------------
-- Profiles (1:1 with auth.users)
-- ---------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  full_name text not null default '',
  phone text,
  school text,
  grade text,
  role public.user_role not null default 'student',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index profiles_role_idx on public.profiles (role);
create index profiles_email_idx on public.profiles (lower(email));
create trigger profiles_touch before update on public.profiles
  for each row execute function public.touch_updated_at();

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin');
$$;

-- Create a profile automatically for every new auth user.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, coalesce(new.email, ''), coalesce(new.raw_user_meta_data ->> 'full_name', ''));
  return new;
end $$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- Students can edit their own profile, but never their role.
create or replace function public.guard_profile_role()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  -- End-user requests carry the 'authenticated' / 'anon' role; the service role and
  -- direct SQL sessions (migrations, SQL editor) are trusted.
  if new.role is distinct from old.role
     and coalesce(auth.role(), '') in ('authenticated', 'anon')
     and not public.is_admin() then
    raise exception 'Only administrators can change roles' using errcode = '42501';
  end if;
  return new;
end $$;
create trigger profiles_guard_role before update on public.profiles
  for each row execute function public.guard_profile_role();

-- ---------------------------------------------------------------------
-- Subjects and official taxonomy
-- ---------------------------------------------------------------------
create table public.subjects (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,                 -- e.g. 'est1-math'
  name text not null,                        -- e.g. 'EST I Math'
  short_name text not null,                  -- e.g. 'Math'
  test_family text not null,                 -- 'EST I' | 'EST II'
  description text not null default '',
  official_duration_minutes int not null,
  official_question_count int not null,
  official_sections int not null default 1,
  is_active boolean not null default false,  -- visible in the student library
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

create table public.topics (
  id uuid primary key default gen_random_uuid(),
  subject_id uuid not null references public.subjects (id) on delete cascade,
  kind public.topic_kind not null,
  name text not null,                        -- official name, copied from answer keys
  sort_order int not null default 0,
  unique (subject_id, kind, name)
);
create index topics_subject_idx on public.topics (subject_id, kind);

-- ---------------------------------------------------------------------
-- Knowledge base: source documents (append-only; never overwritten)
-- ---------------------------------------------------------------------
create table public.source_documents (
  id uuid primary key default gen_random_uuid(),
  subject_id uuid not null references public.subjects (id),
  kind public.document_kind not null,
  paired_document_id uuid references public.source_documents (id),
  title text not null,
  session_label text,                        -- e.g. 'January 2026'
  storage_path text not null unique,
  file_sha256 text not null unique,          -- duplicate uploads are rejected, not overwritten
  file_size_bytes bigint not null,
  page_count int,
  status public.document_status not null default 'uploaded',
  status_detail text,
  extracted_question_count int not null default 0,
  uploaded_by uuid references public.profiles (id),
  processed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index source_documents_subject_idx on public.source_documents (subject_id, created_at desc);
create trigger source_documents_touch before update on public.source_documents
  for each row execute function public.touch_updated_at();

-- Source documents can be retired by status, but never deleted or re-pointed.
create or replace function public.guard_source_document()
returns trigger language plpgsql as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'Source documents cannot be deleted from the knowledge base' using errcode = '42501';
  end if;
  if new.storage_path <> old.storage_path or new.file_sha256 <> old.file_sha256 then
    raise exception 'Source document files are immutable' using errcode = '42501';
  end if;
  return new;
end $$;
create trigger source_documents_guard before update or delete on public.source_documents
  for each row execute function public.guard_source_document();

-- ---------------------------------------------------------------------
-- Question bank
-- Content fields are JSON documents: { "blocks": [ ... ] }  (see src/lib/content.ts)
-- ---------------------------------------------------------------------
create table public.stimuli (
  id uuid primary key default gen_random_uuid(),
  subject_id uuid not null references public.subjects (id),
  kind public.stimulus_kind not null,
  title text,
  attribution text,                          -- e.g. 'by Nellie Van de Grift Sanchez [edited]'
  domain_topic_id uuid references public.topics (id),
  content jsonb not null default '{"blocks": []}',
  origin public.content_origin not null,
  source_document_id uuid references public.source_documents (id),
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger stimuli_touch before update on public.stimuli
  for each row execute function public.touch_updated_at();

create table public.questions (
  id uuid primary key default gen_random_uuid(),
  subject_id uuid not null references public.subjects (id),
  stimulus_id uuid references public.stimuli (id) on delete set null,
  stimulus_marker int,                       -- passage marker [n] this question points to
  stem jsonb not null default '{"blocks": []}',
  explanation jsonb not null default '{"blocks": []}',
  topic_id uuid references public.topics (id),
  skill_id uuid references public.topics (id),
  cognitive_level public.cognitive_level,
  difficulty public.difficulty not null default 'medium',
  origin public.content_origin not null,
  status public.question_status not null default 'draft',
  source_document_id uuid references public.source_documents (id),
  source_question_number int,
  generation_job_id uuid,
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index questions_subject_idx on public.questions (subject_id, status);
create index questions_topic_idx on public.questions (topic_id);
create index questions_source_idx on public.questions (source_document_id);
create trigger questions_touch before update on public.questions
  for each row execute function public.touch_updated_at();

create table public.question_options (
  id uuid primary key default gen_random_uuid(),
  question_id uuid not null references public.questions (id) on delete cascade,
  label char(1) not null check (label in ('A', 'B', 'C', 'D', 'E')),
  content jsonb not null default '{"blocks": []}',
  is_correct boolean not null default false,
  unique (question_id, label)
);
-- At most one correct option per question.
create unique index question_options_one_correct on public.question_options (question_id) where is_correct;

-- ---------------------------------------------------------------------
-- Exams
-- ---------------------------------------------------------------------
create table public.exams (
  id uuid primary key default gen_random_uuid(),
  subject_id uuid not null references public.subjects (id),
  slug text not null unique,
  title text not null,
  description text not null default '',
  kind public.exam_kind not null default 'practice',
  focus_topic_id uuid references public.topics (id),   -- set for single-topic practice exams
  difficulty public.difficulty,                         -- null = mixed
  access public.access_level not null default 'premium',
  status public.exam_status not null default 'draft',
  duration_minutes int not null check (duration_minutes between 1 and 300),
  question_count int not null default 0,                -- maintained by trigger
  origin public.content_origin not null default 'manual',
  generation_job_id uuid,
  sort_order int not null default 0,
  created_by uuid references public.profiles (id),
  reviewed_by uuid references public.profiles (id),
  published_at timestamptz,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index exams_library_idx on public.exams (status, subject_id, sort_order);
create trigger exams_touch before update on public.exams
  for each row execute function public.touch_updated_at();

create table public.exam_sections (
  id uuid primary key default gen_random_uuid(),
  exam_id uuid not null references public.exams (id) on delete cascade,
  position int not null,
  title text not null,                                  -- e.g. 'Module 1'
  instructions jsonb not null default '{"blocks": []}',
  unique (exam_id, position)
);

create table public.exam_questions (
  id uuid primary key default gen_random_uuid(),
  exam_id uuid not null references public.exams (id) on delete cascade,
  section_id uuid not null references public.exam_sections (id) on delete cascade,
  question_id uuid not null references public.questions (id),
  position int not null,                                -- 1-based, across the whole exam
  points numeric(5,2) not null default 1,
  unique (exam_id, question_id),
  unique (exam_id, position) deferrable initially deferred
);
create index exam_questions_exam_idx on public.exam_questions (exam_id, position);

create or replace function public.refresh_exam_question_count()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  target uuid := coalesce(new.exam_id, old.exam_id);
begin
  update public.exams
     set question_count = (select count(*) from public.exam_questions where exam_id = target)
   where id = target;
  return null;
end $$;
create trigger exam_questions_count after insert or delete on public.exam_questions
  for each row execute function public.refresh_exam_question_count();

-- Official source questions are reference material for generation only.
create or replace function public.guard_exam_question_origin()
returns trigger language plpgsql as $$
begin
  if exists (select 1 from public.questions q where q.id = new.question_id and q.origin = 'source') then
    raise exception 'Official source questions cannot be placed in student exams' using errcode = '23514';
  end if;
  return new;
end $$;
create trigger exam_questions_origin before insert or update on public.exam_questions
  for each row execute function public.guard_exam_question_origin();

-- Publishing rules: every question approved and with exactly one correct option.
-- Questions in a published exam are frozen: unpublish first to edit.
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
            or (select count(*) from public.question_options o where o.question_id = q.id and o.is_correct) <> 1
            or (select count(*) from public.question_options o where o.question_id = q.id) < 2);
    if bad > 0 then
      raise exception '% question(s) are not approved or lack exactly one correct answer', bad using errcode = '23514';
    end if;
    new.published_at := coalesce(new.published_at, now());
    new.reviewed_by := coalesce(new.reviewed_by, auth.uid());
  end if;
  if new.status = 'archived' and old.status <> 'archived' then
    new.archived_at := now();
  end if;
  return new;
end $$;
create trigger exams_guard_publish before update on public.exams
  for each row execute function public.guard_exam_publish();

-- ---------------------------------------------------------------------
-- Plans, subscriptions, payments
-- ---------------------------------------------------------------------
create table public.plans (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  description text not null default '',
  price_cents int not null check (price_cents >= 0),
  currency char(3) not null default 'EGP',
  interval_months int not null default 1 check (interval_months between 1 and 24),
  features jsonb not null default '[]',
  is_active boolean not null default false,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger plans_touch before update on public.plans
  for each row execute function public.touch_updated_at();

create table public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  plan_id uuid references public.plans (id),
  status public.subscription_status not null default 'pending',
  source public.subscription_source not null,
  current_period_start timestamptz,
  current_period_end timestamptz,
  canceled_at timestamptz,
  granted_by uuid references public.profiles (id),
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (current_period_end is null or current_period_end > current_period_start)
);
create index subscriptions_user_idx on public.subscriptions (user_id, status, current_period_end desc);
create trigger subscriptions_touch before update on public.subscriptions
  for each row execute function public.touch_updated_at();

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id),
  plan_id uuid references public.plans (id),
  subscription_id uuid references public.subscriptions (id),
  provider text not null,                    -- 'paymob', 'fawry', ...
  merchant_reference text not null,          -- our order id sent to the provider
  provider_transaction_id text,
  amount_cents int not null check (amount_cents >= 0),
  currency char(3) not null,
  status public.payment_status not null default 'pending',
  failure_reason text,
  provider_payload jsonb,
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (provider, merchant_reference)
);
create unique index payments_provider_txn_idx on public.payments (provider, provider_transaction_id)
  where provider_transaction_id is not null;
create index payments_user_idx on public.payments (user_id, created_at desc);
create trigger payments_touch before update on public.payments
  for each row execute function public.touch_updated_at();

-- Raw webhook log. Unique (provider, event_id) makes processing idempotent.
create table public.payment_events (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  event_id text not null,
  event_type text,
  signature_valid boolean not null,
  payload jsonb not null,
  payment_id uuid references public.payments (id),
  processed_at timestamptz,
  error text,
  received_at timestamptz not null default now(),
  unique (provider, event_id)
);

create or replace function public.has_premium_access(uid uuid default auth.uid())
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.subscriptions s
     where s.user_id = uid
       and s.status = 'active'
       and now() >= s.current_period_start
       and now() < s.current_period_end
  );
$$;

-- Mark lapsed subscriptions as expired (run on a schedule; access checks never rely on it).
create or replace function public.expire_subscriptions()
returns int language plpgsql security definer set search_path = public as $$
declare n int;
begin
  update public.subscriptions set status = 'expired'
   where status = 'active' and current_period_end <= now();
  get diagnostics n = row_count;
  return n;
end $$;

-- ---------------------------------------------------------------------
-- App settings (free-access configuration etc.)
-- ---------------------------------------------------------------------
create table public.app_settings (
  key text primary key,
  value jsonb not null,
  updated_by uuid references public.profiles (id),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- AI generation jobs
-- ---------------------------------------------------------------------
create table public.generation_jobs (
  id uuid primary key default gen_random_uuid(),
  subject_id uuid not null references public.subjects (id),
  topic_ids uuid[] not null default '{}',
  questions_per_exam int not null check (questions_per_exam between 1 and 120),
  exam_count int not null default 1 check (exam_count between 1 and 10),
  duration_minutes int not null,
  difficulty_mix jsonb not null default '{"easy": 30, "medium": 50, "hard": 20}',
  status public.job_status not null default 'queued',
  status_detail text,
  result_exam_ids uuid[] not null default '{}',
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  completed_at timestamptz
);
alter table public.questions add constraint questions_generation_job_fk
  foreign key (generation_job_id) references public.generation_jobs (id) on delete set null;
alter table public.exams add constraint exams_generation_job_fk
  foreign key (generation_job_id) references public.generation_jobs (id) on delete set null;

-- ---------------------------------------------------------------------
-- Admin audit log (append-only)
-- ---------------------------------------------------------------------
create table public.admin_audit_log (
  id bigint generated always as identity primary key,
  actor_id uuid references public.profiles (id),
  action text not null,
  target_type text not null,
  target_id text,
  details jsonb not null default '{}',
  created_at timestamptz not null default now()
);
create index admin_audit_target_idx on public.admin_audit_log (target_type, target_id, created_at desc);

create or replace function public.guard_append_only()
returns trigger language plpgsql as $$
begin
  raise exception '% is append-only', tg_table_name using errcode = '42501';
end $$;
create trigger admin_audit_append_only before update or delete on public.admin_audit_log
  for each row execute function public.guard_append_only();

create or replace function public.write_audit(p_action text, p_target_type text, p_target_id text, p_details jsonb default '{}')
returns void language sql security definer set search_path = public as $$
  insert into public.admin_audit_log (actor_id, action, target_type, target_id, details)
  values (auth.uid(), p_action, p_target_type, p_target_id, coalesce(p_details, '{}'));
$$;

-- Manual access grant / revoke (admin only, always audited).
create or replace function public.admin_grant_access(p_user uuid, p_days int, p_note text)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  sub_id uuid;
  start_at timestamptz;
begin
  if not public.is_admin() then
    raise exception 'Not authorized' using errcode = '42501';
  end if;
  if p_days < 1 or p_days > 730 then
    raise exception 'Days must be between 1 and 730' using errcode = '22023';
  end if;
  -- Extend from the end of any current access so grants stack.
  select greatest(now(), coalesce(max(current_period_end), now())) into start_at
    from public.subscriptions where user_id = p_user and status = 'active';
  insert into public.subscriptions (user_id, status, source, current_period_start, current_period_end, granted_by, note)
  values (p_user, 'active', 'manual_grant', start_at, start_at + make_interval(days => p_days), auth.uid(), p_note)
  returning id into sub_id;
  perform public.write_audit('access.grant', 'profile', p_user::text,
    jsonb_build_object('subscription_id', sub_id, 'days', p_days, 'note', p_note));
  return sub_id;
end $$;

create or replace function public.admin_revoke_access(p_user uuid, p_note text)
returns int language plpgsql security definer set search_path = public as $$
declare n int;
begin
  if not public.is_admin() then
    raise exception 'Not authorized' using errcode = '42501';
  end if;
  update public.subscriptions
     set status = 'canceled', canceled_at = now(),
         note = coalesce(note || E'\n', '') || 'Revoked: ' || coalesce(p_note, '')
   where user_id = p_user and status = 'active';
  get diagnostics n = row_count;
  perform public.write_audit('access.revoke', 'profile', p_user::text,
    jsonb_build_object('canceled_subscriptions', n, 'note', p_note));
  return n;
end $$;

create or replace function public.admin_set_role(p_user uuid, p_role public.user_role)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then
    raise exception 'Not authorized' using errcode = '42501';
  end if;
  if p_user = auth.uid() and p_role <> 'admin' then
    raise exception 'You cannot remove your own admin role' using errcode = '42501';
  end if;
  update public.profiles set role = p_role where id = p_user;
  perform public.write_audit('profile.role', 'profile', p_user::text, jsonb_build_object('role', p_role));
end $$;
