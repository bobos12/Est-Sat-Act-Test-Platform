-- =====================================================================
-- Northmark — row level security & function privileges
-- Principle: students read only their own records and published catalog
-- data. Answer keys, the question bank and the knowledge base are
-- admin-only; students reach exam content through security-definer RPCs.
-- =====================================================================

alter table public.profiles          enable row level security;
alter table public.subjects          enable row level security;
alter table public.topics            enable row level security;
alter table public.source_documents  enable row level security;
alter table public.stimuli           enable row level security;
alter table public.questions         enable row level security;
alter table public.question_options  enable row level security;
alter table public.exams             enable row level security;
alter table public.exam_sections     enable row level security;
alter table public.exam_questions    enable row level security;
alter table public.exam_attempts     enable row level security;
alter table public.attempt_answers   enable row level security;
alter table public.plans             enable row level security;
alter table public.subscriptions     enable row level security;
alter table public.payments          enable row level security;
alter table public.payment_events    enable row level security;
alter table public.app_settings      enable row level security;
alter table public.generation_jobs   enable row level security;
alter table public.admin_audit_log   enable row level security;

-- Profiles
create policy profiles_self_read   on public.profiles for select using (id = auth.uid() or public.is_admin());
create policy profiles_self_update on public.profiles for update using (id = auth.uid() or public.is_admin())
  with check (id = auth.uid() or public.is_admin());

-- Public catalog
create policy subjects_read on public.subjects for select using (is_active or public.is_admin());
create policy subjects_admin on public.subjects for all using (public.is_admin()) with check (public.is_admin());
create policy topics_read on public.topics for select using (true);
create policy topics_admin on public.topics for all using (public.is_admin()) with check (public.is_admin());

create policy exams_read on public.exams for select using (status = 'published' or public.is_admin());
create policy exams_admin on public.exams for all using (public.is_admin()) with check (public.is_admin());
create policy exam_sections_read on public.exam_sections for select
  using (public.is_admin() or exists (select 1 from public.exams e where e.id = exam_id and e.status = 'published'));
create policy exam_sections_admin on public.exam_sections for all using (public.is_admin()) with check (public.is_admin());

create policy plans_read on public.plans for select using (is_active or public.is_admin());
create policy plans_admin on public.plans for all using (public.is_admin()) with check (public.is_admin());

-- Admin-only content
create policy source_documents_admin on public.source_documents for all using (public.is_admin()) with check (public.is_admin());
create policy stimuli_admin          on public.stimuli          for all using (public.is_admin()) with check (public.is_admin());
create policy questions_admin        on public.questions        for all using (public.is_admin()) with check (public.is_admin());
create policy question_options_admin on public.question_options for all using (public.is_admin()) with check (public.is_admin());
create policy exam_questions_admin   on public.exam_questions   for all using (public.is_admin()) with check (public.is_admin());
create policy app_settings_admin     on public.app_settings     for all using (public.is_admin()) with check (public.is_admin());
create policy generation_jobs_admin  on public.generation_jobs  for all using (public.is_admin()) with check (public.is_admin());
create policy audit_admin_read       on public.admin_audit_log  for select using (public.is_admin());

-- Student-owned, read-only from the client (writes via RPC / service role)
create policy attempts_owner_read on public.exam_attempts for select using (user_id = auth.uid() or public.is_admin());
create policy answers_owner_read on public.attempt_answers for select
  using (public.is_admin() or exists (select 1 from public.exam_attempts a where a.id = attempt_id and a.user_id = auth.uid()));
create policy subscriptions_owner_read on public.subscriptions for select using (user_id = auth.uid() or public.is_admin());
create policy payments_owner_read on public.payments for select using (user_id = auth.uid() or public.is_admin());
-- payment_events: no policies → service role only.

-- ---------------------------------------------------------------------
-- Function privileges: internal helpers are not callable from the API.
-- ---------------------------------------------------------------------
revoke execute on function public.finalize_attempt(uuid, public.attempt_status) from public, anon, authenticated;
revoke execute on function public.close_if_expired(uuid) from public, anon, authenticated;
revoke execute on function public.close_expired_attempts() from public, anon, authenticated;
revoke execute on function public.expire_subscriptions() from public, anon, authenticated;
revoke execute on function public.write_audit(text, text, text, jsonb) from public, anon, authenticated;
revoke execute on function public.handle_new_user() from public, anon, authenticated;

revoke execute on function public.start_attempt(uuid) from public, anon;
revoke execute on function public.get_attempt_payload(uuid) from public, anon;
revoke execute on function public.save_answer(uuid, uuid, uuid, boolean, boolean) from public, anon;
revoke execute on function public.submit_attempt(uuid) from public, anon;
revoke execute on function public.get_attempt_review(uuid) from public, anon;
grant execute on function public.start_attempt(uuid) to authenticated;
grant execute on function public.get_attempt_payload(uuid) to authenticated;
grant execute on function public.save_answer(uuid, uuid, uuid, boolean, boolean) to authenticated;
grant execute on function public.submit_attempt(uuid) to authenticated;
grant execute on function public.get_attempt_review(uuid) to authenticated;

revoke execute on function public.admin_grant_access(uuid, int, text) from public, anon;
revoke execute on function public.admin_revoke_access(uuid, text) from public, anon;
revoke execute on function public.admin_set_role(uuid, public.user_role) from public, anon;
grant execute on function public.admin_grant_access(uuid, int, text) to authenticated;   -- checks is_admin() inside
grant execute on function public.admin_revoke_access(uuid, text) to authenticated;
grant execute on function public.admin_set_role(uuid, public.user_role) to authenticated;
