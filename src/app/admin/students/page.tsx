import Link from "next/link";
import { SearchBox, btn } from "@/components/admin/client";
import { Icon } from "@/components/admin/icons";
import { Avatar, Badge, Empty, FilterTabs, PageHeader, Pagination, Panel, ScorePill, StatCard, Th, adminDay, money, relative } from "@/components/admin/ui";
import { adminClient } from "@/lib/admin/server";
import { ACCESS_FILTERS, loadAccessSets, loadStudentActivity, searchFilter, type AccessFilter } from "@/lib/admin/students";
import { requestTime } from "@/lib/time";
import { cn } from "@/lib/utils";

export const metadata = { title: "Students" };

const PAGE = 50;
const SORTS = { new: "Newest first", old: "Oldest first", name: "Name A–Z" } as const;
type Sort = keyof typeof SORTS;

export default async function Students({ searchParams }: PageProps<"/admin/students">) {
  const { supabase } = await adminClient();
  const sp = await searchParams;
  const str = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string) : "");
  const q = str("q").trim().slice(0, 100);
  const access = (ACCESS_FILTERS.includes(str("access") as AccessFilter) ? str("access") : "") as AccessFilter;
  const sort: Sort = str("sort") in SORTS ? (str("sort") as Sort) : "new";
  const page = Math.max(1, Number(sp.page) || 1);

  const now = requestTime();
  const since30 = new Date(now - 30 * 86_400_000).toISOString();
  const search = searchFilter(q);

  const [sets, { count: totalAll }, { count: new30 }, { count: admins }] = await Promise.all([
    loadAccessSets(supabase, now),
    supabase.from("profiles").select("id", { count: "exact", head: true }),
    supabase.from("profiles").select("id", { count: "exact", head: true }).gte("created_at", since30),
    supabase.from("profiles").select("id", { count: "exact", head: true }).eq("role", "admin"),
  ]);

  const cols = "id, email, full_name, phone, school, grade, role, created_at";
  const order = (query: ReturnType<typeof base>) =>
    sort === "name" ? query.order("full_name", { ascending: true }).order("email") : query.order("created_at", { ascending: sort === "old" });
  function base(select: string, opts?: { count: "exact" }) {
    let query = supabase.from("profiles").select(select, opts);
    if (search) query = query.or(search);
    return query;
  }

  let rows: { id: string; email: string; full_name: string; phone: string | null; school: string | null; grade: string | null; role: string; created_at: string }[] = [];
  let total = 0;
  if (access === "premium" || access === "expiring" || access === "expired" || access === "free") {
    // Membership comes from subscriptions, so filter a light id list here and fetch only this page's rows.
    const { data: light, error } = await order(base("id")).limit(20000);
    if (error) throw new Error(error.message);
    const ids = (light as unknown as { id: string }[]).map((r) => r.id).filter((id) => (access === "free" ? !sets.premium.has(id) : sets[access].has(id)));
    total = ids.length;
    const pageIds = ids.slice((page - 1) * PAGE, page * PAGE);
    if (pageIds.length) {
      const { data } = await supabase.from("profiles").select(cols).in("id", pageIds);
      const pos = new Map(pageIds.map((id, i) => [id, i]));
      rows = (data ?? []).sort((a, b) => pos.get(a.id)! - pos.get(b.id)!);
    }
  } else {
    let query = order(base(cols, { count: "exact" }));
    if (access === "admin") query = query.eq("role", "admin");
    if (access === "new") query = query.gte("created_at", since30);
    const { data, count, error } = await query.range((page - 1) * PAGE, page * PAGE - 1);
    if (error) throw new Error(error.message);
    rows = (data ?? []) as unknown as typeof rows;
    total = count ?? 0;
  }

  const activity = await loadStudentActivity(
    supabase,
    rows.map((r) => r.id),
  );

  const pages = Math.max(1, Math.ceil(total / PAGE));
  const link = (patch: Record<string, string>) => {
    const next = new URLSearchParams({ ...(q ? { q } : {}), ...(access ? { access } : {}), ...(sort !== "new" ? { sort } : {}), ...patch });
    for (const [k, v] of [...next]) if (!v) next.delete(k);
    return `/admin/students${next.size ? `?${next}` : ""}`;
  };
  const free = Math.max(0, (totalAll ?? 0) - sets.premium.size);

  return (
    <>
      <PageHeader
        title="Students"
        description="Everyone with an account. Click a student to see their scores, payments and devices, and to manage their access."
        actions={
          <a href={`/admin/students/export${access ? `?access=${access}` : ""}`} className={btn("secondary")} download>
            <Icon name="download" size={15} /> Export CSV
          </a>
        }
      />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="All students" value={(totalAll ?? 0).toLocaleString("en")} note={`+${new30 ?? 0} in 30 days`} href={link({ access: "", page: "" })} active={!access} icon="users" />
        <StatCard
          label="Premium now"
          value={sets.premium.size.toLocaleString("en")}
          note={`${sets.expiring.size} expiring in 7 days`}
          href={link({ access: "premium", page: "" })}
          active={access === "premium"}
          icon="crown"
          tone="success"
        />
        <StatCard label="Free" value={free.toLocaleString("en")} note={`${sets.expired.size} used to be premium`} href={link({ access: "free", page: "" })} active={access === "free"} icon="lock" tone="brand" />
        <StatCard
          label="Expiring soon"
          value={sets.expiring.size.toLocaleString("en")}
          note="Premium ends within 7 days"
          href={link({ access: "expiring", page: "" })}
          active={access === "expiring"}
          icon="clock"
          tone="warning"
        />
      </div>

      <Panel className="mt-6">
        <div className="flex flex-col gap-3 border-b border-line p-4 lg:flex-row lg:items-center">
          <FilterTabs
            items={[
              { label: "All", href: link({ access: "", page: "" }), active: !access, count: totalAll ?? 0 },
              { label: "Premium", href: link({ access: "premium", page: "" }), active: access === "premium", count: sets.premium.size },
              { label: "Expiring", href: link({ access: "expiring", page: "" }), active: access === "expiring", count: sets.expiring.size },
              { label: "Expired", href: link({ access: "expired", page: "" }), active: access === "expired", count: sets.expired.size },
              { label: "Free", href: link({ access: "free", page: "" }), active: access === "free", count: free },
              { label: "New (30d)", href: link({ access: "new", page: "" }), active: access === "new", count: new30 ?? 0 },
              { label: "Admins", href: link({ access: "admin", page: "" }), active: access === "admin", count: admins ?? 0 },
            ]}
          />
          <div className="flex flex-1 items-center gap-2 lg:justify-end">
            <SearchBox placeholder="Name, email, phone or school" className="flex-1 lg:max-w-xs" />
            <SortMenu sort={sort} link={link} />
          </div>
        </div>

        {q ? (
          <p className="border-b border-line bg-mark-50/50 px-5 py-2 text-sm text-ink-600">
            {total.toLocaleString("en")} result{total === 1 ? "" : "s"} for <b className="text-ink-950">“{q}”</b> ·{" "}
            <Link href={link({ q: "", page: "" })} className="font-medium text-mark-600 hover:underline">
              clear search
            </Link>
          </p>
        ) : null}

        {rows.length ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-left text-sm">
              <thead>
                <tr>
                  <Th>Student</Th>
                  <Th>Access</Th>
                  <Th>Exams</Th>
                  <Th>Last active</Th>
                  <Th>Total paid</Th>
                  <Th>Joined</Th>
                  <Th className="w-10" />
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {rows.map((s) => {
                  const a = activity.get(s.id);
                  const premium = sets.premium.has(s.id);
                  const end = sets.lastEnd.get(s.id);
                  const daysLeft = end ? Math.ceil((end - now) / 86_400_000) : 0;
                  const paid = Object.entries(a?.paid ?? {});
                  const href = `/admin/students/${s.id}`;
                  return (
                    <tr key={s.id} className="group transition hover:bg-paper">
                      <td className="px-5 py-3">
                        <Link href={href} className="flex items-center gap-3">
                          <Avatar name={s.full_name || s.email} />
                          <span className="min-w-0">
                            <span className="flex items-center gap-2 font-medium text-ink-950 group-hover:text-mark-600">
                              <span className="truncate">{s.full_name || <span className="text-ink-500">No name</span>}</span>
                              {s.role === "admin" ? <Badge tone="dark">Admin</Badge> : null}
                            </span>
                            <span className="block truncate text-xs text-ink-500">
                              {s.email}
                              {s.phone ? ` · ${s.phone}` : ""}
                            </span>
                          </span>
                        </Link>
                      </td>
                      <td className="px-5 py-3">
                        {premium ? (
                          <div>
                            <Badge tone={daysLeft <= 7 ? "warning" : "success"} icon="crown">
                              Premium
                            </Badge>
                            <p className={cn("mt-1 text-xs", daysLeft <= 7 ? "font-medium text-warning-700" : "text-ink-500")}>
                              {daysLeft <= 1 ? "Ends today" : `${daysLeft} days left`} · {adminDay.format(new Date(end!))}
                            </p>
                          </div>
                        ) : sets.expired.has(s.id) ? (
                          <Badge tone="neutral">Expired</Badge>
                        ) : (
                          <Badge tone="brand">Free</Badge>
                        )}
                      </td>
                      <td className="px-5 py-3">
                        {a?.attempts ? (
                          <span className="flex items-center gap-2">
                            <span className="tabular text-ink-900">{a.attempts}</span>
                            {a.avg != null ? <ScorePill percent={a.avg} /> : null}
                          </span>
                        ) : (
                          <span className="text-ink-400">None</span>
                        )}
                      </td>
                      <td className="px-5 py-3 text-ink-600">{a?.lastActive ? relative(a.lastActive, now) : <span className="text-ink-400">Never</span>}</td>
                      <td className="px-5 py-3 tabular text-ink-900">{paid.length ? paid.map(([c, v]) => money(v, c)).join(" · ") : <span className="text-ink-400">—</span>}</td>
                      <td className="px-5 py-3 text-ink-600">{adminDay.format(new Date(s.created_at))}</td>
                      <td className="px-3 py-3 text-right">
                        <Link href={href} aria-label="Open" className="inline-flex h-8 w-8 items-center justify-center rounded-md text-ink-400 transition group-hover:bg-white group-hover:text-mark-600 group-hover:ring-1 group-hover:ring-line">
                          <Icon name="chevronRight" size={16} />
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty icon="users" action={q || access ? <Link href="/admin/students" className={btn("secondary", "sm")}>Clear filters</Link> : undefined}>
            {q ? `No students match “${q}”.` : "No students in this group."}
          </Empty>
        )}
        <div className="border-t border-line">
          <Pagination page={page} pages={pages} href={(p) => link({ page: String(p) })} total={total} />
        </div>
      </Panel>
    </>
  );
}

function SortMenu({ sort, link }: { sort: Sort; link: (p: Record<string, string>) => string }) {
  return (
    <div className="flex shrink-0 rounded-[var(--radius-md)] ring-1 ring-inset ring-line-strong">
      {(Object.keys(SORTS) as Sort[]).map((k, i) => (
        <Link
          key={k}
          href={link({ sort: k === "new" ? "" : k, page: "" })}
          scroll={false}
          title={SORTS[k]}
          className={cn(
            "flex h-10 items-center px-3 text-xs font-semibold transition",
            i === 0 && "rounded-l-[var(--radius-md)]",
            i === 2 && "rounded-r-[var(--radius-md)]",
            sort === k ? "bg-ink-950 text-white" : "text-ink-600 hover:bg-paper-2",
          )}
        >
          {{ new: "Newest", old: "Oldest", name: "A–Z" }[k]}
        </Link>
      ))}
    </div>
  );
}
