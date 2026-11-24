import Link from "next/link";
import { SearchBox } from "@/components/admin/client";
import { btn } from "@/components/admin/btn";
import { Icon } from "@/components/admin/icons";
import { RefundButton, ReviewCard, type ReviewItem } from "@/components/admin/payment-review";
import {
  Avatar,
  Badge,
  DataTable,
  Empty,
  FilterTabs,
  PageHeader,
  Pagination,
  Panel,
  StatCard,
  StatusBadge,
  Td,
  Th,
  adminDate,
  adminDay,
  money,
  one,
  providerName,
} from "@/components/admin/ui";
import { adminClient } from "@/lib/admin/server";
import { searchFilter } from "@/lib/admin/students";
import { requestTime } from "@/lib/time";

export const metadata = { title: "Payments" };

const PAGE = 50;
const VIEWS = ["review", "all", "subscriptions"] as const;
type View = (typeof VIEWS)[number];
const PAY_STATUS = ["", "succeeded", "pending", "failed", "refunded"] as const;
const METHODS = ["", "instapay", "vodafone_cash", "paymob"] as const;
const SUB_STATUS = ["live", "expiring", "ended", "manual", "all"] as const;

function revenue(map: Record<string, number> | undefined) {
  const e = Object.entries(map ?? {});
  return e.length ? e.map(([c, v]) => money(v, c)).join(" · ") : money(0, "EGP");
}

export default async function Payments({ searchParams }: PageProps<"/admin/payments">) {
  const { supabase } = await adminClient();
  const sp = await searchParams;
  const str = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string) : "");
  const view: View = (VIEWS as readonly string[]).includes(str("view")) ? (str("view") as View) : "review";
  const status = (PAY_STATUS as readonly string[]).includes(str("status")) ? str("status") : "";
  const method = (METHODS as readonly string[]).includes(str("method")) ? str("method") : "";
  const sub = (SUB_STATUS as readonly string[]).includes(str("sub")) ? str("sub") : "live";
  const q = str("q").trim().slice(0, 80);
  const page = Math.max(1, Number(sp.page) || 1);
  const now = requestTime();
  const nowIso = new Date(now).toISOString();

  const link = (patch: Record<string, string>) => {
    const next = new URLSearchParams({ view, ...(status ? { status } : {}), ...(method ? { method } : {}), ...(sub !== "live" ? { sub } : {}), ...(q ? { q } : {}), ...patch });
    for (const [k, v] of [...next]) if (!v || (k === "view" && v === "review")) next.delete(k);
    return `/admin/payments${next.size ? `?${next}` : ""}`;
  };

  const [{ data: stats }, { count: reviewCount }, { count: failed30 }] = await Promise.all([
    supabase.rpc("admin_dashboard_stats"),
    supabase.from("payments").select("id", { count: "exact", head: true }).eq("status", "pending").in("provider", ["instapay", "vodafone_cash"]),
    supabase.from("payments").select("id", { count: "exact", head: true }).eq("status", "failed").gte("created_at", new Date(now - 30 * 86_400_000).toISOString()),
  ]);
  const s = (stats ?? {}) as { revenue_by_currency?: Record<string, number>; revenue_30d_by_currency?: Record<string, number>; active_subscriptions?: number; payments_succeeded?: number };

  // Student search → ids (shared by the payments and subscriptions lists).
  let studentIds: string[] | null = null;
  if (q && view !== "review") {
    const f = searchFilter(q);
    const { data } = f ? await supabase.from("profiles").select("id").or(f).limit(200) : { data: [] };
    studentIds = (data ?? []).map((r) => r.id);
  }

  let body: React.ReactNode;

  if (view === "review") {
    const { data: review } = await supabase
      .from("payments")
      .select("id, provider, merchant_reference, amount_cents, currency, provider_payload, created_at, user_id, profiles(full_name, email, phone), plans(name)")
      .eq("status", "pending")
      .in("provider", ["instapay", "vodafone_cash"])
      .order("created_at");
    const paths = (review ?? []).map((r) => (r.provider_payload as { proof_path?: string } | null)?.proof_path).filter(Boolean) as string[];
    const { data: signed } = paths.length ? await supabase.storage.from("payment-proofs").createSignedUrls(paths, 3600) : { data: [] };
    const proof = new Map((signed ?? []).map((x) => [x.path, x.signedUrl]));
    const items: ReviewItem[] = (review ?? []).map((r) => {
      const payload = (r.provider_payload ?? {}) as ReviewItem["payload"] & { proof_path?: string };
      return { ...r, student: one(r.profiles), planName: one(r.plans)?.name, payload, proofUrl: payload.proof_path ? proof.get(payload.proof_path) : undefined };
    });
    body = (
      <Panel title="Waiting for your review" description="Oldest first. Approving unlocks premium immediately; the student sees the result on their account." icon="alert">
        {items.length ? (
          <ul className="divide-y divide-line">
            {items.map((r) => (
              <ReviewCard key={r.id} r={r} back="/admin/payments" />
            ))}
          </ul>
        ) : (
          <Empty icon="check">Nothing to review. New InstaPay and Vodafone Cash payments appear here with their screenshot.</Empty>
        )}
      </Panel>
    );
  } else if (view === "all") {
    let query = supabase
      .from("payments")
      .select("id, status, provider, merchant_reference, amount_cents, currency, failure_reason, created_at, paid_at, user_id, profiles(full_name, email), plans(name)", { count: "exact" })
      .order("created_at", { ascending: false })
      .range((page - 1) * PAGE, page * PAGE - 1);
    if (status) query = query.eq("status", status as "succeeded");
    if (method) query = query.eq("provider", method);
    if (q) {
      const ref = q.replace(/[%,()*\\]/g, " ").trim();
      query = studentIds?.length ? query.or(`merchant_reference.ilike.%${ref}%,user_id.in.(${studentIds.join(",")})`) : query.ilike("merchant_reference", `%${ref}%`);
    }
    const { data: rows, count } = await query;
    const total = count ?? 0;
    body = (
      <Panel>
        <div className="flex flex-col gap-3 border-b border-line p-4 xl:flex-row xl:items-center">
          <FilterTabs
            items={PAY_STATUS.map((k) => ({
              label: k ? { succeeded: "Paid", pending: "Pending", failed: "Failed", refunded: "Refunded" }[k] : "All",
              href: link({ status: k, page: "" }),
              active: status === k,
            }))}
          />
          <FilterTabs items={METHODS.map((k) => ({ label: k ? providerName(k) : "Any method", href: link({ method: k, page: "" }), active: method === k }))} />
          <SearchBox placeholder="Student or reference" className="flex-1 xl:max-w-xs" />
        </div>
        {rows?.length ? (
          <DataTable>
            <thead>
              <tr>
                <Th>Student</Th>
                <Th>Amount</Th>
                <Th>Plan &amp; method</Th>
                <Th>Status</Th>
                <Th>Date</Th>
                <Th className="w-20" />
              </tr>
            </thead>
            <tbody>
              {rows.map((pay) => {
                const u = one(pay.profiles);
                return (
                  <tr key={pay.id} className="hover:bg-paper">
                    <Td>
                      <Link href={`/admin/students/${pay.user_id}?tab=payments`} className="flex items-center gap-2.5">
                        <Avatar name={u?.full_name || u?.email || "?"} size={30} />
                        <span className="min-w-0">
                          <span className="block truncate font-medium text-ink-950 hover:text-mark-600">{u?.full_name || u?.email}</span>
                          <span className="block truncate font-mono text-[0.6875rem] text-ink-500">{pay.merchant_reference}</span>
                        </span>
                      </Link>
                    </Td>
                    <Td className="font-semibold tabular text-ink-950">{money(pay.amount_cents, pay.currency)}</Td>
                    <Td>
                      {one(pay.plans)?.name ?? "—"}
                      <p className="text-xs text-ink-500">{providerName(pay.provider)}</p>
                    </Td>
                    <Td>
                      <StatusBadge status={pay.status} />
                      {pay.failure_reason ? <p className="mt-1 max-w-56 text-xs text-ink-500">{pay.failure_reason}</p> : null}
                    </Td>
                    <Td className="whitespace-nowrap text-ink-600">{adminDate.format(new Date(pay.paid_at ?? pay.created_at))}</Td>
                    <Td className="text-right">
                      {pay.status === "succeeded" ? (
                        <RefundButton id={pay.id} label={money(pay.amount_cents, pay.currency)} back={link({})} />
                      ) : pay.status === "pending" && (pay.provider === "instapay" || pay.provider === "vodafone_cash") ? (
                        <Link href="/admin/payments" className={btn("secondary", "xs")}>
                          Review
                        </Link>
                      ) : null}
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </DataTable>
        ) : (
          <Empty icon="wallet">{q ? `No payments match “${q}”.` : "No payments with these filters."}</Empty>
        )}
        <div className="border-t border-line">
          <Pagination page={page} pages={Math.max(1, Math.ceil(total / PAGE))} href={(p) => link({ page: String(p) })} total={total} />
        </div>
      </Panel>
    );
  } else {
    const in7 = new Date(now + 7 * 86_400_000).toISOString();
    let query = supabase
      .from("subscriptions")
      .select("id, status, source, current_period_start, current_period_end, canceled_at, note, user_id, profiles!subscriptions_user_id_fkey(full_name, email), plans(name)", { count: "exact" })
      .range((page - 1) * PAGE, page * PAGE - 1);
    if (sub === "live") query = query.eq("status", "active").gt("current_period_end", nowIso).order("current_period_end");
    else if (sub === "expiring") query = query.eq("status", "active").gt("current_period_end", nowIso).lte("current_period_end", in7).order("current_period_end");
    else if (sub === "ended") query = query.or(`status.in.(expired,canceled),current_period_end.lte.${nowIso}`).order("current_period_end", { ascending: false });
    else if (sub === "manual") query = query.eq("source", "manual_grant").order("created_at", { ascending: false });
    else query = query.order("created_at", { ascending: false });
    if (studentIds) query = query.in("user_id", studentIds.length ? studentIds : ["00000000-0000-0000-0000-000000000000"]);
    const { data: rows, count, error } = await query;
    if (error) throw new Error(error.message);
    const total = count ?? 0;
    body = (
      <Panel>
        <div className="flex flex-col gap-3 border-b border-line p-4 lg:flex-row lg:items-center">
          <FilterTabs
            items={SUB_STATUS.map((k) => ({
              label: { live: "Active now", expiring: "Ending in 7 days", ended: "Ended", manual: "Granted by admin", all: "All" }[k],
              href: link({ sub: k === "live" ? "" : k, page: "" }),
              active: sub === k,
            }))}
          />
          <SearchBox placeholder="Search student" className="flex-1 lg:max-w-xs" />
        </div>
        {rows?.length ? (
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
              {rows.map((r) => {
                const u = one(r.profiles);
                const live = r.status === "active" && r.current_period_end && Date.parse(r.current_period_end) > now;
                const days = r.current_period_end ? Math.ceil((Date.parse(r.current_period_end) - now) / 86_400_000) : 0;
                return (
                  <tr key={r.id} className="hover:bg-paper">
                    <Td>
                      <Link href={`/admin/students/${r.user_id}?tab=payments`} className="flex items-center gap-2.5">
                        <Avatar name={u?.full_name || u?.email || "?"} size={30} />
                        <span className="min-w-0">
                          <span className="block truncate font-medium text-ink-950 hover:text-mark-600">{u?.full_name || u?.email}</span>
                          <span className="block truncate text-xs text-ink-500">{u?.email}</span>
                        </span>
                      </Link>
                    </Td>
                    <Td>
                      {r.source === "manual_grant" ? <Badge tone="neutral">Granted by admin</Badge> : one(r.plans)?.name ?? "Payment"}
                      {r.note ? <p className="mt-1 max-w-64 truncate text-xs text-ink-500" title={r.note}>“{r.note}”</p> : null}
                    </Td>
                    <Td className="whitespace-nowrap text-ink-600">
                      {r.current_period_start ? adminDay.format(new Date(r.current_period_start)) : "—"} → {r.current_period_end ? adminDay.format(new Date(r.current_period_end)) : "—"}
                      {live ? <p className={days <= 7 ? "text-xs font-medium text-warning-700" : "text-xs text-ink-500"}>{days <= 1 ? "ends today" : `${days} days left`}</p> : null}
                    </Td>
                    <Td>
                      <StatusBadge status={r.status === "active" && !live ? "expired" : r.status} />
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </DataTable>
        ) : (
          <Empty icon="crown">No subscriptions in this group.</Empty>
        )}
        <div className="border-t border-line">
          <Pagination page={page} pages={Math.max(1, Math.ceil(total / PAGE))} href={(p) => link({ page: String(p) })} total={total} />
        </div>
      </Panel>
    );
  }

  return (
    <>
      <PageHeader
        title="Payments"
        description="Approve manual payments, look up any payment, and see who has premium and until when."
        actions={
          <Link href="/admin/billing" className={btn("secondary")}>
            <Icon name="tag" size={15} /> Plans &amp; discount codes
          </Link>
        }
      />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="To review" value={reviewCount ?? 0} note={reviewCount ? "Screenshots waiting" : "All clear"} href={link({ view: "review", page: "" })} icon="alert" tone={reviewCount ? "danger" : "success"} active={view === "review"} />
        <StatCard label="Revenue · 30 days" value={revenue(s.revenue_30d_by_currency)} note={`${revenue(s.revenue_by_currency)} all time`} href={link({ view: "all", status: "succeeded", page: "" })} icon="wallet" tone="brand" />
        <StatCard label="Premium now" value={s.active_subscriptions ?? 0} note="students with access" href={link({ view: "subscriptions", sub: "", page: "" })} icon="crown" tone="success" active={view === "subscriptions"} />
        <StatCard label="Failed · 30 days" value={failed30 ?? 0} note="payments that didn't go through" href={link({ view: "all", status: "failed", page: "" })} icon="x" tone={failed30 ? "warning" : "neutral"} />
      </div>

      <div className="my-6">
        <FilterTabs
          items={[
            { label: "To review", href: link({ view: "review", status: "", method: "", q: "", page: "" }), active: view === "review", count: reviewCount ?? 0 },
            { label: "All payments", href: link({ view: "all", page: "" }), active: view === "all" },
            { label: "Subscriptions", href: link({ view: "subscriptions", page: "" }), active: view === "subscriptions" },
          ]}
        />
      </div>

      {body}
    </>
  );
}
