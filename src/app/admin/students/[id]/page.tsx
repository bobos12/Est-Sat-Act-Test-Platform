import { requestTime } from "@/lib/time";
import Link from "next/link";
import { notFound } from "next/navigation";
import { DataTable, Empty, Panel, PageHeader, StatusBadge, Td, Th, adminDate, adminDay, money } from "@/components/admin/ui";
import { adminClient } from "@/lib/admin/server";
import { GrantForm, RevokeForm, RoleForm } from "../access-forms";

export const metadata = { title: "Student" };

export default async function StudentProfile({ params }: PageProps<"/admin/students/[id]">) {
  const { supabase, viewer } = await adminClient();
  const { id } = await params;
  const { data: p } = await supabase.from("profiles").select("id, email, full_name, phone, school, grade, role, created_at").eq("id", id).maybeSingle();
  if (!p) notFound();

  const [{ data: subs }, { data: payments }, { data: attempts }, { data: audit }] = await Promise.all([
    supabase.from("subscriptions").select("id, status, source, current_period_start, current_period_end, note, plans(name), created_at").eq("user_id", id).order("created_at", { ascending: false }),
    supabase.from("payments").select("id, status, provider, merchant_reference, amount_cents, currency, failure_reason, created_at, paid_at").eq("user_id", id).order("created_at", { ascending: false }),
    supabase.from("exam_attempts").select("id, status, percent, correct_count, question_count, started_at, exams(title)").eq("user_id", id).order("started_at", { ascending: false }).limit(50),
    supabase.from("admin_audit_log").select("id, action, details, created_at, profiles:actor_id(full_name, email)").eq("target_type", "profile").eq("target_id", id).order("created_at", { ascending: false }).limit(50),
  ]);

  const now = requestTime();
  const active = (subs ?? []).find((s) => s.status === "active" && Date.parse(s.current_period_start!) <= now && Date.parse(s.current_period_end!) > now);
  const completed = (attempts ?? []).filter((a) => a.status !== "in_progress");
  const avg = completed.length ? Math.round(completed.reduce((t, a) => t + Number(a.percent), 0) / completed.length) : null;

  return (
    <>
      <Link href="/admin/students" className="text-sm text-ink-500 hover:text-ink-950">
        ← Students
      </Link>
      <PageHeader
        title={p.full_name || p.email}
        description={
          <>
            {p.email}
            {p.phone ? ` · ${p.phone}` : ""} · joined {adminDay.format(new Date(p.created_at))}
            {p.role === "admin" ? " · Administrator" : ""}
          </>
        }
      />

      <div className="grid gap-px overflow-hidden rounded-[var(--radius-lg)] bg-line ring-1 ring-line sm:grid-cols-3">
        <div className="bg-white px-5 py-4">
          <p className="text-xs font-medium uppercase tracking-[0.1em] text-ink-500">Access</p>
          <p className="mt-1.5 font-medium text-ink-950">
            {active ? `Premium until ${adminDay.format(new Date(active.current_period_end!))}` : "Free"}
          </p>
        </div>
        <div className="bg-white px-5 py-4">
          <p className="text-xs font-medium uppercase tracking-[0.1em] text-ink-500">Exams completed</p>
          <p className="mt-1.5 font-medium tabular text-ink-950">{completed.length}</p>
        </div>
        <div className="bg-white px-5 py-4">
          <p className="text-xs font-medium uppercase tracking-[0.1em] text-ink-500">Average score</p>
          <p className="mt-1.5 font-medium tabular text-ink-950">{avg == null ? "—" : `${avg}%`}</p>
        </div>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[1fr_360px]">
        <div className="space-y-6">
          <Panel title="Exam attempts">
            {attempts?.length ? (
              <DataTable>
                <thead>
                  <tr>
                    <Th>Exam</Th>
                    <Th>Started</Th>
                    <Th>Result</Th>
                  </tr>
                </thead>
                <tbody>
                  {attempts.map((a) => {
                    const e = Array.isArray(a.exams) ? a.exams[0] : a.exams;
                    return (
                      <tr key={a.id}>
                        <Td>{a.status === "in_progress" ? e?.title : <Link className="hover:underline" href={`/results/${a.id}`}>{e?.title}</Link>}</Td>
                        <Td className="text-ink-500">{adminDate.format(new Date(a.started_at))}</Td>
                        <Td>
                          {a.status === "in_progress" ? (
                            <StatusBadge status="in_progress" />
                          ) : (
                            <span className="tabular">
                              {Math.round(Number(a.percent))}% · {a.correct_count}/{a.question_count}
                            </span>
                          )}
                        </Td>
                      </tr>
                    );
                  })}
                </tbody>
              </DataTable>
            ) : (
              <Empty>No attempts yet.</Empty>
            )}
          </Panel>

          <Panel title="Subscriptions">
            {subs?.length ? (
              <DataTable>
                <thead>
                  <tr>
                    <Th>Period</Th>
                    <Th>Source</Th>
                    <Th>Status</Th>
                  </tr>
                </thead>
                <tbody>
                  {subs.map((s) => {
                    const plan = Array.isArray(s.plans) ? s.plans[0] : s.plans;
                    return (
                      <tr key={s.id}>
                        <Td>
                          {s.current_period_start ? adminDay.format(new Date(s.current_period_start)) : "—"} →{" "}
                          {s.current_period_end ? adminDay.format(new Date(s.current_period_end)) : "—"}
                          {s.note ? <p className="whitespace-pre-line text-xs text-ink-500">{s.note}</p> : null}
                        </Td>
                        <Td>{s.source === "manual_grant" ? "Manual grant" : plan?.name ?? "Payment"}</Td>
                        <Td>
                          <StatusBadge status={s.status} />
                        </Td>
                      </tr>
                    );
                  })}
                </tbody>
              </DataTable>
            ) : (
              <Empty>No subscriptions.</Empty>
            )}
          </Panel>

          <Panel title="Payments">
            {payments?.length ? (
              <DataTable>
                <thead>
                  <tr>
                    <Th>Reference</Th>
                    <Th>Amount</Th>
                    <Th>Status</Th>
                    <Th>Date</Th>
                  </tr>
                </thead>
                <tbody>
                  {payments.map((pay) => (
                    <tr key={pay.id}>
                      <Td className="font-mono text-xs">
                        {pay.merchant_reference}
                        <p className="font-sans text-ink-500 capitalize">{pay.provider}</p>
                      </Td>
                      <Td className="tabular">{money(pay.amount_cents, pay.currency)}</Td>
                      <Td>
                        <StatusBadge status={pay.status} />
                        {pay.failure_reason ? <p className="mt-1 text-xs text-ink-500">{pay.failure_reason}</p> : null}
                      </Td>
                      <Td className="text-ink-500">{adminDate.format(new Date(pay.paid_at ?? pay.created_at))}</Td>
                    </tr>
                  ))}
                </tbody>
              </DataTable>
            ) : (
              <Empty>No payments.</Empty>
            )}
          </Panel>
        </div>

        <div className="space-y-6">
          <Panel title="Grant access">
            <div className="p-5">
              <GrantForm userId={p.id} />
              <p className="mt-3 text-xs text-ink-500">Grants stack on top of any current access. Every grant is recorded in the audit log.</p>
            </div>
          </Panel>
          {active ? (
            <Panel title="Revoke access">
              <div className="p-5">
                <RevokeForm userId={p.id} />
              </div>
            </Panel>
          ) : null}
          {p.id !== viewer.id ? (
            <Panel title="Role">
              <div className="p-5">
                <RoleForm userId={p.id} role={p.role} />
              </div>
            </Panel>
          ) : null}
          <Panel title="Audit log">
            {audit?.length ? (
              <ul className="divide-y divide-line">
                {audit.map((a) => {
                  const actor = Array.isArray(a.profiles) ? a.profiles[0] : a.profiles;
                  const d = a.details as { days?: number; note?: string; role?: string; canceled_subscriptions?: number };
                  return (
                    <li key={a.id} className="px-5 py-3 text-sm">
                      <p className="font-medium text-ink-900">
                        {a.action === "access.grant"
                          ? `Granted ${d.days} days`
                          : a.action === "access.revoke"
                            ? `Revoked access (${d.canceled_subscriptions ?? 0})`
                            : a.action === "profile.role"
                              ? `Role → ${d.role}`
                              : a.action}
                      </p>
                      {d.note ? <p className="text-ink-600">“{d.note}”</p> : null}
                      <p className="text-xs text-ink-500">
                        {actor?.full_name || actor?.email || "System"} · {adminDate.format(new Date(a.created_at))}
                      </p>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <Empty>No admin actions recorded.</Empty>
            )}
          </Panel>
        </div>
      </div>
    </>
  );
}
