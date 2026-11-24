import { adminClient } from "@/lib/admin/server";
import { ACCESS_FILTERS, loadAccessSets, type AccessFilter } from "@/lib/admin/students";

/** Every student (or one access group) as a spreadsheet-friendly CSV. */
export async function GET(request: Request) {
  const { supabase } = await adminClient();
  const raw = new URL(request.url).searchParams.get("access") ?? "";
  const access = (ACCESS_FILTERS.includes(raw as AccessFilter) ? raw : "") as AccessFilter;
  const now = Date.now();

  const [sets, { data: profiles, error }, { data: attempts }, { data: paid }] = await Promise.all([
    loadAccessSets(supabase, now),
    supabase.from("profiles").select("id, full_name, email, phone, school, grade, role, created_at").order("created_at", { ascending: false }).limit(50000),
    supabase.from("exam_attempts").select("user_id, status, percent").limit(200000),
    supabase.from("payments").select("user_id, amount_cents").eq("status", "succeeded").limit(100000),
  ]);
  if (error) return new Response(error.message, { status: 500 });

  const stats = new Map<string, { n: number; done: number; sum: number }>();
  for (const a of attempts ?? []) {
    const s = stats.get(a.user_id) ?? { n: 0, done: 0, sum: 0 };
    s.n++;
    if (a.status !== "in_progress" && a.percent != null) {
      s.done++;
      s.sum += Number(a.percent);
    }
    stats.set(a.user_id, s);
  }
  const spent = new Map<string, number>();
  for (const p of paid ?? []) spent.set(p.user_id, (spent.get(p.user_id) ?? 0) + p.amount_cents);

  const since30 = now - 30 * 86_400_000;
  const keep = (p: { id: string; role: string; created_at: string }) =>
    !access ||
    (access === "free" ? !sets.premium.has(p.id) : access === "new" ? Date.parse(p.created_at) >= since30 : access === "admin" ? p.role === "admin" : sets[access].has(p.id));

  const cell = (v: unknown) => {
    const s = v == null ? "" : String(v);
    // Quote everything; neutralise spreadsheet formulas.
    return `"${(/^[=+\-@]/.test(s) ? `'${s}` : s).replace(/"/g, '""')}"`;
  };
  const header = ["Name", "Email", "Phone", "School", "Grade", "Role", "Joined", "Access", "Premium until", "Exam attempts", "Average score %", "Total paid"];
  const lines = (profiles ?? []).filter(keep).map((p) => {
    const s = stats.get(p.id);
    const end = sets.lastEnd.get(p.id);
    return [
      p.full_name,
      p.email,
      p.phone,
      p.school,
      p.grade,
      p.role,
      p.created_at.slice(0, 10),
      sets.premium.has(p.id) ? "Premium" : sets.expired.has(p.id) ? "Expired" : "Free",
      sets.premium.has(p.id) && end ? new Date(end).toISOString().slice(0, 10) : "",
      s?.n ?? 0,
      s?.done ? Math.round(s.sum / s.done) : "",
      ((spent.get(p.id) ?? 0) / 100).toFixed(2),
    ]
      .map(cell)
      .join(",");
  });

  const csv = "﻿" + [header.map(cell).join(","), ...lines].join("\r\n");
  const stamp = new Date(now).toISOString().slice(0, 10);
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="students-${access || "all"}-${stamp}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
