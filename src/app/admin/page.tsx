import Link from "next/link";
import { bucketDays, DailyBars } from "@/components/admin/bar-chart";
import { btn } from "@/components/admin/client";
import { Icon, type IconName } from "@/components/admin/icons";
import { Avatar, Empty, Panel, PageHeader, ScorePill, StatCard, StatusBadge, money, one, providerName, relative } from "@/components/admin/ui";
import { adminClient } from "@/lib/admin/server";
import { requestTime } from "@/lib/time";
import { cn } from "@/lib/utils";

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
  const { supabase, viewer } = await adminClient();
  const now = requestTime();
  const nowIso = new Date(now).toISOString();
  const since14 = new Date(now - 14 * 86_400_000).toISOString();

  const [
    { data: stats, error },
    { data: attempts },
    { data: payments },
    { data: signups },
    { count: toReview },
    { count: drafts },
    { count: failedDocs },
    { data: liveSubs },
    { data: attempts14 },
  ] = await Promise.all([
    supabase.rpc("admin_dashboard_stats"),
    supabase
      .from("exam_attempts")
      .select("id, user_id, status, percent, started_at, exams(title), profiles(full_name, email)")
      .order("started_at", { ascending: false })
      .limit(7),
    supabase
      .from("payments")
      .select("id, user_id, status, provider, amount_cents, currency, created_at, profiles(full_name, email)")
      .order("created_at", { ascending: false })
      .limit(7),
    supabase.from("profiles").select("id, full_name, email, created_at").gte("created_at", since14).order("created_at", { ascending: false }).limit(2000),
    supabase.from("payments").select("id", { count: "exact", head: true }).eq("status", "pending").in("provider", ["instapay", "vodafone_cash"]),
    supabase.from("exams").select("id", { count: "exact", head: true }).in("status", ["draft", "in_review"]),
    supabase.from("source_documents").select("id", { count: "exact", head: true }).eq("status", "failed"),
    supabase.from("subscriptions").select("user_id, current_period_end").eq("status", "active").gt("current_period_end", nowIso),
    supabase.from("exam_attempts").select("started_at").gte("started_at", since14).limit(5000),
  ]);
  if (error) throw new Error(error.message);
  const s = stats as Stats;

  // Premium students whose last day of access falls in the next 7 days.
  const lastEnd = new Map<string, number>();
  for (const r of liveSubs ?? []) lastEnd.set(r.user_id, Math.max(lastEnd.get(r.user_id) ?? 0, Date.parse(r.current_period_end!)));
  const expiring = [...lastEnd.values()].filter((t) => t < now + 7 * 86_400_000).length;

  const attention: { n: number; label: string; href: string; cta: string; icon: IconName; urgent?: boolean }[] = [
    { n: toReview ?? 0, label: "payment screenshots waiting for your review", href: "/admin/payments", cta: "Review now", icon: "wallet", urgent: true },
    { n: expiring, label: "premium students lose access in the next 7 days", href: "/admin/students?access=expiring", cta: "See who", icon: "clock" },
    { n: drafts ?? 0, label: "exams still in draft or review", href: "/admin/exams?status=draft", cta: "Open", icon: "exams" },
    { n: failedDocs ?? 0, label: "PDF imports failed", href: "/admin/knowledge", cta: "Retry", icon: "alert" },
  ];
  const open = attention.filter((a) => a.n > 0);

  const hour = Number(new Intl.DateTimeFormat("en-GB", { hour: "numeric", hourCycle: "h23", timeZone: "Africa/Cairo" }).format(now));
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";

  return (
    <>
      <PageHeader
        title={`${greeting}${viewer.fullName ? `, ${viewer.fullName.split(" ")[0]}` : ""}`}
        description="Here's what's happening with your students, exams and payments."
        actions={
          <>
            <Link href="/admin/exams/new" className={btn("secondary")}>
              <Icon name="plus" size={15} /> New exam
            </Link>
            <Link href="/admin/students" className={btn("dark")}>
              <Icon name="users" size={15} /> Find a student
            </Link>
          </>
        }
      />

      {/* Needs attention */}
      <section className={cn("mb-6 rounded-[var(--radius-lg)] p-1 ring-1", open.length ? "bg-white ring-line" : "bg-success-50 ring-success-600/20")}>
        {open.length ? (
          <ul className="divide-y divide-line">
            {open.map((a) => (
              <li key={a.label} className="flex items-center gap-3 px-4 py-3">
                <span
                  className={cn(
                    "flex h-9 w-9 shrink-0 items-center justify-center rounded-full",
                    a.urgent ? "bg-danger-600 text-white" : "bg-warning-50 text-warning-700",
                  )}
                >
                  <Icon name={a.icon} size={17} />
                </span>
                <p className="flex-1 text-sm text-ink-700">
                  <b className="text-base tabular text-ink-950">{a.n}</b> {a.label}
                </p>
                <Link href={a.href} className={btn(a.urgent ? "danger" : "secondary", "sm")}>
                  {a.cta} <Icon name="chevronRight" size={14} />
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="flex items-center gap-3 px-4 py-3 text-sm font-medium text-success-700">
            <Icon name="check" size={18} /> All caught up. No payments to review, nothing failing, nothing expiring this week.
          </p>
        )}
      </section>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Students" value={s.students.toLocaleString("en")} note={`+${s.students_30d} in the last 30 days`} href="/admin/students" icon="users" tone="brand" />
        <StatCard
          label="Premium now"
          value={s.active_subscriptions.toLocaleString("en")}
          note={`${s.students ? Math.round((s.active_subscriptions / s.students) * 100) : 0}% of students · ${expiring} expiring soon`}
          href="/admin/students?access=premium"
          icon="crown"
          tone="success"
        />
        <StatCard label="Revenue · 30 days" value={revenue(s.revenue_30d_by_currency)} note={`${revenue(s.revenue_by_currency)} all time`} href="/admin/payments?view=all" icon="wallet" tone="brand" />
        <StatCard label="Exam attempts · 30 days" value={s.attempts_30d.toLocaleString("en")} note={`${s.attempts.toLocaleString("en")} all time · ${s.published_exams} live exams`} href="/admin/exams" icon="chart" />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Panel title="New students" description="Sign-ups per day, last 14 days" icon="users">
          <div className="px-5 pb-4 pt-5">
            <DailyBars data={bucketDays((signups ?? []).map((p) => p.created_at), now)} unit="sign-ups" />
          </div>
        </Panel>
        <Panel title="Exam activity" description="Attempts started per day, last 14 days" icon="chart">
          <div className="px-5 pb-4 pt-5">
            <DailyBars data={bucketDays((attempts14 ?? []).map((a) => a.started_at), now)} unit="attempts" />
          </div>
        </Panel>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-3">
        <Panel title="Latest sign-ups" icon="users" actions={<Link href="/admin/students" className="text-sm font-medium text-mark-600 hover:underline">All students</Link>}>
          {signups?.length ? (
            <ul className="divide-y divide-line">
              {signups.slice(0, 7).map((p) => (
                <li key={p.id}>
                  <Link href={`/admin/students/${p.id}`} className="flex items-center gap-3 px-5 py-2.5 transition hover:bg-paper">
                    <Avatar name={p.full_name || p.email} size={32} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-ink-950">{p.full_name || p.email}</span>
                      <span className="block truncate text-xs text-ink-500">{p.email}</span>
                    </span>
                    <span className="shrink-0 text-xs text-ink-500">{relative(p.created_at, now)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <Empty icon="users">No sign-ups in the last 14 days.</Empty>
          )}
        </Panel>

        <Panel title="Latest exam attempts" icon="exams">
          {attempts?.length ? (
            <ul className="divide-y divide-line">
              {attempts.map((a) => {
                const p = one(a.profiles);
                const e = one(a.exams);
                return (
                  <li key={a.id}>
                    <Link href={`/admin/students/${a.user_id}?tab=exams`} className="flex items-center gap-3 px-5 py-2.5 transition hover:bg-paper">
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium text-ink-950">{p?.full_name || p?.email}</span>
                        <span className="block truncate text-xs text-ink-500">
                          {e?.title} · {relative(a.started_at, now)}
                        </span>
                      </span>
                      {a.status === "in_progress" ? <StatusBadge status="in_progress" /> : <ScorePill percent={Number(a.percent)} />}
                    </Link>
                  </li>
                );
              })}
            </ul>
          ) : (
            <Empty icon="exams">No attempts yet.</Empty>
          )}
        </Panel>

        <Panel title="Latest payments" icon="wallet" actions={<Link href="/admin/payments?view=all" className="text-sm font-medium text-mark-600 hover:underline">All payments</Link>}>
          {payments?.length ? (
            <ul className="divide-y divide-line">
              {payments.map((pay) => {
                const p = one(pay.profiles);
                return (
                  <li key={pay.id}>
                    <Link href={`/admin/students/${pay.user_id}?tab=payments`} className="flex items-center gap-3 px-5 py-2.5 transition hover:bg-paper">
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium text-ink-950">{p?.full_name || p?.email}</span>
                        <span className="block truncate text-xs text-ink-500">
                          <b className="tabular text-ink-800">{money(pay.amount_cents, pay.currency)}</b> · {providerName(pay.provider)} · {relative(pay.created_at, now)}
                        </span>
                      </span>
                      <StatusBadge status={pay.status} />
                    </Link>
                  </li>
                );
              })}
            </ul>
          ) : (
            <Empty icon="wallet">No payments yet.</Empty>
          )}
        </Panel>
      </div>
    </>
  );
}
