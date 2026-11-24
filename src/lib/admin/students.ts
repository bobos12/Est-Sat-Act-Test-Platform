import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

export type AccessFilter = "" | "premium" | "expiring" | "expired" | "free" | "new" | "admin";
export const ACCESS_FILTERS: AccessFilter[] = ["", "premium", "expiring", "expired", "free", "new", "admin"];

/** Who is premium right now, who runs out within 7 days, and who had premium before. */
export async function loadAccessSets(supabase: SupabaseClient, now: number) {
  const nowIso = new Date(now).toISOString();
  const [{ data: live }, { data: ever }] = await Promise.all([
    supabase.from("subscriptions").select("user_id, current_period_start, current_period_end").eq("status", "active").gt("current_period_end", nowIso),
    supabase.from("subscriptions").select("user_id").in("status", ["active", "expired", "canceled"]).limit(50000),
  ]);
  const premium = new Set<string>();
  const lastEnd = new Map<string, number>();
  for (const s of live ?? []) {
    if (Date.parse(s.current_period_start!) <= now) premium.add(s.user_id);
    lastEnd.set(s.user_id, Math.max(lastEnd.get(s.user_id) ?? 0, Date.parse(s.current_period_end!)));
  }
  const expiring = new Set([...premium].filter((id) => (lastEnd.get(id) ?? 0) < now + 7 * 86_400_000));
  const expired = new Set((ever ?? []).map((s) => s.user_id).filter((id) => !premium.has(id)));
  return { premium, expiring, expired, lastEnd };
}

export function searchFilter(q: string) {
  const safe = q.replace(/[%,()*\\]/g, " ").trim();
  return safe ? `email.ilike.%${safe}%,full_name.ilike.%${safe}%,phone.ilike.%${safe}%,school.ilike.%${safe}%` : null;
}

/** Per-student activity and spend for a page of students. */
export async function loadStudentActivity(supabase: SupabaseClient, ids: string[]) {
  if (!ids.length) return new Map<string, { attempts: number; completed: number; avg: number | null; lastActive: string | null; paid: Record<string, number> }>();
  const [{ data: attempts }, { data: practice }, { data: paid }] = await Promise.all([
    supabase.from("exam_attempts").select("user_id, status, percent, last_activity_at").in("user_id", ids).limit(10000),
    supabase.from("practice_sessions").select("user_id, last_activity_at").in("user_id", ids).order("last_activity_at", { ascending: false }).limit(2000),
    supabase.from("payments").select("user_id, amount_cents, currency").in("user_id", ids).eq("status", "succeeded"),
  ]);
  const out = new Map(ids.map((id) => [id, { attempts: 0, completed: 0, sum: 0, lastActive: null as string | null, paid: {} as Record<string, number> }]));
  const touch = (id: string, at: string | null) => {
    const r = out.get(id);
    if (r && at && (!r.lastActive || at > r.lastActive)) r.lastActive = at;
  };
  for (const a of attempts ?? []) {
    const r = out.get(a.user_id)!;
    r.attempts++;
    if (a.status !== "in_progress" && a.percent != null) {
      r.completed++;
      r.sum += Number(a.percent);
    }
    touch(a.user_id, a.last_activity_at);
  }
  for (const p of practice ?? []) touch(p.user_id, p.last_activity_at);
  for (const p of paid ?? []) {
    const r = out.get(p.user_id)!;
    r.paid[p.currency] = (r.paid[p.currency] ?? 0) + p.amount_cents;
  }
  return new Map([...out].map(([id, r]) => [id, { attempts: r.attempts, completed: r.completed, avg: r.completed ? Math.round(r.sum / r.completed) : null, lastActive: r.lastActive, paid: r.paid }]));
}
