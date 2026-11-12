-- =====================================================================
-- Northmark — admin statistics and payment activation
-- =====================================================================

-- Overview numbers for the admin dashboard (admin only).
create or replace function public.admin_dashboard_stats()
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then
    raise exception 'Not authorized' using errcode = '42501';
  end if;
  return jsonb_build_object(
    'students', (select count(*) from public.profiles where role = 'student'),
    'students_30d', (select count(*) from public.profiles where role = 'student' and created_at > now() - interval '30 days'),
    'active_subscriptions', (select count(distinct user_id) from public.subscriptions
                              where status = 'active' and now() >= current_period_start and now() < current_period_end),
    'expired_subscriptions', (select count(*) from public.subscriptions
                               where status = 'expired' or (status = 'active' and current_period_end <= now())),
    'published_exams', (select count(*) from public.exams where status = 'published'),
    'exams_in_review', (select count(*) from public.exams where status in ('draft', 'in_review')),
    'attempts', (select count(*) from public.exam_attempts),
    'attempts_30d', (select count(*) from public.exam_attempts where started_at > now() - interval '30 days'),
    'revenue_by_currency', (select coalesce(jsonb_object_agg(currency, total), '{}') from (
                              select currency, sum(amount_cents) as total from public.payments
                               where status = 'succeeded' group by currency) r),
    'revenue_30d_by_currency', (select coalesce(jsonb_object_agg(currency, total), '{}') from (
                              select currency, sum(amount_cents) as total from public.payments
                               where status = 'succeeded' and paid_at > now() - interval '30 days' group by currency) r),
    'payments_succeeded', (select count(*) from public.payments where status = 'succeeded'),
    'payments_failed', (select count(*) from public.payments where status = 'failed'),
    'payments_pending', (select count(*) from public.payments where status = 'pending')
  );
end $$;

-- ---------------------------------------------------------------------
-- Payment outcome (called only by the server with the service role,
-- after a provider webhook has been verified). Idempotent.
-- ---------------------------------------------------------------------
create or replace function public.apply_payment_success(
  p_payment uuid,
  p_provider_transaction_id text,
  p_amount_cents int,
  p_currency text,
  p_payload jsonb
)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  pay public.payments;
  pl public.plans;
  start_at timestamptz;
  sub_id uuid;
begin
  select * into pay from public.payments where id = p_payment for update;
  if not found then
    raise exception 'PAYMENT_NOT_FOUND' using errcode = 'P0002';
  end if;
  if pay.status = 'succeeded' then
    return pay.subscription_id;                       -- duplicate webhook
  end if;
  -- Never trust a callback that disagrees with what we asked the provider to charge.
  if p_amount_cents <> pay.amount_cents or upper(p_currency) <> upper(pay.currency) then
    update public.payments
       set status = 'failed', failure_reason = format('Amount mismatch: expected %s %s, got %s %s',
             pay.amount_cents, pay.currency, p_amount_cents, p_currency),
           provider_transaction_id = p_provider_transaction_id, provider_payload = p_payload
     where id = pay.id;
    return null;
  end if;

  select * into pl from public.plans where id = pay.plan_id;
  if not found then
    raise exception 'PLAN_NOT_FOUND' using errcode = 'P0002';
  end if;

  -- Renewals extend from the end of current access, so paying early never loses days.
  select greatest(now(), coalesce(max(current_period_end), now())) into start_at
    from public.subscriptions where user_id = pay.user_id and status = 'active';

  insert into public.subscriptions (user_id, plan_id, status, source, current_period_start, current_period_end)
  values (pay.user_id, pl.id, 'active', 'payment', start_at, start_at + make_interval(months => pl.interval_months))
  returning id into sub_id;

  update public.payments
     set status = 'succeeded', paid_at = now(), subscription_id = sub_id,
         provider_transaction_id = p_provider_transaction_id, provider_payload = p_payload, failure_reason = null
   where id = pay.id;
  return sub_id;
end $$;

create or replace function public.apply_payment_failure(
  p_payment uuid,
  p_provider_transaction_id text,
  p_reason text,
  p_payload jsonb
)
returns void language plpgsql security definer set search_path = public as $$
begin
  update public.payments
     set status = 'failed', failure_reason = p_reason,
         provider_transaction_id = coalesce(p_provider_transaction_id, provider_transaction_id),
         provider_payload = p_payload
   where id = p_payment and status = 'pending';   -- a success is never downgraded by a late failure
end $$;

revoke execute on function public.apply_payment_success(uuid, text, int, text, jsonb) from public, anon, authenticated;
revoke execute on function public.apply_payment_failure(uuid, text, text, jsonb) from public, anon, authenticated;
revoke execute on function public.admin_dashboard_stats() from public, anon;
grant execute on function public.admin_dashboard_stats() to authenticated;   -- checks is_admin() inside

-- ---------------------------------------------------------------------
-- Admin: replace an exam's question order in one step (admin only).
-- ---------------------------------------------------------------------
create or replace function public.admin_reorder_exam(p_exam uuid, p_exam_question_ids uuid[])
returns void language plpgsql security definer set search_path = public as $$
declare
  i int;
begin
  if not public.is_admin() then
    raise exception 'Not authorized' using errcode = '42501';
  end if;
  if (select status from public.exams where id = p_exam) = 'published' then
    raise exception 'Unpublish the exam before reordering questions' using errcode = '23514';
  end if;
  set constraints all deferred;
  for i in 1 .. coalesce(array_length(p_exam_question_ids, 1), 0) loop
    update public.exam_questions set position = i where id = p_exam_question_ids[i] and exam_id = p_exam;
  end loop;
end $$;
revoke execute on function public.admin_reorder_exam(uuid, uuid[]) from public, anon;
grant execute on function public.admin_reorder_exam(uuid, uuid[]) to authenticated;

-- Published exams are frozen: question content cannot change while students can take them.
create or replace function public.guard_published_question()
returns trigger language plpgsql as $$
declare
  qid uuid;
begin
  if tg_table_name = 'questions' then
    -- Status changes (approve/retire) are allowed; content changes are not.
    if new.stem = old.stem and new.explanation = old.explanation
       and new.stimulus_id is not distinct from old.stimulus_id then
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
create trigger questions_guard_published before update on public.questions
  for each row execute function public.guard_published_question();
create trigger question_options_guard_published before insert or update or delete on public.question_options
  for each row execute function public.guard_published_question();

-- Notes for reviewers (e.g. "independent check disagreed with the key"). Never shown to students.
alter table public.questions add column review_notes text;
