import { requestTime } from "@/lib/time";
import Link from "next/link";
import { Input } from "@/components/ui/field";
import { DataTable, Empty, Panel, PageHeader, Td, Th, adminDay } from "@/components/admin/ui";
import { cn } from "@/lib/utils";
import { adminClient } from "@/lib/admin/server";

export const metadata = { title: "Students" };

const PAGE = 50;

export default async function Students({ searchParams }: PageProps<"/admin/students">) {
  const { supabase } = await adminClient();
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q.trim().slice(0, 100) : "";
  const access = typeof sp.access === "string" ? sp.access : "";
  const page = Math.max(1, Number(sp.page) || 1);
  const deleted = typeof sp.deleted === "string" ? sp.deleted : "";

  const now = requestTime();
  const nowIso = new Date(now).toISOString();
  const since30 = new Date(now - 30 * 86400000).toISOString();

  // Who has premium right now (used for both the tiles and the Premium/Free filters).
  const [{ data: activeSubs }, { count: totalAll }, { count: new30 }, { count: admins }] = await Promise.all([
    supabase.from("subscriptions").select("user_id").eq("status", "active").lte("current_period_start", nowIso).gt("current_period_end", nowIso),
    supabase.from("profiles").select("id", { count: "exact", head: true }),
    supabase.from("profiles").select("id", { count: "exact", head: true }).gte("created_at", since30),
    supabase.from("profiles").select("id", { count: "exact", head: true }).eq("role", "admin"),
  ]);
  const premiumIds = [...new Set((activeSubs ?? []).map((s) => s.user_id))];

  let query = supabase
    .from("profiles")
    .select("id, email, full_name, phone, role, created_at, subscriptions!subscriptions_user_id_fkey(status, current_period_start, current_period_end), exam_attempts(count)", { count: "exact" })
    .order("created_at", { ascending: false })
    .range((page - 1) * PAGE, page * PAGE - 1);
  if (q) {
    const safe = q.replace(/[%,()]/g, " ");
    query = query.or(`email.ilike.%${safe}%,full_name.ilike.%${safe}%,phone.ilike.%${safe}%`);
  }
  if (access === "admin") query = query.eq("role", "admin");
  if (access === "new") query = query.gte("created_at", since30);
  if (access === "premium") query = query.in("id", premiumIds.length ? premiumIds : ["00000000-0000-0000-0000-000000000000"]);
  if (access === "free" && premiumIds.length) query = query.not("id", "in", `(${premiumIds.join(",")})`);
  const { data: rows, count, error } = await query;
  if (error) throw new Error(error.message);

  const students = (rows ?? [])
    .map((r) => {
      const active = (r.subscriptions ?? []).find(
        (s) => s.status === "active" && Date.parse(s.current_period_start) <= now && Date.parse(s.current_period_end) > now,
      );
      const lastEnd = (r.subscriptions ?? []).map((s) => s.current_period_end).filter(Boolean).sort().at(-1);
      const attempts = Array.isArray(r.exam_attempts) ? (r.exam_attempts[0] as { count: number } | undefined)?.count ?? 0 : 0;
      return { ...r, active, lastEnd, attempts };
    });

  const pages = Math.max(1, Math.ceil((count ?? 0) / PAGE));
  const qs = (p: number) => `/admin/students?${new URLSearchParams({ ...(q ? { q } : {}), ...(access ? { access } : {}), page: String(p) })}`;

  return (
    <>
      <PageHeader title="Students" description="Search and filter every account. Open a student to edit, grant access, suspend or delete." />
      {deleted ? <p className="mb-4 rounded-[var(--radius-md)] bg-success-50 px-4 py-3 text-sm text-success-700">Deleted {deleted}.</p> : null}
      <div className="grid grid-cols-2 gap-px overflow-hidden rounded-[var(--radius-lg)] bg-line ring-1 ring-line sm:grid-cols-5">
        {[
          { k: "", label: "All students", v: totalAll ?? 0 },
          { k: "premium", label: "Premium now", v: premiumIds.length, tone: "text-success-700" },
          { k: "free", label: "Free", v: Math.max(0, (totalAll ?? 0) - premiumIds.length), tone: "text-mark-500" },
          { k: "new", label: "New (30 days)", v: new30 ?? 0 },
          { k: "admin", label: "Admins", v: admins ?? 0 },
        ].map((t) => (
          <Link
            key={t.k}
            href={`/admin/students?${new URLSearchParams({ ...(q ? { q } : {}), ...(t.k ? { access: t.k } : {}) })}`}
            className={cn("px-4 py-4 transition", access === t.k ? "bg-mark-50 shadow-[inset_0_-3px_0_var(--color-mark-500)]" : "bg-white hover:bg-paper")}
          >
            <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.1em] text-ink-500">{t.label}</p>
            <p className={cn("mt-1.5 font-display text-3xl tabular", t.tone ?? "text-ink-950")}>{t.v.toLocaleString("en")}</p>
          </Link>
        ))}
      </div>
      <form className="mb-4 mt-5 flex flex-wrap gap-2" action="/admin/students">
        {access ? <input type="hidden" name="access" value={access} /> : null}
        <Input name="q" defaultValue={q} placeholder="Search name, email or phone" className="max-w-sm" />
        <button className="h-11 rounded-[var(--radius-md)] bg-ink-950 px-4 text-sm font-medium text-paper">Search</button>
        {q || access ? (
          <Link href="/admin/students" className="self-center text-sm font-medium text-ink-500 hover:text-ink-950">
            Clear
          </Link>
        ) : null}
        <span className="ml-auto self-center text-sm text-ink-500">{count ?? 0} shown</span>
      </form>
      <Panel>
        {students.length ? (
          <DataTable>
            <thead>
              <tr>
                <Th>Student</Th>
                <Th>Access</Th>
                <Th>Attempts</Th>
                <Th>Joined</Th>
                <Th className="text-right"> </Th>
              </tr>
            </thead>
            <tbody>
              {students.map((s) => (
                <tr key={s.id} className="hover:bg-paper">
                  <Td>
                    <Link href={`/admin/students/${s.id}`} className="font-medium text-ink-950 hover:underline">
                      {s.full_name || s.email}
                    </Link>
                    <p className="text-xs text-ink-500">
                      {s.email}
                      {s.role === "admin" ? " · Administrator" : ""}
                    </p>
                  </Td>
                  <Td>
                    {s.active ? (
                      <span className="text-success-700">Premium until {adminDay.format(new Date(s.active.current_period_end))}</span>
                    ) : s.lastEnd ? (
                      <span className="text-ink-500">Expired {adminDay.format(new Date(s.lastEnd))}</span>
                    ) : (
                      <span className="text-ink-500">Free</span>
                    )}
                  </Td>
                  <Td className="tabular">{s.attempts}</Td>
                  <Td className="text-ink-500">{adminDay.format(new Date(s.created_at))}</Td>
                  <Td className="text-right">
                    <Link href={`/admin/students/${s.id}`} className="rounded-md px-2.5 py-1 text-xs font-semibold text-ink-700 ring-1 ring-line hover:bg-paper-2">
                      Manage
                    </Link>
                  </Td>
                </tr>
              ))}
            </tbody>
          </DataTable>
        ) : (
          <Empty>No students match.</Empty>
        )}
      </Panel>
      {pages > 1 ? (
        <div className="mt-4 flex items-center justify-between text-sm">
          {page > 1 ? <Link href={qs(page - 1)} className="text-ink-700 hover:underline">← Previous</Link> : <span />}
          <span className="text-ink-500">
            Page {page} of {pages}
          </span>
          {page < pages ? <Link href={qs(page + 1)} className="text-ink-700 hover:underline">Next →</Link> : <span />}
        </div>
      ) : null}
    </>
  );
}
