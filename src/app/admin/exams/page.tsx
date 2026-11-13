import Link from "next/link";
import { ButtonLink } from "@/components/ui/button";
import { Empty, PageHeader, StatusBadge, adminDay } from "@/components/admin/ui";
import { adminClient } from "@/lib/admin/server";
import { cn } from "@/lib/utils";
import { bulkExams } from "./actions";
import { SelectAll } from "./select-all";

export const metadata = { title: "Exams" };

type Filters = { q: string; track: string; subject: string; access: string; status: string };
const TRACKS = [
  { key: "est", label: "EST" },
  { key: "sat", label: "SAT" },
  { key: "act", label: "ACT" },
];
const STATUSES = [
  { key: "published", label: "Published" },
  { key: "draft", label: "Draft" },
  { key: "in_review", label: "In review" },
  { key: "archived", label: "Archived" },
];
const trackOf = (code: string) => (code.startsWith("sat") ? "sat" : code.startsWith("act") ? "act" : "est");

export default async function AdminExams({ searchParams }: PageProps<"/admin/exams">) {
  const { supabase } = await adminClient();
  const sp = await searchParams;
  const one = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string) : "");
  const f: Filters = { q: one("q").trim(), track: one("track"), subject: one("subject"), access: one("access"), status: one("status") };
  const ok = one("ok");
  const err = one("error");

  const [{ data: exams, error }, { data: subjects }] = await Promise.all([
    supabase
      .from("exams")
      .select("id, slug, title, status, access, kind, duration_minutes, question_count, origin, updated_at, subjects(code, name), exam_attempts(count)")
      .order("updated_at", { ascending: false }),
    supabase.from("subjects").select("code, name").order("sort_order"),
  ]);
  if (error) throw new Error(error.message);

  const all = (exams ?? []).map((e) => {
    const subject = Array.isArray(e.subjects) ? e.subjects[0] : e.subjects;
    const attempts = Array.isArray(e.exam_attempts) ? ((e.exam_attempts[0] as { count: number } | undefined)?.count ?? 0) : 0;
    return { ...e, subject, track: trackOf(subject?.code ?? ""), attempts };
  });

  // Everything except the filter being counted, so the numbers tell you what a click will show.
  const match = (e: (typeof all)[number], skip?: keyof Filters) =>
    (skip === "q" || !f.q || e.title.toLowerCase().includes(f.q.toLowerCase())) &&
    (skip === "track" || !f.track || e.track === f.track) &&
    (skip === "subject" || !f.subject || e.subject?.code === f.subject) &&
    (skip === "access" || !f.access || e.access === f.access) &&
    (skip === "status" || !f.status || e.status === f.status);
  const visible = all.filter((e) => match(e));

  const href = (patch: Partial<Filters>) => {
    const next = { ...f, ...patch };
    if (patch.track !== undefined) next.subject = "";
    const qs = new URLSearchParams(Object.entries(next).filter(([, v]) => v) as [string, string][]).toString();
    return qs ? `/admin/exams?${qs}` : "/admin/exams";
  };
  const back = href({}).replace("/admin/exams", "");
  const count = (k: keyof Filters, v: string) => all.filter((e) => match(e, k) && (v === "" || (k === "track" ? e.track === v : k === "access" ? e.access === v : k === "status" ? e.status === v : true))).length;
  const subjectsInTrack = (subjects ?? []).filter((s) => !f.track || trackOf(s.code) === f.track);

  const tiles = [
    { label: "All exams", value: count("status", ""), href: href({ status: "", access: "" }), active: !f.status && !f.access },
    { label: "Published", value: count("status", "published"), href: href({ status: "published" }), active: f.status === "published", tone: "text-success-700" },
    { label: "Draft / review", value: count("status", "draft") + count("status", "in_review"), href: href({ status: "draft" }), active: f.status === "draft" || f.status === "in_review", tone: "text-warning-700" },
    { label: "Free", value: count("access", "free"), href: href({ access: "free" }), active: f.access === "free", tone: "text-mark-500" },
    { label: "Premium", value: count("access", "premium"), href: href({ access: "premium" }), active: f.access === "premium" },
    { label: "Questions", value: visible.reduce((n, e) => n + e.question_count, 0), href: null, active: false },
  ];

  return (
    <>
      <PageHeader
        title="Exams"
        description="Filter, review and publish exams. Tick several to change them in one go."
        actions={
          <>
            <ButtonLink href="/admin/knowledge" variant="secondary">
              Upload PDF
            </ButtonLink>
            <ButtonLink href="/admin/exams/new">New exam</ButtonLink>
          </>
        }
      />

      {ok ? <p className="mb-4 rounded-[var(--radius-md)] bg-success-50 px-4 py-3 text-sm text-success-700">{ok}</p> : null}
      {err ? <p className="mb-4 rounded-[var(--radius-md)] bg-danger-50 px-4 py-3 text-sm text-danger-600">{err}</p> : null}

      {/* Count tiles: click to filter */}
      <div className="grid grid-cols-2 gap-px overflow-hidden rounded-[var(--radius-lg)] bg-line ring-1 ring-line sm:grid-cols-3 lg:grid-cols-6">
        {tiles.map((t) => {
          const body = (
            <>
              <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.1em] text-ink-500">{t.label}</p>
              <p className={cn("mt-1.5 font-display text-3xl tabular", t.tone ?? "text-ink-950")}>{t.value.toLocaleString("en")}</p>
            </>
          );
          return t.href ? (
            <Link key={t.label} href={t.href} className={cn("px-4 py-4 transition", t.active ? "bg-mark-50 shadow-[inset_0_-3px_0_var(--color-mark-500)]" : "bg-white hover:bg-paper")}>
              {body}
            </Link>
          ) : (
            <div key={t.label} className="bg-white px-4 py-4">
              {body}
            </div>
          );
        })}
      </div>

      {/* Filters */}
      <div className="mt-5 space-y-3 rounded-[var(--radius-lg)] bg-white p-4 ring-1 ring-line">
        <form action="/admin/exams" className="flex flex-wrap items-center gap-2">
          {Object.entries(f).map(([k, v]) => (k !== "q" && v ? <input key={k} type="hidden" name={k} value={v} /> : null))}
          <input
            name="q"
            defaultValue={f.q}
            placeholder="Search exam titles…"
            className="h-10 min-w-0 flex-1 rounded-[var(--radius-md)] bg-paper px-3.5 text-sm ring-1 ring-inset ring-line focus:outline-none focus:ring-2 focus:ring-mark-500 sm:max-w-xs"
          />
          <button className="h-10 rounded-[var(--radius-md)] bg-ink-950 px-4 text-sm font-medium text-paper">Search</button>
          {Object.values(f).some(Boolean) ? (
            <Link href="/admin/exams" className="text-sm font-medium text-ink-500 hover:text-ink-950">
              Clear all filters
            </Link>
          ) : null}
        </form>
        <FilterRow label="Track">
          <Chip href={href({ track: "" })} active={!f.track} count={count("track", "")}>All</Chip>
          {TRACKS.map((t) => (
            <Chip key={t.key} href={href({ track: t.key })} active={f.track === t.key} count={count("track", t.key)}>
              {t.label}
            </Chip>
          ))}
        </FilterRow>
        <FilterRow label="Subject">
          <Chip href={href({ subject: "" })} active={!f.subject}>All</Chip>
          {subjectsInTrack.map((s) => (
            <Chip key={s.code} href={href({ subject: s.code })} active={f.subject === s.code} count={all.filter((e) => match(e, "subject") && e.subject?.code === s.code).length}>
              {s.name}
            </Chip>
          ))}
        </FilterRow>
        <FilterRow label="Access">
          <Chip href={href({ access: "" })} active={!f.access} count={count("access", "")}>All</Chip>
          <Chip href={href({ access: "free" })} active={f.access === "free"} count={count("access", "free")}>Free</Chip>
          <Chip href={href({ access: "premium" })} active={f.access === "premium"} count={count("access", "premium")}>🔒 Premium</Chip>
        </FilterRow>
        <FilterRow label="Status">
          <Chip href={href({ status: "" })} active={!f.status} count={count("status", "")}>All</Chip>
          {STATUSES.map((s) => (
            <Chip key={s.key} href={href({ status: s.key })} active={f.status === s.key} count={count("status", s.key)}>
              {s.label}
            </Chip>
          ))}
        </FilterRow>
      </div>

      {/* Table with bulk actions */}
      <form action={bulkExams} className="mt-5 overflow-hidden rounded-[var(--radius-lg)] bg-white ring-1 ring-line">
        <input type="hidden" name="back" value={back} />
        <div className="flex flex-wrap items-center gap-2 border-b border-line bg-paper px-4 py-3">
          <span className="mr-auto text-sm text-ink-600">
            <b className="text-ink-950">{visible.length}</b> {visible.length === 1 ? "exam" : "exams"} shown · tick to change several
          </span>
          <BulkButton op="free">Make free</BulkButton>
          <BulkButton op="premium">Make premium</BulkButton>
          <BulkButton op="publish">Publish</BulkButton>
          <BulkButton op="unpublish">Unpublish</BulkButton>
          <BulkButton op="archive" danger>
            Archive
          </BulkButton>
        </div>
        {visible.length ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] text-sm">
              <thead>
                <tr className="border-b border-line text-left text-xs font-semibold uppercase tracking-[0.08em] text-ink-500">
                  <th className="w-10 px-4 py-3">
                    <SelectAll />
                  </th>
                  <th className="px-3 py-3">Exam</th>
                  <th className="px-3 py-3">Questions</th>
                  <th className="px-3 py-3">Attempts</th>
                  <th className="px-3 py-3">Access</th>
                  <th className="px-3 py-3">Status</th>
                  <th className="px-3 py-3">Updated</th>
                  <th className="px-3 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {visible.map((e) => (
                  <tr key={e.id} className="hover:bg-paper has-[:checked]:bg-mark-50/60">
                    <td className="px-4 py-3 align-top">
                      <input type="checkbox" name="ids" value={e.id} aria-label={`Select ${e.title}`} className="mt-1 h-4 w-4 accent-mark-500" />
                    </td>
                    <td className="px-3 py-3">
                      <Link href={`/admin/exams/${e.id}`} className="font-medium text-ink-950 hover:underline">
                        {e.title}
                      </Link>
                      <p className="mt-0.5 text-xs text-ink-500">
                        <span className="mr-1.5 rounded bg-paper-2 px-1.5 py-0.5 font-mono text-[0.625rem] font-semibold uppercase text-ink-600">{e.track}</span>
                        {e.subject?.name} · {e.kind === "full_mock" ? "Full mock" : "Practice"} · {e.duration_minutes} min
                        {e.origin === "ai_generated" ? " · AI" : ""}
                      </p>
                    </td>
                    <td className="px-3 py-3 tabular">{e.question_count}</td>
                    <td className="px-3 py-3 tabular">{e.attempts}</td>
                    <td className="px-3 py-3">
                      <div className="inline-flex rounded-full bg-paper-2 p-0.5 text-xs font-semibold">
                        {(["free", "premium"] as const).map((a) => (
                          <button
                            key={a}
                            name="row"
                            value={`${e.id}:access:${a}`}
                            disabled={e.access === a}
                            className={cn(
                              "rounded-full px-3 py-1 transition",
                              e.access === a ? (a === "free" ? "bg-mark-500 text-white" : "bg-ink-950 text-paper") : "text-ink-500 hover:text-ink-950",
                            )}
                          >
                            {a === "premium" ? "🔒 Premium" : "Free"}
                          </button>
                        ))}
                      </div>
                    </td>
                    <td className="px-3 py-3">
                      <StatusBadge status={e.status} />
                    </td>
                    <td className="px-3 py-3 text-ink-500">{adminDay.format(new Date(e.updated_at))}</td>
                    <td className="px-3 py-3">
                      <div className="flex items-center justify-end gap-1.5">
                        {e.status === "published" ? (
                          <>
                            <Link href={`/exams/${e.slug}`} target="_blank" className="rounded-md px-2 py-1 text-xs font-medium text-ink-600 ring-1 ring-line hover:bg-paper-2">
                              View
                            </Link>
                            <button name="row" value={`${e.id}:status:draft`} className="rounded-md px-2 py-1 text-xs font-medium text-ink-600 ring-1 ring-line hover:bg-paper-2">
                              Unpublish
                            </button>
                          </>
                        ) : (
                          <button name="row" value={`${e.id}:status:published`} className="rounded-md bg-success-600 px-2 py-1 text-xs font-semibold text-white hover:bg-success-700">
                            Publish
                          </button>
                        )}
                        <Link href={`/admin/exams/${e.id}`} className="rounded-md px-2 py-1 text-xs font-medium text-ink-600 ring-1 ring-line hover:bg-paper-2">
                          Edit
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty>No exams match these filters.</Empty>
        )}
      </form>
    </>
  );
}

function FilterRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3">
      <span className="w-16 shrink-0 text-xs font-semibold uppercase tracking-[0.1em] text-ink-500">{label}</span>
      <div className="flex min-w-0 flex-1 gap-1.5 overflow-x-auto pb-0.5 [scrollbar-width:none]">{children}</div>
    </div>
  );
}

function Chip({ href, active, count, children }: { href: string; active: boolean; count?: number; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      scroll={false}
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1.5 text-sm transition",
        active ? "bg-ink-950 text-paper" : "bg-paper text-ink-700 ring-1 ring-inset ring-line hover:ring-ink-400",
      )}
    >
      {children}
      {count !== undefined ? <span className={cn("tabular text-xs", active ? "text-ink-300" : "text-ink-400")}>{count}</span> : null}
    </Link>
  );
}

function BulkButton({ op, danger, children }: { op: string; danger?: boolean; children: React.ReactNode }) {
  return (
    <button
      name="op"
      value={op}
      className={cn(
        "h-8 rounded-md px-3 text-xs font-semibold ring-1 ring-inset transition",
        danger ? "text-danger-600 ring-danger-600/30 hover:bg-danger-50" : "bg-white text-ink-800 ring-line hover:ring-ink-400",
      )}
    >
      {children}
    </button>
  );
}
