import Link from "next/link";
import { SubmitButton } from "@/components/admin/client";
import { btn } from "@/components/admin/btn";
import { Icon } from "@/components/admin/icons";
import { Badge, Callout, Empty, PageHeader, Panel, StatusBadge, adminDate, adminDay, money } from "@/components/admin/ui";
import { adminClient } from "@/lib/admin/server";
import { requestTime } from "@/lib/time";
import { toggleDiscount } from "./actions";
import { DiscountForm } from "./discount-form";
import { PlanForm } from "./plan-form";

export const metadata = { title: "Plans & discounts" };

export default async function Billing() {
  const { supabase } = await adminClient();
  const [{ data: plans }, { data: codes }, { data: events }, { data: sales }] = await Promise.all([
    supabase.from("plans").select("*").order("sort_order"),
    supabase.from("discount_codes").select("*").order("created_at", { ascending: false }),
    supabase.from("payment_events").select("id, provider, event_type, signature_valid, error, received_at").not("error", "is", null).order("received_at", { ascending: false }).limit(10),
    supabase.from("payments").select("plan_id, amount_cents, currency").eq("status", "succeeded").limit(50000),
  ]);
  const now = requestTime();

  const perPlan = new Map<string, { n: number; cents: number }>();
  for (const s of sales ?? []) {
    if (!s.plan_id) continue;
    const r = perPlan.get(s.plan_id) ?? { n: 0, cents: 0 };
    r.n++;
    r.cents += s.amount_cents;
    perPlan.set(s.plan_id, r);
  }

  return (
    <>
      <PageHeader
        title="Plans & discounts"
        description="What students can buy, for how much, and the discount codes they can use at checkout."
        actions={
          <Link href="/admin/payments" className={btn("secondary")}>
            <Icon name="wallet" size={15} /> Payments
          </Link>
        }
      />

      <div className="grid gap-6 xl:grid-cols-[1fr_400px]">
        <div className="space-y-6">
          <Panel title="Plans" description="Click a plan to edit it. Only visible plans appear on the pricing page." icon="crown">
            {plans?.length ? (
              <ul className="divide-y divide-line">
                {plans.map((p) => {
                  const sold = perPlan.get(p.id);
                  return (
                    <li key={p.id}>
                      <details className="group">
                        <summary className="flex cursor-pointer list-none flex-wrap items-center gap-4 px-5 py-4 transition hover:bg-paper [&::-webkit-details-marker]:hidden">
                          <Icon name="chevronRight" size={16} className="text-ink-400 transition group-open:rotate-90" />
                          <span className="min-w-0 flex-1">
                            <span className="flex items-center gap-2">
                              <span className="font-semibold text-ink-950">{p.name}</span>
                              {p.is_active ? <Badge tone="success">Visible</Badge> : <Badge>Hidden</Badge>}
                            </span>
                            <span className="text-xs text-ink-500">
                              <span className="font-mono">/checkout/{p.code}</span> · {sold ? `${sold.n} sold · ${money(sold.cents, p.currency)}` : "no sales yet"}
                            </span>
                          </span>
                          <span className="text-right">
                            <span className="block text-lg font-semibold tabular text-ink-950">{money(p.price_cents, p.currency)}</span>
                            <span className="text-xs text-ink-500">{p.interval_months === 1 ? "per month" : `for ${p.interval_months} months`}</span>
                          </span>
                        </summary>
                        <div className="border-t border-line bg-paper/50 px-5 py-5">
                          <PlanForm plan={{ ...p, features: Array.isArray(p.features) ? p.features : [] }} />
                        </div>
                      </details>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <Empty icon="crown">No plans yet. Create one to show it on the pricing page.</Empty>
            )}
          </Panel>

          <Panel title="Create a new plan" icon="plus">
            <div className="p-5">
              <PlanForm />
            </div>
          </Panel>
        </div>

        <div className="space-y-6">
          <Panel title="Discount codes" icon="tag">
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
                        <p className="flex items-center gap-2">
                          <span className="font-mono font-semibold text-ink-950">{c.code}</span>
                          <StatusBadge status={!c.is_active ? "draft" : expired || usedUp ? "expired" : "active"} label={!c.is_active ? "Off" : expired ? "Expired" : usedUp ? "Used up" : "Active"} />
                        </p>
                        <p className="text-xs text-ink-500">
                          {c.kind === "percent" ? `${c.value}% off` : `${money(c.value, "EGP")} off`} · used {c.used_count}
                          {c.max_uses ? ` of ${c.max_uses}` : ""}
                          {c.expires_at ? ` · until ${adminDay.format(new Date(c.expires_at))}` : ""}
                        </p>
                      </div>
                      <form action={toggleDiscount}>
                        <input type="hidden" name="id" value={c.id} />
                        <input type="hidden" name="active" value={String(!c.is_active)} />
                        <SubmitButton size="xs" variant={c.is_active ? "secondary" : "success"} pendingLabel="Saving…">
                          {c.is_active ? "Turn off" : "Turn on"}
                        </SubmitButton>
                      </form>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <Empty icon="tag">No codes yet.</Empty>
            )}
          </Panel>

          <Panel title="Free vs premium exams" icon="lock">
            <div className="space-y-3 p-5 text-sm text-ink-600">
              <p>Anyone with a free account can take free exams. Premium exams need an active plan or a grant.</p>
              <div className="flex flex-wrap gap-2">
                <Link href="/admin/exams?access=free" className={btn("secondary", "sm")}>
                  See free exams
                </Link>
                <Link href="/admin/exams?access=premium" className={btn("secondary", "sm")}>
                  See premium exams
                </Link>
              </div>
            </div>
          </Panel>

          <Panel title="Card payment problems" description="Errors from the payment provider's notifications" icon="alert">
            {events?.length ? (
              <ul className="divide-y divide-line">
                {events.map((e) => (
                  <li key={e.id} className="px-5 py-3 text-sm">
                    <p className="font-medium text-ink-900">{e.signature_valid ? e.error : "Rejected: invalid signature"}</p>
                    <p className="text-xs text-ink-500">
                      {e.provider} · {e.event_type ?? "—"} · {adminDate.format(new Date(e.received_at))}
                    </p>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="p-5">
                <Callout tone="success">No problems reported.</Callout>
              </div>
            )}
          </Panel>
        </div>
      </div>
    </>
  );
}
