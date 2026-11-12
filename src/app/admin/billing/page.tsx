import { requestTime } from "@/lib/time";
import Link from "next/link";
import { DataTable, Empty, Panel, PageHeader, StatusBadge, Td, Th, adminDate, adminDay, money } from "@/components/admin/ui";
import { adminClient } from "@/lib/admin/server";
import { cn } from "@/lib/utils";
import { PlanForm } from "./plan-form";
import { DiscountForm } from "./discount-form";
import { reviewPayment, toggleDiscount } from "./actions";

export const metadata = { title: "Plans & payments" };

export default async function Billing({ searchParams }: PageProps<"/admin/billing">) {
  const { supabase } = await adminClient();
  const sp = await searchParams;
  const status = typeof sp.status === "string" ? sp.status : "";

  let pq = supabase
    .from("payments")
    .select("id, status, provider, merchant_reference, amount_cents, currency, failure_reason, created_at, paid_at, user_id, profiles(full_name, email), plans(name)")
    .order("created_at", { ascending: false })
    .limit(100);
  if (status) pq = pq.eq("status", status);

  const [{ data: review }, { data: codes }] = await Promise.all([
    supabase
      .from("payments")
      .select("id, provider, merchant_reference, amount_cents, currency, provider_payload, created_at, user_id, profiles(full_name, email, phone), plans(name)")
      .eq("status", "pending")
      .in("provider", ["instapay", "vodafone_cash"])
      .order("created_at"),
    supabase.from("discount_codes").select("*").order("created_at", { ascending: false }),
  ]);
  const proofPaths = (review ?? []).map((r) => (r.provider_payload as { proof_path?: string } | null)?.proof_path).filter(Boolean) as string[];
  const { data: signed } = proofPaths.length
    ? await supabase.storage.from("payment-proofs").createSignedUrls(proofPaths, 3600)
    : { data: [] as { path: string | null; signedUrl: string }[] };
  const proofUrl = new Map((signed ?? []).map((x) => [x.path, x.signedUrl]));

  const [{ data: plans }, { data: payments }, { data: subs }, { data: events }] = await Promise.all([
    supabase.from("plans").select("*").order("sort_order"),
    pq,
    supabase
      .from("subscriptions")
      .select("id, status, source, current_period_start, current_period_end, user_id, profiles(full_name, email), plans(name)")
      .order("created_at", { ascending: false })
      .limit(100),
    supabase.from("payment_events").select("id, provider, event_type, signature_valid, error, received_at").not("error", "is", null).order("received_at", { ascending: false }).limit(20),
  ]);
  const now = requestTime();

  return (
    <>
      <PageHeader title="Plans & payments" description="Subscription plans, payment history and subscription status." />

      <Panel title={`Waiting for review${review?.length ? ` (${review.length})` : ""}`} className="mb-6">
        {review?.length ? (
          <ul className="divide-y divide-line">
            {review.map((r) => {
              const u = Array.isArray(r.profiles) ? r.profiles[0] : r.profiles;
              const pl = Array.isArray(r.plans) ? r.plans[0] : r.plans;
              const payload = (r.provider_payload ?? {}) as { proof_path?: string; sender?: string; code?: string; discount_cents?: number };
              const url = payload.proof_path ? proofUrl.get(payload.proof_path) : undefined;
              return (
                <li key={r.id} className="grid gap-5 p-5 md:grid-cols-[160px_1fr_auto] md:items-start">
                  {url ? (
                    <a href={url} target="_blank" rel="noreferrer" className="block overflow-hidden rounded-[var(--radius-md)] ring-1 ring-line hover:ring-ink-400">
                      {/* eslint-disable-next-line @next/next/no-img-element -- signed private URL */}
                      <img src={url} alt="Payment screenshot" className="h-40 w-full object-cover object-top" />
                    </a>
                  ) : (
                    <div className="flex h-40 items-center justify-center rounded-[var(--radius-md)] bg-paper-2 text-xs text-ink-500">No screenshot</div>
                  )}
                  <div className="space-y-1 text-sm">
                    <p className="text-lg font-semibold text-ink-950 tabular">{money(r.amount_cents, r.currency)} · {pl?.name ?? "Plan"}</p>
                    <p>
                      <Link href={`/admin/students/${r.user_id}`} className="font-medium text-ink-950 hover:underline">{u?.full_name || u?.email}</Link>
                      <span className="text-ink-500"> · {u?.email}{u?.phone ? ` · ${u.phone}` : ""}</span>
                    </p>
                    <p className="text-ink-600">
                      {r.provider === "instapay" ? "InstaPay" : "Vodafone Cash"}
                      {payload.sender ? <> · paid from <b>{payload.sender}</b></> : null}
                      {payload.code ? <> · code <span className="font-mono">{payload.code}</span> (−{money(payload.discount_cents ?? 0, r.currency)})</> : null}
                    </p>
                    <p className="font-mono text-xs text-ink-500">{r.merchant_reference} · {adminDate.format(new Date(r.created_at))}</p>
                  </div>
                  <div className="flex flex-col gap-2 md:w-56">
                    <form action={reviewPayment}>
                      <input type="hidden" name="id" value={r.id} />
                      <input type="hidden" name="decision" value="approve" />
                      <button className="h-10 w-full rounded-[var(--radius-md)] bg-success-600 text-sm font-semibold text-white hover:bg-success-700">Approve and unlock</button>
                    </form>
                    <form action={reviewPayment} className="flex gap-2">
                      <input type="hidden" name="id" value={r.id} />
                      <input type="hidden" name="decision" value="reject" />
                      <input name="reason" placeholder="Reason (optional)" className="h-10 min-w-0 flex-1 rounded-[var(--radius-md)] px-3 text-sm ring-1 ring-inset ring-line-strong" />
                      <button className="h-10 rounded-[var(--radius-md)] px-3 text-sm font-medium text-danger-600 ring-1 ring-inset ring-danger-600/40 hover:bg-danger-50">Reject</button>
                    </form>
                  </div>
                </li>
              );
            })}
          </ul>
        ) : (
          <Empty>No payments waiting. New InstaPay and Vodafone Cash payments appear here with their screenshot.</Empty>
        )}
      </Panel>

      <div className="grid gap-6 xl:grid-cols-[1fr_420px]">
        <div className="space-y-6">
          <Panel title="Plans">
            {plans?.length ? (
              <ul className="divide-y divide-line">
                {plans.map((p) => (
                  <li key={p.id} className="px-5 py-4">
                    <details>
                      <summary className="flex cursor-pointer list-none items-center justify-between gap-4 [&::-webkit-details-marker]:hidden">
                        <span>
                          <span className="font-medium text-ink-950">{p.name}</span>
                          <span className="ml-2 font-mono text-xs text-ink-500">/checkout/{p.code}</span>
                        </span>
                        <span className="flex items-center gap-3">
                          <span className="tabular text-sm">
                            {money(p.price_cents, p.currency)} / {p.interval_months === 1 ? "month" : `${p.interval_months} months`}
                          </span>
                          <StatusBadge status={p.is_active ? "active" : "draft"} />
                        </span>
                      </summary>
                      <div className="mt-4 border-t border-line pt-4">
                        <PlanForm plan={{ ...p, features: Array.isArray(p.features) ? p.features : [] }} />
                      </div>
                    </details>
                  </li>
                ))}
              </ul>
            ) : (
              <Empty>No plans yet. Create one to show it on the pricing page.</Empty>
            )}
          </Panel>

          <Panel
            title="Payments"
            actions={
              <div className="flex gap-1 text-xs">
                {["", "succeeded", "failed", "pending", "refunded"].map((s) => (
                  <Link key={s} href={s ? `/admin/billing?status=${s}` : "/admin/billing"} className={cn("rounded-full px-2.5 py-1 capitalize", status === s ? "bg-ink-950 text-paper" : "text-ink-600 hover:bg-paper-2")}>
                    {s || "All"}
                  </Link>
                ))}
              </div>
            }
          >
            {payments?.length ? (
              <DataTable>
                <thead>
                  <tr>
                    <Th>Student</Th>
                    <Th>Plan</Th>
                    <Th>Amount</Th>
                    <Th>Status</Th>
                    <Th>Date</Th>
                  </tr>
                </thead>
                <tbody>
                  {payments.map((pay) => {
                    const u = Array.isArray(pay.profiles) ? pay.profiles[0] : pay.profiles;
                    const pl = Array.isArray(pay.plans) ? pay.plans[0] : pay.plans;
                    return (
                      <tr key={pay.id}>
                        <Td>
                          <Link href={`/admin/students/${pay.user_id}`} className="font-medium text-ink-950 hover:underline">
                            {u?.full_name || u?.email}
                          </Link>
                          <p className="font-mono text-xs text-ink-500">{pay.merchant_reference}</p>
                        </Td>
                        <Td>{pl?.name ?? "—"}</Td>
                        <Td className="tabular">{money(pay.amount_cents, pay.currency)}</Td>
                        <Td>
                          <StatusBadge status={pay.status} />
                          {pay.failure_reason ? <p className="mt-1 max-w-48 text-xs text-ink-500">{pay.failure_reason}</p> : null}
                        </Td>
                        <Td className="text-ink-500">{adminDate.format(new Date(pay.paid_at ?? pay.created_at))}</Td>
                      </tr>
                    );
                  })}
                </tbody>
              </DataTable>
            ) : (
              <Empty>No payments{status ? ` with status “${status}”` : ""}.</Empty>
            )}
          </Panel>

          <Panel title="Subscriptions">
            {subs?.length ? (
              <DataTable>
                <thead>
                  <tr>
                    <Th>Student</Th>
                    <Th>Source</Th>
                    <Th>Period</Th>
                    <Th>Status</Th>
                  </tr>
                </thead>
                <tbody>
                  {subs.map((s) => {
                    const u = Array.isArray(s.profiles) ? s.profiles[0] : s.profiles;
                    const pl = Array.isArray(s.plans) ? s.plans[0] : s.plans;
                    const lapsed = s.status === "active" && s.current_period_end && Date.parse(s.current_period_end) <= now;
                    return (
                      <tr key={s.id}>
                        <Td>
                          <Link href={`/admin/students/${s.user_id}`} className="font-medium text-ink-950 hover:underline">
                            {u?.full_name || u?.email}
                          </Link>
                        </Td>
                        <Td>{s.source === "manual_grant" ? "Manual grant" : pl?.name ?? "Payment"}</Td>
                        <Td className="text-ink-600">
                          {s.current_period_start ? adminDay.format(new Date(s.current_period_start)) : "—"} → {s.current_period_end ? adminDay.format(new Date(s.current_period_end)) : "—"}
                        </Td>
                        <Td>
                          <StatusBadge status={lapsed ? "expired" : s.status} />
                        </Td>
                      </tr>
                    );
                  })}
                </tbody>
              </DataTable>
            ) : (
              <Empty>No subscriptions yet.</Empty>
            )}
          </Panel>
        </div>

        <div className="space-y-6">
          <Panel title="Discount codes">
            <div className="border-b border-line p-5">
              <DiscountForm />
            </div>
            {codes?.length ? (
              <ul className="divide-y divide-line">
                {codes.map((c) => {
                  const expired = c.expires_at && Date.parse(c.expires_at) < now;
                  const usedUp = c.max_uses != null && c.used_count >= c.max_uses;
                  return (
                    <li key={c.id} className="flex items-center gap-3 px-5 py-3 text-sm">
                      <div className="min-w-0 flex-1">
                        <p className="font-mono font-semibold text-ink-950">{c.code}</p>
                        <p className="text-xs text-ink-500">
                          {c.kind === "percent" ? `${c.value}% off` : `${money(c.value, "EGP")} off`} · used {c.used_count}
                          {c.max_uses ? `/${c.max_uses}` : ""}
                          {c.expires_at ? ` · until ${adminDay.format(new Date(c.expires_at))}` : ""}
                        </p>
                      </div>
                      <StatusBadge status={!c.is_active ? "draft" : expired || usedUp ? "expired" : "active"} />
                      <form action={toggleDiscount}>
                        <input type="hidden" name="id" value={c.id} />
                        <input type="hidden" name="active" value={String(!c.is_active)} />
                        <button className="text-xs font-medium text-ink-600 hover:text-ink-950">{c.is_active ? "Turn off" : "Turn on"}</button>
                      </form>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <Empty>No codes yet.</Empty>
            )}
          </Panel>
          <Panel title="New plan">
            <div className="p-5">
              <PlanForm />
            </div>
          </Panel>
          <Panel title="Webhook problems">
            {events?.length ? (
              <ul className="divide-y divide-line">
                {events.map((e) => (
                  <li key={e.id} className="px-5 py-3 text-sm">
                    <p className="font-medium text-ink-900">
                      {e.signature_valid ? e.error : "Rejected: invalid signature"}
                    </p>
                    <p className="text-xs text-ink-500">
                      {e.provider} · {e.event_type ?? "—"} · {adminDate.format(new Date(e.received_at))}
                    </p>
                  </li>
                ))}
              </ul>
            ) : (
              <Empty>No webhook problems.</Empty>
            )}
          </Panel>
          <Panel title="Free access">
            <p className="px-5 py-4 text-sm text-ink-600">
              Students need a free account to take exams. Choose which exams are free on each exam&apos;s details (Access: Free or Premium).
            </p>
          </Panel>
        </div>
      </div>
    </>
  );
}
