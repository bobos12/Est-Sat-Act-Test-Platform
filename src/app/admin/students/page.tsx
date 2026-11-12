import { requestTime } from "@/lib/time";
import Link from "next/link";
import { Input } from "@/components/ui/field";
import { DataTable, Empty, Panel, PageHeader, Select, Td, Th, adminDay } from "@/components/admin/ui";
import { adminClient } from "@/lib/admin/server";

export const metadata = { title: "Students" };

const PAGE = 50;

export default async function Students({ searchParams }: PageProps<"/admin/students">) {
  const { supabase } = await adminClient();
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q.trim().slice(0, 100) : "";
  const access = typeof sp.access === "string" ? sp.access : "";
  const page = Math.max(1, Number(sp.page) || 1);

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
  const { data: rows, count, error } = await query;
  if (error) throw new Error(error.message);

  const now = requestTime();
  const students = (rows ?? [])
    .map((r) => {
      const active = (r.subscriptions ?? []).find(
        (s) => s.status === "active" && Date.parse(s.current_period_start) <= now && Date.parse(s.current_period_end) > now,
      );
      const lastEnd = (r.subscriptions ?? []).map((s) => s.current_period_end).filter(Boolean).sort().at(-1);
      const attempts = Array.isArray(r.exam_attempts) ? (r.exam_attempts[0] as { count: number } | undefined)?.count ?? 0 : 0;
      return { ...r, active, lastEnd, attempts };
    })
    .filter((r) => (access === "premium" ? r.active : access === "free" ? !r.active : true));

  const pages = Math.max(1, Math.ceil((count ?? 0) / PAGE));
  const qs = (p: number) => `/admin/students?${new URLSearchParams({ ...(q ? { q } : {}), ...(access ? { access } : {}), page: String(p) })}`;

  return (
    <>
      <PageHeader title="Students" description={`${count ?? 0} registered accounts.`} />
      <form className="mb-4 flex flex-wrap gap-3" action="/admin/students">
        <Input name="q" defaultValue={q} placeholder="Search name, email or phone" className="max-w-sm" />
        <Select name="access" defaultValue={access} className="max-w-44">
          <option value="">Everyone</option>
          <option value="premium">Premium now</option>
          <option value="free">Free only</option>
          <option value="admin">Administrators</option>
        </Select>
        <button className="h-11 rounded-[var(--radius-md)] bg-ink-950 px-4 text-sm font-medium text-paper">Search</button>
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
