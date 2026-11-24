import Link from "next/link";
import { notFound } from "next/navigation";
import { CopyButton, Tabs } from "@/components/admin/client";
import { Icon } from "@/components/admin/icons";
import { RefundButton, ReviewCard, type ReviewItem } from "@/components/admin/payment-review";
import {
  Avatar,
  Badge,
  Callout,
  DataTable,
  DetailList,
  Empty,
  Panel,
  ScorePill,
  StatCard,
  StatusBadge,
  Td,
  Th,
  adminDate,
  adminDay,
  money,
  one,
  providerName,
  relative,
} from "@/components/admin/ui";
import { adminClient } from "@/lib/admin/server";
import { createServiceClient } from "@/lib/supabase/server";
import { requestTime } from "@/lib/time";
import { cn } from "@/lib/utils";
import { RoleForm } from "../access-forms";
import { EditDialog, GrantDialog, RevokeDialog } from "../dialogs";
import { DeleteStudentForm, EditStudentForm, SignOutEverywhereForm, SuspendForm } from "../manage-forms";

export const metadata = { title: "Student" };

type Device = { device_id: string; first_seen: string; last_seen: string; sign_ins: number; ip: string | null; user_agent: string | null; place: string | null };
type UserSecurity = { score: number; active_sessions: number; devices: Device[]; signals: { devices_30d: number; signin_devices_24h: number; travel_7d: number } };

/** "Chrome on Windows" from a user agent, good enough to tell devices apart. */
function deviceLabel(ua: string | null) {
  if (!ua) return "Unknown device";
  const browser = /Edg\//.test(ua) ? "Edge" : /OPR\//.test(ua) ? "Opera" : /Chrome\//.test(ua) ? "Chrome" : /Firefox\//.test(ua) ? "Firefox" : /Safari\//.test(ua) ? "Safari" : "Browser";
  const os = /iPhone|iPad/.test(ua) ? "iOS" : /Android/.test(ua) ? "Android" : /Windows/.test(ua) ? "Windows" : /Mac OS X/.test(ua) ? "macOS" : /Linux/.test(ua) ? "Linux" : "";
  return os ? `${browser} on ${os}` : browser;
}

/** wa.me link for Egyptian (01…) or international (+…) numbers. */
function whatsapp(phone: string | null) {
  if (!phone) return null;
  let d = phone.replace(/[^\d+]/g, "");
  if (d.startsWith("+")) d = d.slice(1);
  else if (d.startsWith("00")) d = d.slice(2);
  else if (/^01\d{9}$/.test(d)) d = `2${d}`;
  return d.length >= 10 ? `https://wa.me/${d}` : null;
}

function duration(start: string, end: string | null) {
  if (!end) return "—";
  const m = Math.round((Date.parse(end) - Date.parse(start)) / 60000);
  return m < 60 ? `${m} min` : `${Math.floor(m / 60)} h ${m % 60} min`;
}

const auditText: Record<string, (d: Record<string, unknown>) => string> = {
  "access.grant": (d) => `Granted ${d.days} days of premium`,
  "access.revoke": (d) => `Removed premium access (${d.canceled_subscriptions ?? 0} subscription${d.canceled_subscriptions === 1 ? "" : "s"})`,
  "profile.role": (d) => `Role changed to ${d.role}`,
  "sessions.revoke": () => "Signed out everywhere",
  "mfa.reset": () => "Reset 2-step verification (email link)",
  "payment.refund": (d) => `Marked a payment refunded (${money(Number(d.amount_cents ?? 0), String(d.currency ?? "EGP"))})`,
};

export default async function StudentProfile({ params, searchParams }: PageProps<"/admin/students/[id]">) {
  const { supabase, viewer } = await adminClient();
  const { id } = await params;
  const sp = await searchParams;
  const tab = typeof sp.tab === "string" ? sp.tab : undefined;
  const now = requestTime();
  const self = `/admin/students/${id}`;

  const loginInfo = (async () => {
    try {
      const { data } = await createServiceClient().auth.admin.getUserById(id);
      return { user: data.user, ok: true };
    } catch {
      return { user: null, ok: false };
    }
  })();

  const [{ data: p }, { data: subs }, { data: payments }, { data: attempts }, { data: audit }, { data: security }, { data: sessions }, { data: answers }, login] =
    await Promise.all([
      supabase.from("profiles").select("id, email, full_name, phone, school, grade, role, created_at, updated_at").eq("id", id).maybeSingle(),
      supabase
        .from("subscriptions")
        .select("id, status, source, current_period_start, current_period_end, canceled_at, note, plans(name), created_at")
        .eq("user_id", id)
        .order("created_at", { ascending: false }),
      supabase
        .from("payments")
        .select("id, status, provider, merchant_reference, amount_cents, currency, failure_reason, provider_payload, created_at, paid_at, plans(name)")
        .eq("user_id", id)
        .order("created_at", { ascending: false }),
      supabase
        .from("exam_attempts")
        .select("id, status, percent, score, max_score, correct_count, answered_count, question_count, started_at, submitted_at, last_activity_at, exams(id, title, subjects(name))")
        .eq("user_id", id)
        .order("started_at", { ascending: false })
        .limit(200),
      supabase.from("admin_audit_log").select("id, action, details, created_at, profiles:actor_id(full_name, email)").eq("target_type", "profile").eq("target_id", id).order("created_at", { ascending: false }).limit(100),
      supabase.rpc("admin_user_security", { p_user: id }),
      supabase.from("practice_sessions").select("id, mode, tutor, question_ids, created_at, last_activity_at, completed_at, subjects(name)").eq("user_id", id).order("last_activity_at", { ascending: false }).limit(30),
      supabase.from("practice_answers").select("is_correct, created_at").eq("user_id", id).limit(20000),
      loginInfo,
    ]);
  if (!p) notFound();
  const sec = security as UserSecurity | null;
  const authUser = login.user;
  const suspended = Boolean(authUser?.banned_until && Date.parse(authUser.banned_until) > now);
  const isSelf = p.id === viewer.id;
  const name = p.full_name || p.email;

  // Access
  const liveSubs = (subs ?? []).filter((s) => s.status === "active" && s.current_period_end && Date.parse(s.current_period_end) > now);
  const active = liveSubs.find((s) => Date.parse(s.current_period_start!) <= now);
  const accessEnd = liveSubs.reduce<string | null>((m, s) => (!m || s.current_period_end! > m ? s.current_period_end! : m), null);
  const daysLeft = accessEnd ? Math.ceil((Date.parse(accessEnd) - now) / 86_400_000) : 0;

  // Performance
  const done = (attempts ?? []).filter((a) => a.status !== "in_progress" && a.percent != null);
  const avg = done.length ? Math.round(done.reduce((t, a) => t + Number(a.percent), 0) / done.length) : null;
  const best = done.length ? Math.round(Math.max(...done.map((a) => Number(a.percent)))) : null;
  const bySubject = new Map<string, { n: number; sum: number }>();
  for (const a of done) {
    const s = one(one(a.exams)?.subjects)?.name ?? "Other";
    const r = bySubject.get(s) ?? { n: 0, sum: 0 };
    r.n++;
    r.sum += Number(a.percent);
    bySubject.set(s, r);
  }
  const practiceTotal = answers?.length ?? 0;
  const practiceCorrect = (answers ?? []).filter((a) => a.is_correct).length;
  const lastActive = [attempts?.[0]?.last_activity_at, sessions?.[0]?.last_activity_at, authUser?.last_sign_in_at].filter(Boolean).sort().at(-1) ?? null;

  // Money
  const paid = (payments ?? []).filter((x) => x.status === "succeeded");
  const totals = paid.reduce<Record<string, number>>((m, x) => ({ ...m, [x.currency]: (m[x.currency] ?? 0) + x.amount_cents }), {});
  const pending = (payments ?? []).filter((x) => x.status === "pending" && (x.provider === "instapay" || x.provider === "vodafone_cash"));
  const proofPaths = pending.map((x) => (x.provider_payload as { proof_path?: string } | null)?.proof_path).filter(Boolean) as string[];
  const { data: signed } = proofPaths.length ? await supabase.storage.from("payment-proofs").createSignedUrls(proofPaths, 3600) : { data: [] };
  const proofUrl = new Map((signed ?? []).map((x) => [x.path, x.signedUrl]));
  const reviewItems: ReviewItem[] = pending.map((x) => {
    const payload = (x.provider_payload ?? {}) as ReviewItem["payload"] & { proof_path?: string };
    return {
      ...x,
      user_id: p.id,
      planName: one(x.plans)?.name,
      payload,
      proofUrl: payload.proof_path ? proofUrl.get(payload.proof_path) : undefined,
    };
  });

  const wa = whatsapp(p.phone);
  const provider = (authUser?.app_metadata?.providers as string[] | undefined)?.join(", ") ?? authUser?.app_metadata?.provider;

  /* ----------------------------- tab panels ----------------------------- */

  const attemptsTable = (rows: NonNullable<typeof attempts>) => (
    <DataTable>
      <thead>
        <tr>
          <Th>Exam</Th>
          <Th>Started</Th>
          <Th>Time taken</Th>
          <Th>Answered</Th>
          <Th>Score</Th>
          <Th className="w-10" />
        </tr>
      </thead>
      <tbody>
        {rows.map((a) => {
          const e = one(a.exams);
          const subject = one(e?.subjects)?.name;
          return (
            <tr key={a.id} className="hover:bg-paper">
              <Td>
                <Link href={`/admin/exams/${e?.id}`} className="font-medium text-ink-950 hover:text-mark-600">
                  {e?.title}
                </Link>
                {subject ? <p className="text-xs text-ink-500">{subject}</p> : null}
              </Td>
              <Td className="whitespace-nowrap text-ink-600">{adminDate.format(new Date(a.started_at))}</Td>
              <Td className="text-ink-600">{a.status === "in_progress" ? `active ${relative(a.last_activity_at, now)}` : duration(a.started_at, a.submitted_at)}</Td>
              <Td className="tabular text-ink-600">{a.question_count ? `${a.answered_count ?? 0}/${a.question_count}` : "—"}</Td>
              <Td>
                {a.status === "in_progress" ? (
                  <StatusBadge status="in_progress" />
                ) : (
                  <span className="flex items-center gap-2">
                    <ScorePill percent={Number(a.percent)} />
                    <span className="text-xs tabular text-ink-500">
                      {a.correct_count}/{a.question_count}
                      {a.status === "expired" ? " · time ran out" : ""}
                    </span>
                  </span>
                )}
              </Td>
              <Td className="text-right">
                {a.status !== "in_progress" ? (
                  <Link href={`/results/${a.id}`} target="_blank" title="Open their result" className="inline-flex h-8 w-8 items-center justify-center rounded-md text-ink-400 hover:bg-paper-2 hover:text-mark-600">
                    <Icon name="external" size={15} />
                  </Link>
                ) : null}
              </Td>
            </tr>
          );
        })}
      </tbody>
    </DataTable>
  );

  const overview = (
    <div className="grid gap-6 xl:grid-cols-[1fr_380px]">
      <div className="space-y-6">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <StatCard label="Exams done" value={done.length} note={`${(attempts?.length ?? 0) - done.length} in progress`} icon="exams" />
          <StatCard label="Average" value={avg == null ? "—" : `${avg}%`} note={best == null ? "No results yet" : `Best ${best}%`} icon="chart" tone="brand" />
          <StatCard
            label="Practice"
            value={practiceTotal.toLocaleString("en")}
            note={practiceTotal ? `${Math.round((practiceCorrect / practiceTotal) * 100)}% correct` : "No questions yet"}
            icon="bank"
          />
          <StatCard
            label="Total paid"
            value={Object.keys(totals).length ? Object.entries(totals).map(([c, v]) => money(v, c)).join(" · ") : money(0, "EGP")}
            note={`${paid.length} payment${paid.length === 1 ? "" : "s"}`}
            icon="wallet"
            tone="success"
          />
        </div>

        {bySubject.size ? (
          <Panel title="Results by subject" icon="chart">
            <ul className="divide-y divide-line">
              {[...bySubject].map(([s, r]) => {
                const pct = Math.round(r.sum / r.n);
                return (
                  <li key={s} className="flex items-center gap-4 px-5 py-3 text-sm">
                    <span className="w-40 shrink-0 truncate font-medium text-ink-900">{s}</span>
                    <span className="h-2 flex-1 overflow-hidden rounded-full bg-paper-2">
                      <span className={cn("block h-full rounded-full", pct >= 75 ? "bg-success-600" : pct >= 50 ? "bg-warning-500" : "bg-danger-600")} style={{ width: `${pct}%` }} />
                    </span>
                    <span className="w-28 shrink-0 text-right tabular text-ink-600">
                      <b className="text-ink-950">{pct}%</b> · {r.n} exam{r.n === 1 ? "" : "s"}
                    </span>
                  </li>
                );
              })}
            </ul>
          </Panel>
        ) : null}

        <Panel title="Recent exams" icon="exams">
          {attempts?.length ? attemptsTable(attempts.slice(0, 6)) : <Empty icon="exams">Hasn&apos;t started an exam yet.</Empty>}
        </Panel>
      </div>

      <div className="space-y-6">
        <Panel title="Premium access" icon="crown">
          <div className="p-5">
            {active ? (
              <>
                <div className="flex items-center gap-2">
                  <Badge tone={daysLeft <= 7 ? "warning" : "success"} icon="crown">
                    Premium
                  </Badge>
                  <span className={cn("text-sm font-medium", daysLeft <= 7 ? "text-warning-700" : "text-ink-700")}>{daysLeft <= 1 ? "ends today" : `${daysLeft} days left`}</span>
                </div>
                <p className="mt-2 text-sm text-ink-600">
                  Until <b className="text-ink-950">{adminDay.format(new Date(accessEnd!))}</b> · {active.source === "manual_grant" ? "granted by an admin" : `paid · ${one(active.plans)?.name ?? "plan"}`}
                </p>
              </>
            ) : (
              <>
                <Badge tone="brand">Free account</Badge>
                <p className="mt-2 text-sm text-ink-600">
                  {(subs ?? []).length ? "Their premium has ended." : "Has never had premium."} They can only open free exams.
                </p>
              </>
            )}
            <div className="mt-4 flex flex-wrap gap-2">
              <GrantDialog userId={p.id} name={name} currentEnd={accessEnd} size="sm" label={active ? "Extend premium" : "Grant premium"} />
              {active ? <RevokeDialog userId={p.id} name={name} size="sm" /> : null}
            </div>
          </div>
        </Panel>

        <Panel title="Profile" icon="users" actions={<EditDialog p={p} />}>
          <DetailList
            items={[
              { label: "Email", value: <span className="inline-flex items-center gap-1">{p.email} <CopyButton text={p.email} label="Copy email" /></span> },
              { label: "Phone", value: p.phone ? <span className="inline-flex items-center gap-1">{p.phone} <CopyButton text={p.phone} label="Copy phone" /></span> : null },
              { label: "School", value: p.school },
              { label: "Grade", value: p.grade },
              { label: "Joined", value: `${adminDay.format(new Date(p.created_at))} (${relative(p.created_at, now)})` },
              { label: "Last sign-in", value: authUser?.last_sign_in_at ? `${adminDate.format(new Date(authUser.last_sign_in_at))}` : null },
              { label: "Signs in with", value: provider ? <span className="capitalize">{String(provider)}</span> : null },
              { label: "Email confirmed", value: authUser ? (authUser.email_confirmed_at ? "Yes" : <span className="text-warning-700">Not yet</span>) : null },
            ]}
          />
        </Panel>
      </div>
    </div>
  );

  const examsTab = (
    <Panel title={`All exam attempts (${attempts?.length ?? 0})`} icon="exams" description="Open a result to see exactly what they answered.">
      {attempts?.length ? attemptsTable(attempts) : <Empty icon="exams">Hasn&apos;t started an exam yet.</Empty>}
    </Panel>
  );

  const practiceTab = (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
        <StatCard label="Practice sessions" value={sessions?.length ?? 0} note={sessions?.length === 30 ? "showing latest 30" : undefined} icon="bank" />
        <StatCard label="Questions answered" value={practiceTotal.toLocaleString("en")} icon="check" />
        <StatCard label="Accuracy" value={practiceTotal ? `${Math.round((practiceCorrect / practiceTotal) * 100)}%` : "—"} icon="chart" tone="brand" />
      </div>
      <Panel title="Recent practice sessions" icon="bank">
        {sessions?.length ? (
          <DataTable>
            <thead>
              <tr>
                <Th>Subject</Th>
                <Th>Mode</Th>
                <Th>Questions</Th>
                <Th>Last activity</Th>
                <Th>Status</Th>
              </tr>
            </thead>
            <tbody>
              {sessions.map((s) => (
                <tr key={s.id}>
                  <Td className="font-medium text-ink-950">{one(s.subjects)?.name}</Td>
                  <Td className="capitalize text-ink-600">
                    {s.mode} · {s.tutor ? "tutor" : "test"}
                  </Td>
                  <Td className="tabular">{s.question_ids?.length ?? 0}</Td>
                  <Td className="text-ink-600">{relative(s.last_activity_at, now)}</Td>
                  <Td>{s.completed_at ? <StatusBadge status="completed" /> : <StatusBadge status="in_progress" />}</Td>
                </tr>
              ))}
            </tbody>
          </DataTable>
        ) : (
          <Empty icon="bank">Hasn&apos;t used the question bank yet.</Empty>
        )}
      </Panel>
    </div>
  );

  const paymentsTab = (
    <div className="space-y-6">
      {reviewItems.length ? (
        <Panel title={`Waiting for your review (${reviewItems.length})`} icon="alert" className="ring-2 ring-warning-500/40">
          <ul className="divide-y divide-line">
            {reviewItems.map((r) => (
              <ReviewCard key={r.id} r={r} back={`${self}?tab=payments`} showStudent={false} />
            ))}
          </ul>
        </Panel>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[1fr_340px]">
        <Panel title="Payments" icon="wallet">
          {payments?.length ? (
            <DataTable>
              <thead>
                <tr>
                  <Th>Amount</Th>
                  <Th>Method</Th>
                  <Th>Status</Th>
                  <Th>Date</Th>
                  <Th className="w-20" />
                </tr>
              </thead>
              <tbody>
                {payments.map((pay) => (
                  <tr key={pay.id}>
                    <Td>
                      <p className="font-semibold tabular text-ink-950">{money(pay.amount_cents, pay.currency)}</p>
                      <p className="font-mono text-[0.6875rem] text-ink-500">{pay.merchant_reference}</p>
                    </Td>
                    <Td>
                      {providerName(pay.provider)}
                      <p className="text-xs text-ink-500">{one(pay.plans)?.name}</p>
                    </Td>
                    <Td>
                      <StatusBadge status={pay.status} />
                      {pay.failure_reason ? <p className="mt-1 max-w-56 text-xs text-ink-500">{pay.failure_reason}</p> : null}
                    </Td>
                    <Td className="whitespace-nowrap text-ink-600">{adminDate.format(new Date(pay.paid_at ?? pay.created_at))}</Td>
                    <Td className="text-right">
                      {pay.status === "succeeded" ? <RefundButton id={pay.id} label={money(pay.amount_cents, pay.currency)} back={`${self}?tab=payments`} /> : null}
                    </Td>
                  </tr>
                ))}
              </tbody>
            </DataTable>
          ) : (
            <Empty icon="wallet">No payments.</Empty>
          )}
        </Panel>

        <div className="space-y-6">
          <Panel title="Change access" icon="crown">
            <div className="space-y-3 p-5">
              <p className="text-sm text-ink-600">
                {active ? (
                  <>
                    Premium until <b className="text-ink-950">{adminDay.format(new Date(accessEnd!))}</b>.
                  </>
                ) : (
                  "No premium access right now."
                )}
              </p>
              <div className="flex flex-wrap gap-2">
                <GrantDialog userId={p.id} name={name} currentEnd={accessEnd} size="sm" label={active ? "Extend premium" : "Grant premium"} />
                {active ? <RevokeDialog userId={p.id} name={name} size="sm" /> : null}
              </div>
            </div>
          </Panel>
          <Panel title="Access history" icon="clock">
            {subs?.length ? (
              <ol className="relative space-y-4 px-5 py-4 before:absolute before:bottom-4 before:left-[27px] before:top-5 before:w-px before:bg-line">
                {subs.map((s) => {
                  const live = s.status === "active" && s.current_period_end && Date.parse(s.current_period_end) > now;
                  const status = s.status === "active" && !live ? "expired" : s.status;
                  return (
                    <li key={s.id} className="relative pl-7 text-sm">
                      <span className={cn("absolute left-0.5 top-1 h-3 w-3 rounded-full ring-4 ring-white", live ? "bg-success-600" : "bg-ink-300")} />
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium text-ink-950">{s.source === "manual_grant" ? "Granted by admin" : one(s.plans)?.name ?? "Payment"}</span>
                        <StatusBadge status={status} />
                      </div>
                      <p className="text-xs text-ink-500">
                        {s.current_period_start ? adminDay.format(new Date(s.current_period_start)) : "—"} → {s.current_period_end ? adminDay.format(new Date(s.current_period_end)) : "—"}
                      </p>
                      {s.note ? <p className="mt-1 whitespace-pre-line text-xs text-ink-600">“{s.note}”</p> : null}
                    </li>
                  );
                })}
              </ol>
            ) : (
              <Empty icon="clock">Never had premium.</Empty>
            )}
          </Panel>
        </div>
      </div>
    </div>
  );

  const securityTab = sec ? (
    <div className="grid gap-6 xl:grid-cols-[1fr_340px]">
      <Panel title="Devices in the last 30 days" icon="device">
        {sec.devices.length ? (
          <ul className="divide-y divide-line">
            {sec.devices.map((d) => (
              <li key={d.device_id} className="flex items-start gap-3 px-5 py-3 text-sm">
                <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-paper-2 text-ink-500">
                  <Icon name="device" size={16} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-ink-900">{deviceLabel(d.user_agent)}</p>
                  <p className="text-xs text-ink-500">
                    {[d.place, d.ip].filter(Boolean).join(" · ") || "Location unknown"}
                    {d.sign_ins ? ` · ${d.sign_ins} sign-in${d.sign_ins === 1 ? "" : "s"}` : ""}
                  </p>
                </div>
                <span className="shrink-0 text-xs text-ink-500">{relative(d.last_seen, now)}</span>
              </li>
            ))}
          </ul>
        ) : (
          <Empty icon="device">No devices recorded yet.</Empty>
        )}
      </Panel>
      <div className="space-y-6">
        <Panel title="Account sharing risk" icon="shield">
          <div className="space-y-3 p-5 text-sm">
            <div className="flex items-baseline gap-2">
              <span className={cn("font-display text-3xl font-semibold tabular", sec.score >= 60 ? "text-danger-600" : sec.score >= 30 ? "text-warning-700" : "text-success-700")}>{sec.score}</span>
              <span className="text-ink-500">/ 100 · {sec.score >= 60 ? "high" : sec.score >= 30 ? "medium" : "low"}</span>
            </div>
            <ul className="space-y-1 text-ink-600">
              <li>{sec.signals.devices_30d} device{sec.signals.devices_30d === 1 ? "" : "s"} in 30 days</li>
              <li>{sec.signals.signin_devices_24h} device{sec.signals.signin_devices_24h === 1 ? "" : "s"} signed in during the last 24 h</li>
              <li>{sec.signals.travel_7d} impossible-travel jump{sec.signals.travel_7d === 1 ? "" : "s"} this week</li>
              <li>
                {sec.active_sessions} open session{sec.active_sessions === 1 ? "" : "s"} now
              </li>
            </ul>
            {!isSelf && sec.active_sessions ? (
              <div className="border-t border-line pt-3">
                <SignOutEverywhereForm userId={p.id} />
              </div>
            ) : null}
          </div>
        </Panel>
      </div>
    </div>
  ) : (
    <Empty icon="shield">Security data isn&apos;t available.</Empty>
  );

  const accountTab = (
    <div className="grid gap-6 xl:grid-cols-2">
      <Panel title="Edit details" icon="edit">
        <div className="p-5">
          <EditStudentForm p={p} />
        </div>
      </Panel>
      <div className="space-y-6">
        {!isSelf ? (
          <Panel title="Role" icon="shield" description="Administrators can open this dashboard.">
            <div className="p-5">
              <RoleForm userId={p.id} role={p.role} />
            </div>
          </Panel>
        ) : null}
        {!isSelf ? (
          <Panel title="Danger zone" icon="alert" className="ring-danger-600/30">
            <div className="space-y-5 p-5">
              {login.ok ? null : <Callout tone="warning">Suspend and delete need SUPABASE_SERVICE_ROLE_KEY in the server environment.</Callout>}
              <div>
                <p className="text-sm font-semibold text-ink-950">{suspended ? "Account is suspended" : "Suspend account"}</p>
                <p className="mb-3 mt-0.5 text-sm text-ink-600">
                  {suspended ? "They can't sign in. Restore to let them back in." : "Block sign-in without deleting anything. You can restore it any time."}
                </p>
                <SuspendForm userId={p.id} suspended={suspended} />
              </div>
              <div className="border-t border-line pt-5">
                <p className="text-sm font-semibold text-ink-950">Delete account</p>
                <p className="mb-3 mt-0.5 text-sm text-ink-600">Removes the student and all their data for good.</p>
                <DeleteStudentForm userId={p.id} email={p.email} />
              </div>
            </div>
          </Panel>
        ) : (
          <Callout tone="info">This is your own account. Role, suspension and deletion are disabled here.</Callout>
        )}
      </div>
    </div>
  );

  const activityTab = (
    <Panel title="Admin activity on this account" icon="clock" description="Every grant, removal, role change, refund and sign-out, newest first.">
      {audit?.length ? (
        <ul className="divide-y divide-line">
          {audit.map((a) => {
            const actor = one(a.profiles as { full_name: string | null; email: string } | { full_name: string | null; email: string }[] | null);
            const d = (a.details ?? {}) as Record<string, unknown>;
            return (
              <li key={a.id} className="flex gap-3 px-5 py-3 text-sm">
                <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-mark-500" />
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-ink-900">{auditText[a.action]?.(d) ?? a.action}</p>
                  {d.note ? <p className="text-ink-600">“{String(d.note)}”</p> : null}
                  <p className="text-xs text-ink-500">
                    by {actor?.full_name || actor?.email || "System"} · {adminDate.format(new Date(a.created_at))}
                  </p>
                </div>
              </li>
            );
          })}
        </ul>
      ) : (
        <Empty icon="clock">No admin actions recorded.</Empty>
      )}
    </Panel>
  );

  return (
    <>
      <Link href="/admin/students" className="mb-4 inline-flex items-center gap-1 text-sm font-medium text-ink-500 transition hover:text-ink-950">
        <Icon name="chevronLeft" size={16} /> All students
      </Link>

      {/* Header */}
      <div className="mb-6 rounded-[var(--radius-lg)] bg-white p-5 shadow-[0_1px_2px_rgba(10,15,28,0.04)] ring-1 ring-line sm:p-6">
        <div className="flex flex-wrap items-start gap-5">
          <Avatar name={name} size={64} />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="font-display text-2xl font-semibold tracking-tight text-ink-950">{p.full_name || <span className="text-ink-500">No name</span>}</h1>
              {active ? (
                <Badge tone={daysLeft <= 7 ? "warning" : "success"} icon="crown">
                  Premium · {daysLeft <= 1 ? "ends today" : `${daysLeft} days left`}
                </Badge>
              ) : (subs ?? []).length ? (
                <Badge>Premium expired</Badge>
              ) : (
                <Badge tone="brand">Free</Badge>
              )}
              {p.role === "admin" ? <Badge tone="dark">Administrator</Badge> : null}
              {suspended ? (
                <Badge tone="danger" icon="lock">
                  Suspended
                </Badge>
              ) : null}
              {sec && sec.score >= 60 ? (
                <Badge tone="danger" icon="alert">
                  Sharing risk {sec.score}
                </Badge>
              ) : null}
              {pending.length ? (
                <Badge tone="warning" icon="wallet">
                  {pending.length} payment{pending.length === 1 ? "" : "s"} to review
                </Badge>
              ) : null}
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-x-5 gap-y-1.5 text-sm text-ink-600">
              <span className="inline-flex items-center gap-1.5">
                <Icon name="mail" size={15} className="text-ink-400" />
                <a href={`mailto:${p.email}`} className="hover:text-mark-600 hover:underline">
                  {p.email}
                </a>
                <CopyButton text={p.email} label="Copy email" />
              </span>
              {p.phone ? (
                <span className="inline-flex items-center gap-1.5">
                  <Icon name="phone" size={15} className="text-ink-400" />
                  <a href={`tel:${p.phone}`} className="hover:text-mark-600 hover:underline">
                    {p.phone}
                  </a>
                  <CopyButton text={p.phone} label="Copy phone" />
                  {wa ? (
                    <a href={wa} target="_blank" rel="noreferrer" className="ml-1 rounded-full bg-success-50 px-2 py-0.5 text-xs font-semibold text-success-700 hover:bg-success-600 hover:text-white">
                      WhatsApp
                    </a>
                  ) : null}
                </span>
              ) : null}
              <span className="inline-flex items-center gap-1.5">
                <Icon name="clock" size={15} className="text-ink-400" />
                {lastActive ? `Active ${relative(lastActive, now)}` : "Never active"}
              </span>
              <span className="text-ink-500">Joined {adminDay.format(new Date(p.created_at))}</span>
            </div>
          </div>
          <div className="flex w-full flex-wrap gap-2 sm:w-auto">
            <GrantDialog userId={p.id} name={name} currentEnd={accessEnd} label={active ? "Extend premium" : "Grant premium"} />
            <EditDialog p={p} />
          </div>
        </div>
      </div>

      <Tabs
        initial={tab}
        tabs={[
          { id: "overview", label: "Overview", icon: "home", content: overview },
          { id: "exams", label: "Exams", icon: "exams", count: attempts?.length ?? 0, content: examsTab },
          { id: "practice", label: "Practice", icon: "bank", count: sessions?.length ?? 0, content: practiceTab },
          { id: "payments", label: "Payments & access", icon: "wallet", count: payments?.length ?? 0, content: paymentsTab },
          { id: "security", label: "Devices", icon: "device", count: sec?.devices.length, content: securityTab },
          { id: "account", label: "Account", icon: "edit", content: accountTab },
          { id: "activity", label: "Activity log", icon: "clock", count: audit?.length ?? 0, content: activityTab },
        ]}
      />
    </>
  );
}
