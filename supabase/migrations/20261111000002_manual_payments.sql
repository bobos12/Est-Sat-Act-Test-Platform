-- Manual payments (InstaPay / Vodafone Cash with a screenshot) reviewed by an admin, plus discount codes.

-- ---------------------------------------------------------------------
-- Discount codes (admin-managed). Students never read this table directly.
-- ---------------------------------------------------------------------
create table if not exists public.discount_codes (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code = upper(code) and length(code) between 3 and 30),
  kind text not null check (kind in ('percent', 'amount')),
  value int not null check (value > 0),            -- percent (1-100) or amount in cents
  expires_at timestamptz,
  max_uses int check (max_uses is null or max_uses > 0),
  used_count int not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  check (kind <> 'percent' or value <= 100)
);
alter table public.discount_codes enable row level security;
drop policy if exists discount_codes_admin on public.discount_codes;
create policy discount_codes_admin on public.discount_codes for all using (public.is_admin()) with check (public.is_admin());

-- Price after a code, or an error code the UI turns into a message.
create or replace function public.quote_plan(p_plan_code text, p_code text default null)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  pl public.plans;
  dc public.discount_codes;
  off int := 0;
begin
  select * into pl from public.plans where code = p_plan_code and is_active;
  if not found then
    return jsonb_build_object('error', 'PLAN_NOT_FOUND');
  end if;
  if coalesce(trim(p_code), '') <> '' then
    select * into dc from public.discount_codes where code = upper(trim(p_code));
    if not found or not dc.is_active then
      return jsonb_build_object('error', 'CODE_INVALID');
    end if;
    if dc.expires_at is not null and dc.expires_at < now() then
      return jsonb_build_object('error', 'CODE_EXPIRED');
    end if;
    if dc.max_uses is not null and dc.used_count >= dc.max_uses then
      return jsonb_build_object('error', 'CODE_USED_UP');
    end if;
    off := case when dc.kind = 'percent' then round(pl.price_cents * dc.value / 100.0) else dc.value end;
    off := least(off, pl.price_cents);
  end if;
  return jsonb_build_object(
    'plan_id', pl.id, 'plan_name', pl.name, 'currency', pl.currency,
    'subtotal_cents', pl.price_cents, 'discount_cents', off, 'total_cents', pl.price_cents - off,
    'code', case when off > 0 then upper(trim(p_code)) end
  );
end $$;
revoke execute on function public.quote_plan(text, text) from public, anon;
grant execute on function public.quote_plan(text, text) to authenticated;

-- ---------------------------------------------------------------------
-- Payment screenshots: private bucket, each student writes only into their own folder.
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('payment-proofs', 'payment-proofs', false, 8388608, array['image/png', 'image/jpeg', 'image/webp', 'image/heic'])
on conflict (id) do nothing;

drop policy if exists payment_proofs_owner_insert on storage.objects;
create policy payment_proofs_owner_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'payment-proofs' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists payment_proofs_read on storage.objects;
create policy payment_proofs_read on storage.objects for select
  using (bucket_id = 'payment-proofs' and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin()));

-- ---------------------------------------------------------------------
-- Student submits a manual payment. The amount is always computed here, never sent by the browser.
-- ---------------------------------------------------------------------
create or replace function public.submit_manual_payment(
  p_plan_code text, p_method text, p_proof_path text, p_sender text default null, p_code text default null
)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  q jsonb;
  pay_id uuid;
begin
  if auth.uid() is null then
    raise exception 'NOT_SIGNED_IN' using errcode = '42501';
  end if;
  if p_method not in ('instapay', 'vodafone_cash') then
    raise exception 'BAD_METHOD' using errcode = '22023';
  end if;
  if p_proof_path is null or split_part(p_proof_path, '/', 1) <> auth.uid()::text then
    raise exception 'BAD_PROOF' using errcode = '22023';
  end if;
  if exists (select 1 from public.payments where user_id = auth.uid() and status = 'pending'
               and provider in ('instapay', 'vodafone_cash')) then
    raise exception 'ALREADY_PENDING' using errcode = '23505';
  end if;
  q := public.quote_plan(p_plan_code, p_code);
  if q ? 'error' then
    raise exception '%', q->>'error' using errcode = '22023';
  end if;
  insert into public.payments (user_id, plan_id, provider, merchant_reference, amount_cents, currency, status, provider_payload)
  values (auth.uid(), (q->>'plan_id')::uuid, p_method, 'MAN-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10)),
          (q->>'total_cents')::int, q->>'currency', 'pending',
          jsonb_build_object('proof_path', p_proof_path, 'sender', nullif(trim(p_sender), ''), 'code', q->>'code',
                             'subtotal_cents', q->'subtotal_cents', 'discount_cents', q->'discount_cents'))
  returning id into pay_id;
  return pay_id;
end $$;
revoke execute on function public.submit_manual_payment(text, text, text, text, text) from public, anon;
grant execute on function public.submit_manual_payment(text, text, text, text, text) to authenticated;

-- ---------------------------------------------------------------------
-- Admin approves (access starts now) or rejects a manual payment.
-- ---------------------------------------------------------------------
create or replace function public.admin_review_payment(p_payment uuid, p_approve boolean, p_reason text default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  pay public.payments;
  sub_id uuid;
begin
  if not public.is_admin() then
    raise exception 'Not authorized' using errcode = '42501';
  end if;
  select * into pay from public.payments where id = p_payment for update;
  if not found then
    raise exception 'PAYMENT_NOT_FOUND' using errcode = 'P0002';
  end if;
  if pay.status <> 'pending' then
    return pay.subscription_id;
  end if;
  if p_approve then
    sub_id := public.apply_payment_success(pay.id, coalesce(pay.provider_transaction_id, pay.merchant_reference),
                                           pay.amount_cents, pay.currency,
                                           coalesce(pay.provider_payload, '{}') || jsonb_build_object('reviewed_by', auth.uid()));
    if pay.provider_payload->>'code' is not null then
      update public.discount_codes set used_count = used_count + 1 where code = pay.provider_payload->>'code';
    end if;
    return sub_id;
  end if;
  perform public.apply_payment_failure(pay.id, null, coalesce(nullif(trim(p_reason), ''), 'Payment could not be confirmed'),
                                       coalesce(pay.provider_payload, '{}') || jsonb_build_object('reviewed_by', auth.uid()));
  return null;
end $$;
revoke execute on function public.admin_review_payment(uuid, boolean, text) from public, anon;
grant execute on function public.admin_review_payment(uuid, boolean, text) to authenticated;
