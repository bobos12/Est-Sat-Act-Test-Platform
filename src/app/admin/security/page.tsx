import Link from "next/link";
import { DataTable, Empty, PageHeader, Panel, Td, Th, adminDate } from "@/components/admin/ui";
import { adminClient } from "@/lib/admin/server";
import { cn } from "@/lib/utils";
import { LimitsForm, type Limits } from "./limits-form";
import { TraceForm } from "./trace-form";

export const metadata = { title: "Security" };

type Signals = {
  attempts_24h: number;
  rushed_7d: number;
  practice_24h: number;
  ips_24h: number;
  blocked_7d: number;
  practice_finished_7d: number;
  practice_skipped_7d: number;
  devices_30d?: number;
  signin_devices_24h?: number;
  travel_7d?: number;
};
type RiskRow = { id: string; email: string; full_name: string; premium: boolean; score: number; last_seen: string | null; signals: Signals };
type AdminSignIn = { created_at: string; email: string; full_name: string; ip: string | null; user_agent: string | null; device_id: string | null; place: string | null };
type Status = { gate_configured: boolean; gate_updated_at: string | null; blocked_24h: number; settings: Partial<Limits> | null };

const DEFAULTS: Limits = { max_new_attempts_per_day: 8, max_practice_questions_per_day: 400, flag_score: 60 };

export default async function Security() {
  const { supabase } = await adminClient();
  const [{ data: status, error: statusError }, { data: rows, error: rowsError }, { data: signIns }] = await Promise.all([
    supabase.rpc("admin_protection_status"),
    supabase.rpc("admin_risk_overview", { p_limit: 100 }),
    supabase.rpc("admin_recent_sign_ins", { p_limit: 20 }),
  ]);
  const adminSignIns = (signIns ?? []) as AdminSignIn[];
  if (statusError || rowsError) throw new Error((statusError ?? rowsError)!.message);

  const s = status as Status;
  const limits: Limits = { ...DEFAULTS, ...(s.settings ?? {}) };
  const accounts = (rows as RiskRow[]).filter((r) => r.score > 0);
  const flagged = accounts.filter((r) => r.score >= limits.flag_score).length;

  return (
    <>
      <PageHeader
        title="Security"
        description="Content protection: who is reading the library faster than a student would, and the daily limits that slow them down."
      />

      {s.gate_configured ? (
        <p className="mb-6 rounded-[var(--radius-md)] bg-success-50 px-4 py-3 text-sm text-success-700">
          Server gate is on. Exams and practice only load through this website
          {s.blocked_24h ? ` · ${s.blocked_24h} direct-access attempt${s.blocked_24h === 1 ? "" : "s"} blocked in the last 24 hours` : ""}.
        </p>
      ) : (
        <div className="mb-6 rounded-[var(--radius-md)] bg-warning-50 px-4 py-3 text-sm text-warning-700">
          <p className="font-medium">Server gate is not configured.</p>
          <p className="mt-1">
            Any student can still load exams with their login token outside the website. Set <code>SUPABASE_GATE_SECRET</code> in the server
            environment, redeploy, then run <code>select private.set_server_gate(&apos;the same value&apos;);</code> in the Supabase SQL editor.
          </p>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <Panel title={`Accounts by risk · last 7 days${flagged ? ` · ${flagged} flagged` : ""}`}>
          {accounts.length ? (
            <DataTable>
              <thead>
                <tr>
                  <Th>Student</Th>
                  <Th>Risk</Th>
                  <Th>Signals</Th>
                  <Th>Last seen</Th>
                </tr>
              </thead>
              <tbody>
                {accounts.map((r) => (
                  <tr key={r.id} className="hover:bg-paper">
                    <Td>
                      <Link href={`/admin/students/${r.id}`} className="font-medium text-ink-950 hover:underline">
                        {r.full_name || r.email}
                      </Link>
                      <p className="text-xs text-ink-500">
                        {r.email} · {r.premium ? "Premium" : "Free"}
                      </p>
                    </Td>
                    <Td>
                      <span
                        className={cn(
                          "inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold tabular",
                          r.score >= limits.flag_score ? "bg-danger-50 text-danger-600" : r.score >= limits.flag_score / 2 ? "bg-warning-50 text-warning-700" : "bg-paper-2 text-ink-700",
                        )}
                      >
                        {r.score}
                        {r.score >= limits.flag_score ? " · flagged" : ""}
                      </span>
                    </Td>
                    <Td className="text-xs text-ink-600">
                      <SignalList s={r.signals} limits={limits} />
                    </Td>
                    <Td className="whitespace-nowrap text-xs text-ink-500">{r.last_seen ? adminDate.format(new Date(r.last_seen)) : "—"}</Td>
                  </tr>
                ))}
              </tbody>
            </DataTable>
          ) : (
            <Empty>No unusual activity in the last 7 days.</Empty>
          )}
        </Panel>

        <div className="space-y-6">
          <Panel title="Trace a leak">
            <div className="space-y-3 px-5 py-4">
              <p className="text-xs text-ink-600">
                Exam screens carry a faint code (&quot;TS&quot; + 8 characters + date). Boost the contrast of a leaked screenshot to read it. Copied
                text carries the same code invisibly: paste it here as-is.
              </p>
              <TraceForm />
            </div>
          </Panel>
          <Panel title="Admin sign-ins · 30 days">
            {adminSignIns.length ? (
              <ul className="divide-y divide-line">
                {adminSignIns.map((a) => (
                  <li key={`${a.created_at}-${a.email}`} className="px-5 py-3 text-xs">
                    <p className="font-medium text-ink-900">{a.full_name || a.email}</p>
                    <p className="text-ink-500">
                      {[a.place, a.ip].filter(Boolean).join(" · ") || "Location unknown"} · {adminDate.format(new Date(a.created_at))}
                    </p>
                  </li>
                ))}
              </ul>
            ) : (
              <Empty>No admin sign-ins recorded yet.</Empty>
            )}
            <p className="border-t border-line px-5 py-3 text-xs text-ink-500">A sign-in you don&apos;t recognise? Change that admin&apos;s password at once.</p>
          </Panel>
          <Panel title="Daily limits">
            <div className="px-5 py-4">
              <LimitsForm limits={limits} />
            </div>
          </Panel>
          <Panel title="How the score works">
            <ul className="space-y-1.5 px-5 py-4 text-xs text-ink-600">
              <li>Direct access outside the website: 100</li>
              <li>Exam closed with under 20% answered: 15 each (max 45)</li>
              <li>80%+ of finished practice skipped (100+ questions): 30</li>
              <li>4+ IP addresses in 24 h: 20 · 8+: 40</li>
              <li>Hit the exam or practice limit: 15 each</li>
              <li>4+ devices in 30 days: 20 · 6+: 40</li>
              <li>Sign-ins from 3+ devices in 24 h: 20</li>
              <li>Impossible travel (300+ km at 800+ km/h): 30 each (max 60)</li>
              <li className="pt-1">Flagged accounts get half the daily limits. Suspend from the student&apos;s page.</li>
            </ul>
          </Panel>
        </div>
      </div>
    </>
  );
}

function SignalList({ s, limits }: { s: Signals; limits: Limits }) {
  const items = [
    s.blocked_7d ? { text: `${s.blocked_7d} direct-access attempt${s.blocked_7d === 1 ? "" : "s"}`, bad: true } : null,
    s.rushed_7d ? { text: `${s.rushed_7d} exam${s.rushed_7d === 1 ? "" : "s"} closed nearly empty`, bad: s.rushed_7d >= 2 } : null,
    s.attempts_24h ? { text: `${s.attempts_24h}/${limits.max_new_attempts_per_day} exams today`, bad: s.attempts_24h >= limits.max_new_attempts_per_day } : null,
    s.practice_24h
      ? { text: `${s.practice_24h}/${limits.max_practice_questions_per_day} practice today`, bad: s.practice_24h >= limits.max_practice_questions_per_day }
      : null,
    s.practice_finished_7d
      ? { text: `${s.practice_skipped_7d}/${s.practice_finished_7d} practice skipped`, bad: s.practice_finished_7d >= 100 && s.practice_skipped_7d >= 0.8 * s.practice_finished_7d }
      : null,
    s.ips_24h > 1 ? { text: `${s.ips_24h} IPs today`, bad: s.ips_24h >= 4 } : null,
    s.devices_30d && s.devices_30d > 1 ? { text: `${s.devices_30d} devices this month`, bad: s.devices_30d >= 4 } : null,
    s.signin_devices_24h && s.signin_devices_24h > 1 ? { text: `signed in from ${s.signin_devices_24h} devices today`, bad: s.signin_devices_24h >= 3 } : null,
    s.travel_7d ? { text: `${s.travel_7d} impossible-travel jump${s.travel_7d === 1 ? "" : "s"}`, bad: true } : null,
  ].filter((x): x is { text: string; bad: boolean } => Boolean(x));
  return (
    <ul className="space-y-0.5">
      {items.map((i) => (
        <li key={i.text} className={i.bad ? "font-medium text-danger-600" : undefined}>
          {i.text}
        </li>
      ))}
    </ul>
  );
}
