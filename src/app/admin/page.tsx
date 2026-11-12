import Link from "next/link";
import { DataTable, Empty, Panel, PageHeader, StatusBadge, Td, Th, adminDate, money } from "@/components/admin/ui";
import { adminClient } from "@/lib/admin/server";

type Stats = {
  students: number;
  students_30d: number;
  active_subscriptions: number;
  expired_subscriptions: number;
  published_exams: number;
  exams_in_review: number;
  attempts: number;
  attempts_30d: number;
  revenue_by_currency: Record<string, number>;
  revenue_30d_by_currency: Record<string, number>;
  payments_succeeded: number;
  payments_failed: number;
  payments_pending: number;
};

function revenue(map: Record<string, number>) {
  const entries = Object.entries(map);
  return entries.length ? entries.map(([cur, cents]) => money(cents, cur)).join(" · ") : money(0, "EGP");
}

export default async function AdminOverview() {
  const { supabase } = await adminClient();
  const [{ data: stats, error }, { data: attempts }, { data: payments }] = await Promise.all([
    supabase.rpc("admin_dashboard_stats"),
    supabase
      .from("exam_attempts")
      .select("id, status, percent, started_at, exams(title), profiles(full_name, email)")
      .order("started_at", { ascending: false })
      .limit(8),
    supabase
      .from("payments")
      .select("id, status, amount_cents, currency, created_at, profiles(full_name, email)")
      .order("created_at", { ascending: false })
      .limit(8),
  ]);
  if (error) throw new Error(error.message);
  const s = stats as Stats;

  const tiles = [
    { label: "Registered students", value: s.students, note: `+${s.students_30d} in 30 days`, href: "/admin/students" },
    { label: "Active subscriptions", value: s.active_subscriptions, note: `${s.expired_subscriptions} expired`, href: "/admin/billing" },
    { label: "Published exams", value: s.published_exams, note: `${s.exams_in_review} in draft or review`, href: "/admin/exams" },
    { label: "Exam attempts", value: s.attempts, note: `${s.attempts_30d} in 30 days` },
  ];

  return (
    <>
      <PageHeader title="Overview" description="Students, content and revenue at a glance." />

      <div className="grid gap-px overflow-hidden rounded-[var(--radius-lg)] bg-line ring-1 ring-line sm:grid-cols-2 lg:grid-cols-4">
        {tiles.map((t) => {
          const body = (
            <>
              <p className="text-xs font-medium uppercase tracking-[0.1em] text-ink-500">{t.label}</p>
              <p className="mt-2 font-display text-4xl font-medium tabular text-ink-950">{t.value.toLocaleString("en")}</p>
              <p className="mt-1 text-sm text-ink-500">{t.note}</p>
            </>
          );
          return t.href ? (
            <Link key={t.label} href={t.href} className="bg-white px-5 py-5 hover:bg-paper">
              {body}
            </Link>
          ) : (
            <div key={t.label} className="bg-white px-5 py-5">
              {body}
            </div>
          );
        })}
      </div>

      <div className="mt-px grid gap-px overflow-hidden rounded-[var(--radius-lg)] bg-line ring-1 ring-line sm:grid-cols-3">
        <div className="bg-white px-5 py-5">
          <p className="text-xs font-medium uppercase tracking-[0.1em] text-ink-500">Revenue (all time)</p>
          <p className="mt-2 text-2xl font-semibold tabular text-ink-950">{revenue(s.revenue_by_currency)}</p>
        </div>
        <div className="bg-white px-5 py-5">
          <p className="text-xs font-medium uppercase tracking-[0.1em] text-ink-500">Revenue (30 days)</p>
          <p className="mt-2 text-2xl font-semibold tabular text-ink-950">{revenue(s.revenue_30d_by_currency)}</p>
        </div>
        <div className="bg-white px-5 py-5">
          <p className="text-xs font-medium uppercase tracking-[0.1em] text-ink-500">Payments</p>
          <p className="mt-2 text-sm tabular text-ink-700">
            <span className="font-semibold text-success-700">{s.payments_succeeded}</span> succeeded ·{" "}
            <span className="font-semibold text-danger-600">{s.payments_failed}</span> failed ·{" "}
            <span className="font-semibold text-warning-700">{s.payments_pending}</span> pending
          </p>
        </div>
      </div>

      <div className="mt-8 grid gap-6 xl:grid-cols-2">
        <Panel title="Recent attempts">
          {attempts?.length ? (
            <DataTable>
              <thead>
                <tr>
                  <Th>Student</Th>
                  <Th>Exam</Th>
                  <Th>Result</Th>
                </tr>
              </thead>
              <tbody>
                {attempts.map((a) => {
                  const p = Array.isArray(a.profiles) ? a.profiles[0] : a.profiles;
                  const e = Array.isArray(a.exams) ? a.exams[0] : a.exams;
                  return (
                    <tr key={a.id}>
                      <Td>
                        <p className="font-medium text-ink-950">{p?.full_name || p?.email}</p>
                        <p className="text-xs text-ink-500">{adminDate.format(new Date(a.started_at))}</p>
                      </Td>
                      <Td>{e?.title}</Td>
                      <Td>{a.status === "in_progress" ? <StatusBadge status="in_progress" /> : <span className="tabular font-medium">{Math.round(Number(a.percent))}%</span>}</Td>
                    </tr>
                  );
                })}
              </tbody>
            </DataTable>
          ) : (
            <Empty>No attempts yet.</Empty>
          )}
        </Panel>
        <Panel title="Recent payments" actions={<Link href="/admin/billing" className="text-sm text-ink-500 hover:text-ink-950">All payments →</Link>}>
          {payments?.length ? (
            <DataTable>
              <thead>
                <tr>
                  <Th>Student</Th>
                  <Th>Amount</Th>
                  <Th>Status</Th>
                </tr>
              </thead>
              <tbody>
                {payments.map((pay) => {
                  const p = Array.isArray(pay.profiles) ? pay.profiles[0] : pay.profiles;
                  return (
                    <tr key={pay.id}>
                      <Td>
                        <p className="font-medium text-ink-950">{p?.full_name || p?.email}</p>
                        <p className="text-xs text-ink-500">{adminDate.format(new Date(pay.created_at))}</p>
                      </Td>
                      <Td className="tabular">{money(pay.amount_cents, pay.currency)}</Td>
                      <Td>
                        <StatusBadge status={pay.status} />
                      </Td>
                    </tr>
                  );
                })}
              </tbody>
            </DataTable>
          ) : (
            <Empty>No payments yet.</Empty>
          )}
        </Panel>
      </div>
    </>
  );
}
