import Link from "next/link";
import { ConfirmSubmit, SearchBox, SelectAll, SelectedCount, SubmitButton } from "@/components/admin/client";
import { btn } from "@/components/admin/btn";
import { Icon } from "@/components/admin/icons";
import { Empty, PageHeader, StatCard, StatusBadge, adminDay } from "@/components/admin/ui";
import { adminClient } from "@/lib/admin/server";
import { cn } from "@/lib/utils";
import { bulkExams } from "./actions";

export const metadata = { title: "Exams" };

type Filters = { q: string; track: string; subject: string; access: string; status: string };
const TRACKS = [
  { key: "est", label: "EST" },
  { key: "sat", label: "SAT" },
  { key: "act", label: "ACT" },
];
const STATUSES = [
  { key: "published", label: "Published" },
  { key: "draft", label: "Draft / review" },
  { key: "archived", label: "Archived" },
];
const trackOf = (code: string) => (code.startsWith("sat") ? "sat" : code.startsWith("act") ? "act" : "est");

export default async function AdminExams({ searchParams }: PageProps<"/admin/exams">) {
  const { supabase } = await adminClient();
  const sp = await searchParams;
  const one = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string) : "");
  const f: Filters = { q: one("q").trim(), track: one("track"), subject: one("subject"), access: one("access"), status: one("status") };

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
    (skip === "status" || !f.status || (f.status === "draft" ? e.status === "draft" || e.status === "in_review" : e.status === f.status));
  const visible = all.filter((e) => match(e));

  const href = (patch: Partial<Filters>) => {
    const next = { ...f, ...patch };
    if (patch.track !== undefined) next.subject = "";
    const qs = new URLSearchParams(Object.entries(next).filter(([, v]) => v) as [string, string][]).toString();
    return qs ? `/admin/exams?${qs}` : "/admin/exams";
  };
  const back = href({}).replace("/admin/exams", "");
  const count = (k: keyof Filters, v: string) =>
    all.filter((e) => match(e, k) && (v === "" || (k === "track" ? e.track === v : k === "access" ? e.access === v : k === "status" ? (v === "draft" ? e.status === "draft" || e.status === "in_review" : e.status === v) : true))).length;
  const subjectsInTrack = (subjects ?? []).filter((s) => !f.track || trackOf(s.code) === f.track);
  const anyFilter = Object.values(f).some(Boolean);

  return (
    <>
      <PageHeader
        title="Exams"
        description="Publish, set free or premium, and edit every exam. Tick several rows to change them in one go."
        actions={
          <>
            <Link href="/admin/knowledge" className={btn("secondary")}>
              <Icon name="book" size={15} /> Import PDF
            </Link>
            <Link href="/admin/exams/new" className={btn("dark")}>
              <Icon name="plus" size={15} /> New exam
            </Link>
          </>
        }
      />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Live" value={count("status", "published")} note="Students can take these" href={href({ status: "published" })} active={f.status === "published"} icon="check" tone="success" />
        <StatCard
          label="Not live yet"
          value={count("status", "draft")}
          note="Draft or in review"
          href={href({ status: "draft" })}
          active={f.status === "draft"}
          icon="edit"
          tone="warning"
        />
        <StatCard label="Free" value={count("access", "free")} note="Open to every account" href={href({ access: f.access === "free" ? "" : "free" })} active={f.access === "free"} icon="lock" tone="brand" />
        <StatCard label="Premium" value={count("access", "premium")} note="Need an active plan" href={href({ access: f.access === "premium" ? "" : "premium" })} active={f.access === "premium"} icon="crown" />
      </div>

      {/* Filters */}
      <div className="mt-6 space-y-3 rounded-[var(--radius-lg)] bg-white p-4 shadow-[0_1px_2px_rgba(10,15,28,0.04)] ring-1 ring-line">
        <div className="flex flex-wrap items-center gap-3">
          <SearchBox placeholder="Search exam titles…" className="min-w-56 flex-1 sm:max-w-sm" />
          {anyFilter ? (
            <Link href="/admin/exams" className="inline-flex items-center gap-1 text-sm font-medium text-ink-500 hover:text-ink-950">
              <Icon name="x" size={14} /> Clear all filters
            </Link>
          ) : null}
        </div>
        <FilterRow label="Track">
          <Chip href={href({ track: "" })} active={!f.track} count={count("track", "")}>
            All
          </Chip>
          {TRACKS.map((t) => (
            <Chip key={t.key} href={href({ track: t.key })} active={f.track === t.key} count={count("track", t.key)}>
              {t.label}
            </Chip>
          ))}
        </FilterRow>
        <FilterRow label="Subject">
          <Chip href={href({ subject: "" })} active={!f.subject}>
            All
          </Chip>
          {subjectsInTrack.map((s) => (
            <Chip key={s.code} href={href({ subject: s.code })} active={f.subject === s.code} count={all.filter((e) => match(e, "subject") && e.subject?.code === s.code).length}>
              {s.name}
            </Chip>
          ))}
        </FilterRow>
        <FilterRow label="Access">
          <Chip href={href({ access: "" })} active={!f.access} count={count("access", "")}>
            All
          </Chip>
          <Chip href={href({ access: "free" })} active={f.access === "free"} count={count("access", "free")}>
            Free
          </Chip>
          <Chip href={href({ access: "premium" })} active={f.access === "premium"} count={count("access", "premium")}>
            Premium
          </Chip>
        </FilterRow>
        <FilterRow label="Status">
          <Chip href={href({ status: "" })} active={!f.status} count={count("status", "")}>
            All
          </Chip>
          {STATUSES.map((s) => (
            <Chip key={s.key} href={href({ status: s.key })} active={f.status === s.key} count={count("status", s.key)}>
              {s.label}
            </Chip>
          ))}
        </FilterRow>
      </div>

      {/* Table with bulk actions */}
      <form action={bulkExams} className="mt-5 overflow-hidden rounded-[var(--radius-lg)] bg-white shadow-[0_1px_2px_rgba(10,15,28,0.04)] ring-1 ring-line">
        <input type="hidden" name="back" value={back} />
        <div className="sticky top-14 z-10 flex flex-wrap items-center gap-2 border-b border-line bg-white/95 px-4 py-3 backdrop-blur lg:top-0">
          <span className="mr-auto flex items-center gap-2 text-sm text-ink-600">
            <b className="text-ink-950">{visible.length}</b> {visible.length === 1 ? "exam" : "exams"} ·
            <SelectedCount />
          </span>
          <SubmitButton name="op" value="free" size="sm" variant="secondary" pendingLabel="Saving…">
            Make free
          </SubmitButton>
          <SubmitButton name="op" value="premium" size="sm" variant="secondary" pendingLabel="Saving…">
            Make premium
          </SubmitButton>
          <SubmitButton name="op" value="publish" size="sm" variant="secondary" pendingLabel="Publishing…">
            Publish
          </SubmitButton>
          <SubmitButton name="op" value="unpublish" size="sm" variant="secondary" pendingLabel="Saving…">
            Unpublish
          </SubmitButton>
          <ConfirmSubmit
            name="op"
            value="archive"
            size="sm"
            title="Archive the ticked exams?"
            body="Archived exams disappear from the library. Students' past results are kept, and you can publish them again later."
            confirmLabel="Archive"
            pendingLabel="Archiving…"
          >
            Archive
          </ConfirmSubmit>
        </div>
        {visible.length ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[920px] text-sm">
              <thead>
                <tr className="border-b border-line bg-paper/60 text-left text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-ink-500">
                  <th className="w-10 px-4 py-2.5">
                    <SelectAll />
                  </th>
                  <th className="px-3 py-2.5">Exam</th>
                  <th className="px-3 py-2.5">Questions</th>
                  <th className="px-3 py-2.5">Attempts</th>
                  <th className="px-3 py-2.5">Access</th>
                  <th className="px-3 py-2.5">Status</th>
                  <th className="px-3 py-2.5">Updated</th>
                  <th className="px-3 py-2.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {visible.map((e) => (
                  <tr key={e.id} className="group transition hover:bg-paper has-[:checked]:bg-mark-50/60">
                    <td className="px-4 py-3 align-top">
                      <input type="checkbox" name="ids" value={e.id} aria-label={`Select ${e.title}`} className="mt-1 h-4 w-4 accent-mark-500" />
                    </td>
                    <td className="px-3 py-3">
                      <Link href={`/admin/exams/${e.id}`} className="font-medium text-ink-950 hover:text-mark-600">
                        {e.title}
                      </Link>
                      <p className="mt-0.5 text-xs text-ink-500">
                        <span className="mr-1.5 rounded bg-paper-2 px-1.5 py-0.5 font-mono text-[0.625rem] font-semibold uppercase text-ink-600">{e.track}</span>
                        {e.subject?.name} · {e.kind === "full_mock" ? "Full mock" : "Practice"} · {e.duration_minutes} min
                        {e.origin === "ai_generated" ? " · AI" : ""}
                      </p>
                    </td>
                    <td className="px-3 py-3 tabular">{e.question_count}</td>
                    <td className="px-3 py-3 tabular">
                      {e.attempts ? (
                        <Link href={`/admin/exams/${e.id}?tab=results`} className="hover:text-mark-600 hover:underline">
                          {e.attempts}
                        </Link>
                      ) : (
                        <span className="text-ink-400">0</span>
                      )}
                    </td>
                    <td className="px-3 py-3">
                      <div className="inline-flex rounded-full bg-paper-2 p-0.5">
                        {(["free", "premium"] as const).map((a) =>
                          e.access === a ? (
                            <span key={a} className={cn("rounded-full px-3 py-1 text-xs font-semibold", a === "free" ? "bg-mark-500 text-white" : "bg-ink-950 text-white")}>
                              {a === "premium" ? "Premium" : "Free"}
                            </span>
                          ) : (
                            <SubmitButton key={a} name="row" value={`${e.id}:access:${a}`} size="xs" variant="ghost" className="rounded-full" pendingLabel="…">
                              {a === "premium" ? "Premium" : "Free"}
                            </SubmitButton>
                          ),
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-3">
                      <StatusBadge status={e.status} />
                    </td>
                    <td className="px-3 py-3 whitespace-nowrap text-ink-500">{adminDay.format(new Date(e.updated_at))}</td>
                    <td className="px-3 py-3">
                      <div className="flex items-center justify-end gap-1.5">
                        {e.status === "published" ? (
                          <>
                            <Link href={`/exams/${e.slug}`} target="_blank" title="Open in the student library" className={btn("ghost", "xs")}>
                              <Icon name="external" size={13} />
                            </Link>
                            <SubmitButton name="row" value={`${e.id}:status:draft`} size="xs" variant="secondary" pendingLabel="…">
                              Unpublish
                            </SubmitButton>
                          </>
                        ) : (
                          <SubmitButton name="row" value={`${e.id}:status:published`} size="xs" variant="success" pendingLabel="Publishing…">
                            Publish
                          </SubmitButton>
                        )}
                        <Link href={`/admin/exams/${e.id}`} className={btn("secondary", "xs")}>
                          <Icon name="edit" size={13} /> Edit
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty icon="exams" action={anyFilter ? <Link href="/admin/exams" className={btn("secondary", "sm")}>Clear filters</Link> : undefined}>
            No exams match these filters.
          </Empty>
        )}
      </form>
    </>
  );
}

function FilterRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3">
      <span className="w-16 shrink-0 text-[0.6875rem] font-semibold uppercase tracking-[0.1em] text-ink-400">{label}</span>
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
        "inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1 text-[0.8125rem] font-medium transition",
        active ? "bg-ink-950 text-white" : "bg-paper text-ink-700 ring-1 ring-inset ring-line hover:ring-ink-300",
      )}
    >
      {children}
      {count !== undefined ? <span className={cn("tabular text-xs", active ? "text-ink-300" : "text-ink-400")}>{count}</span> : null}
    </Link>
  );
}
