import Link from "next/link";
import { PageHeader, StatusBadge, adminDay } from "@/components/admin/ui";
import { InlineText } from "@/components/exam/rich-content";
import { loadTaxonomy } from "@/lib/admin/data";
import { adminClient } from "@/lib/admin/server";
import { plainText, type RichContent } from "@/lib/content";
import { cn } from "@/lib/utils";
import { SelectAll } from "../exams/select-all";
import { bulkQuestions } from "./actions";
import { BulkBar } from "./bulk-bar";

export const metadata = { title: "Question bank" };

const PAGE = 50;
const KEYS = ["q", "subject", "category", "difficulty", "status", "origin", "usage", "sort", "page", "view"] as const;
type Filters = Record<(typeof KEYS)[number], string>;

type Row = {
  id: string;
  stem: RichContent;
  difficulty: "easy" | "medium" | "hard";
  status: string;
  origin: "source" | "ai_generated" | "manual";
  updated_at: string;
  has_stimulus: boolean;
  subject: { code: string; name: string } | null;
  topic: string | null;
  skill: string | null;
  broken: boolean;
  has_notes: boolean;
  attempts: number;
  correct: number;
  live: boolean;
  exams: { id: string; title: string; status: string }[];
};
type Search = { total: number; counts: Record<"all" | "approved" | "draft" | "retired" | "live" | "unused" | "broken", number>; rows: Row[] };
type Coverage = { subject_id: string; category_id: string | null; difficulty: "easy" | "medium" | "hard"; total: number; live: number }[];

const ORIGIN = { source: "Official", ai_generated: "AI", manual: "Manual" } as const;
const DIFF = { easy: "bg-success-600", medium: "bg-warning-500", hard: "bg-danger-600" } as const;

export default async function AdminQuestionBank({ searchParams }: PageProps<"/admin/questions">) {
  const { supabase } = await adminClient();
  const sp = await searchParams;
  const f = Object.fromEntries(KEYS.map((k) => [k, typeof sp[k] === "string" ? (sp[k] as string).trim() : ""])) as Filters;
  const ok = typeof sp.ok === "string" ? sp.ok : "";
  const err = typeof sp.error === "string" ? sp.error : "";
  const page = Math.max(1, Number(f.page) || 1);

  const tax = await loadTaxonomy(supabase);
  const subject = tax.subjects.find((s) => s.code === f.subject);
  const subjectTopics = subject ? tax.topics.filter((t) => t.subject_id === subject.id && t.kind !== "domain") : [];

  const href = (patch: Partial<Filters>) => {
    const next = { ...f, ...patch };
    if (patch.subject !== undefined) next.category = "";
    if (!("page" in patch)) next.page = "";
    const qs = new URLSearchParams(Object.entries(next).filter(([, v]) => v) as [string, string][]).toString();
    return qs ? `/admin/questions?${qs}` : "/admin/questions";
  };
  const backQs = href({ page: f.page }).replace("/admin/questions", "");

  const usageForTile = f.usage;
  const [{ data, error }, { data: exams }] = await Promise.all([
    supabase.rpc("admin_search_questions", {
      p_q: f.q || null,
      p_subject: subject?.id ?? null,
      p_category: f.category || null,
      p_difficulty: f.difficulty || null,
      p_status: f.status || null,
      p_origin: f.origin || null,
      p_usage: usageForTile || null,
      p_sort: f.sort || "updated",
      p_limit: PAGE,
      p_offset: (page - 1) * PAGE,
    }),
    subject
      ? supabase.from("exams").select("id, title").eq("subject_id", subject.id).neq("status", "published").neq("status", "archived").order("updated_at", { ascending: false }).limit(40)
      : Promise.resolve({ data: [] as { id: string; title: string }[] }),
  ]);
  if (error) throw new Error(error.message);
  const res = data as Search;
  const from = res.total ? (page - 1) * PAGE + 1 : 0;
  const to = Math.min(res.total, page * PAGE);

  const tiles: { label: string; value: number; href: string; active: boolean; tone?: string; hint?: string }[] = [
    { label: "All questions", value: res.counts.all, href: href({ status: "", usage: "" }), active: !f.status && !f.usage },
    { label: "Approved", value: res.counts.approved, href: href({ status: "approved", usage: "" }), active: f.status === "approved", tone: "text-success-700" },
    { label: "Drafts", value: res.counts.draft, href: href({ status: "draft", usage: "" }), active: f.status === "draft", tone: "text-warning-700" },
    { label: "Live in bank", value: res.counts.live, href: href({ usage: "live", status: "" }), active: f.usage === "live", tone: "text-mark-500", hint: "In a published exam, so students can practise it" },
    { label: "Not in any exam", value: res.counts.unused, href: href({ usage: "unused", status: "" }), active: f.usage === "unused" },
    { label: "Answer key issues", value: res.counts.broken, href: href({ usage: "broken", status: "" }), active: f.usage === "broken", tone: res.counts.broken ? "text-danger-600" : undefined, hint: "Not exactly one correct option" },
  ];

  return (
    <>
      <PageHeader
        title="Question bank"
        description="Every question across every exam. Search, retag and approve in bulk, and see where the bank is thin."
        actions={
          <div className="inline-flex rounded-[var(--radius-md)] bg-paper-2 p-1 text-sm font-medium">
            <Link href={href({ view: "" })} className={cn("rounded-[var(--radius-sm)] px-3.5 py-1.5 transition", f.view !== "coverage" ? "bg-white text-ink-950 shadow-sm" : "text-ink-600 hover:text-ink-950")}>
              Questions
            </Link>
            <Link href={href({ view: "coverage" })} className={cn("rounded-[var(--radius-sm)] px-3.5 py-1.5 transition", f.view === "coverage" ? "bg-white text-ink-950 shadow-sm" : "text-ink-600 hover:text-ink-950")}>
              Coverage
            </Link>
          </div>
        }
      />

      {ok ? <p className="mb-4 rounded-[var(--radius-md)] bg-success-50 px-4 py-3 text-sm text-success-700">{ok}</p> : null}
      {err ? <p className="mb-4 rounded-[var(--radius-md)] bg-danger-50 px-4 py-3 text-sm text-danger-600">{err}</p> : null}

      {f.view === "coverage" ? (
        <CoverageView subjects={tax.subjects} topics={tax.topics} focus={subject?.id} />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-px overflow-hidden rounded-[var(--radius-lg)] bg-line ring-1 ring-line sm:grid-cols-3 lg:grid-cols-6">
            {tiles.map((t) => (
              <Link
                key={t.label}
                href={t.href}
                title={t.hint}
                className={cn("px-4 py-4 transition", t.active ? "bg-mark-50 shadow-[inset_0_-3px_0_var(--color-mark-500)]" : "bg-white hover:bg-paper")}
              >
                <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.1em] text-ink-500">{t.label}</p>
                <p className={cn("mt-1.5 font-display text-3xl tabular", t.tone ?? "text-ink-950")}>{t.value.toLocaleString("en")}</p>
              </Link>
            ))}
          </div>

          {/* Filters */}
          <form action="/admin/questions" className="mt-5 rounded-[var(--radius-lg)] bg-white p-4 ring-1 ring-line">
            <input type="hidden" name="usage" value={f.usage} />
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative min-w-0 flex-1 sm:max-w-sm">
                <svg viewBox="0 0 24 24" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
                  <circle cx="11" cy="11" r="7" />
                  <path d="m20 20-3.5-3.5" />
                </svg>
                <input
                  name="q"
                  defaultValue={f.q}
                  placeholder="Search question text or paste an ID…"
                  className="h-10 w-full rounded-[var(--radius-md)] bg-paper pl-9 pr-3.5 text-sm ring-1 ring-inset ring-line focus:outline-none focus:ring-2 focus:ring-mark-500"
                />
              </div>
              <FilterSelect name="subject" value={f.subject} label="All subjects" options={tax.subjects.map((s) => ({ value: s.code, label: s.name }))} />
              {subject ? (
                <FilterSelect name="category" value={f.category} label="All topics" options={tax.topics.filter((t) => t.subject_id === subject.id).map((t) => ({ value: t.id, label: `${t.name}${t.kind !== "topic" ? ` (${t.kind})` : ""}` }))} />
              ) : null}
              <FilterSelect name="difficulty" value={f.difficulty} label="Any difficulty" options={[{ value: "easy", label: "Easy" }, { value: "medium", label: "Medium" }, { value: "hard", label: "Hard" }]} />
              <FilterSelect name="status" value={f.status} label="Any status" options={[{ value: "approved", label: "Approved" }, { value: "draft", label: "Draft" }, { value: "retired", label: "Retired" }]} />
              <FilterSelect name="origin" value={f.origin} label="Any source" options={[{ value: "source", label: "Official papers" }, { value: "ai_generated", label: "AI generated" }, { value: "manual", label: "Written manually" }]} />
              <FilterSelect name="sort" value={f.sort} label="Recently updated" options={[{ value: "hardest", label: "Hardest for students" }, { value: "most_answered", label: "Most practised" }, { value: "oldest", label: "Oldest first" }]} />
              <button className="h-10 rounded-[var(--radius-md)] bg-ink-950 px-4 text-sm font-medium text-paper hover:bg-ink-800">Apply</button>
              {KEYS.some((k) => k !== "view" && k !== "page" && f[k]) ? (
                <Link href={f.view ? `/admin/questions?view=${f.view}` : "/admin/questions"} className="px-1 text-sm font-medium text-ink-500 hover:text-ink-950">
                  Clear
                </Link>
              ) : null}
            </div>
          </form>

          {/* Table */}
          <form action={bulkQuestions} className="mt-5 overflow-hidden rounded-[var(--radius-lg)] bg-white ring-1 ring-line">
            <input type="hidden" name="back" value={backQs} />
            <div className="flex flex-wrap items-center gap-3 border-b border-line bg-paper px-4 py-3 text-sm text-ink-600">
              <span className="mr-auto">
                {res.total ? (
                  <>
                    <b className="text-ink-950">
                      {from}–{to}
                    </b>{" "}
                    of <b className="text-ink-950">{res.total.toLocaleString("en")}</b> questions
                  </>
                ) : (
                  "No questions"
                )}
                {subject ? null : <span className="text-ink-400"> · pick a subject to retag or add to an exam</span>}
              </span>
              <Pager page={page} total={res.total} href={(p) => href({ page: p > 1 ? String(p) : "" })} />
            </div>

            {res.rows.length ? (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[920px] text-sm">
                  <thead>
                    <tr className="border-b border-line text-left text-xs font-semibold uppercase tracking-[0.08em] text-ink-500">
                      <th className="w-10 px-4 py-3">
                        <SelectAll />
                      </th>
                      <th className="px-3 py-3">Question</th>
                      <th className="px-3 py-3">Level</th>
                      <th className="px-3 py-3">Status</th>
                      <th className="px-3 py-3">Used in</th>
                      <th className="px-3 py-3">Students</th>
                      <th className="px-3 py-3 text-right">Updated</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {res.rows.map((r) => {
                      const acc = r.attempts ? Math.round((100 * r.correct) / r.attempts) : null;
                      const suspicious = acc != null && r.attempts >= 10 && acc < 25;
                      return (
                        <tr key={r.id} className="group hover:bg-paper has-[:checked]:bg-mark-50/60">
                          <td className="px-4 py-3.5 align-top">
                            <input type="checkbox" name="ids" value={r.id} aria-label="Select question" className="mt-0.5 h-4 w-4 accent-mark-500" />
                          </td>
                          <td className="max-w-[460px] px-3 py-3.5">
                            <Link href={`/admin/questions/${r.id}`} className="line-clamp-2 font-medium leading-snug text-ink-950 group-hover:text-mark-600">
                              {plainText(r.stem, 100000) ? <InlineText text={plainText(r.stem, 100000)} /> : <span className="italic text-ink-400">Empty stem</span>}
                            </Link>
                            <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-ink-500">
                              <span>{r.subject?.name}</span>
                              {r.skill || r.topic ? <span>· {r.skill ?? r.topic}</span> : <span className="text-warning-700">· Untagged</span>}
                              {r.has_stimulus ? <Tag>Passage</Tag> : null}
                              <Tag>{ORIGIN[r.origin]}</Tag>
                              {r.broken ? <Tag tone="danger">Key issue</Tag> : null}
                              {r.has_notes ? <Tag tone="warning">Review note</Tag> : null}
                            </p>
                          </td>
                          <td className="px-3 py-3.5">
                            <span className="inline-flex items-center gap-1.5 capitalize text-ink-700">
                              <span className={cn("h-2 w-2 rounded-full", DIFF[r.difficulty])} />
                              {r.difficulty}
                            </span>
                          </td>
                          <td className="px-3 py-3.5">
                            <StatusBadge status={r.status} />
                          </td>
                          <td className="px-3 py-3.5">
                            {r.exams.length ? (
                              <span className="flex items-center gap-1.5">
                                {r.live ? <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-success-600" title="In a published exam" /> : null}
                                <Link href={`/admin/exams/${r.exams[0].id}`} className="max-w-[180px] truncate text-ink-700 hover:underline" title={r.exams.map((e) => e.title).join("\n")}>
                                  {r.exams[0].title}
                                </Link>
                                {r.exams.length > 1 ? <span className="shrink-0 text-xs text-ink-400">+{r.exams.length - 1}</span> : null}
                              </span>
                            ) : (
                              <span className="text-ink-400">Not used</span>
                            )}
                          </td>
                          <td className="px-3 py-3.5">
                            {acc == null ? (
                              <span className="text-ink-400">—</span>
                            ) : (
                              <span className="block w-28" title={`${r.correct} of ${r.attempts} practice answers correct`}>
                                <span className="flex items-baseline justify-between text-xs">
                                  <b className={cn("tabular", suspicious ? "text-danger-600" : "text-ink-950")}>{acc}%</b>
                                  <span className="tabular text-ink-400">{r.attempts}</span>
                                </span>
                                <span className="mt-1 block h-1.5 overflow-hidden rounded-full bg-paper-3">
                                  <span className={cn("block h-full rounded-full", acc >= 70 ? "bg-success-600" : acc >= 40 ? "bg-mark-500" : "bg-danger-600")} style={{ width: `${Math.max(acc, 4)}%` }} />
                                </span>
                              </span>
                            )}
                          </td>
                          <td className="whitespace-nowrap px-3 py-3.5 text-right text-ink-500">{adminDay.format(new Date(r.updated_at))}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="px-5 py-16 text-center">
                <p className="font-medium text-ink-950">No questions match these filters</p>
                <p className="mt-1 text-sm text-ink-500">Try clearing a filter or searching for a shorter phrase.</p>
              </div>
            )}

            {res.total > PAGE ? (
              <div className="flex justify-end border-t border-line bg-paper px-4 py-3">
                <Pager page={page} total={res.total} href={(p) => href({ page: p > 1 ? String(p) : "" })} />
              </div>
            ) : null}

            <BulkBar topics={subjectTopics.map((t) => ({ value: t.id, label: t.name }))} exams={(exams ?? []).map((e) => ({ value: e.id, label: e.title }))} />
          </form>
        </>
      )}
    </>
  );
}

/* ------------------------------------------------------------------ */

async function CoverageView({
  subjects,
  topics,
  focus,
}: {
  subjects: { id: string; code: string; name: string; is_active: boolean }[];
  topics: { id: string; subject_id: string; kind: string; name: string }[];
  focus?: string;
}) {
  const { supabase } = await adminClient();
  const { data, error } = await supabase.rpc("admin_bank_coverage");
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as Coverage;
  const shown = subjects.filter((s) => (focus ? s.id === focus : s.is_active) && rows.some((r) => r.subject_id === s.id));
  const cell = (live: number) =>
    live === 0 ? "bg-danger-50 text-danger-600" : live < 5 ? "bg-warning-50 text-warning-700" : live < 15 ? "bg-mark-50 text-mark-600" : "bg-success-50 text-success-700";

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 rounded-[var(--radius-lg)] bg-white px-5 py-3.5 text-xs text-ink-600 ring-1 ring-line">
        <span className="font-semibold text-ink-950">Live questions per cell</span>
        <Legend className="bg-danger-50 ring-danger-600/30" label="None" />
        <Legend className="bg-warning-50 ring-warning-500/30" label="1–4" />
        <Legend className="bg-mark-50 ring-mark-500/30" label="5–14" />
        <Legend className="bg-success-50 ring-success-600/30" label="15+" />
        <span className="text-ink-400">Small number = total incl. drafts. Click a cell to open those questions.</span>
      </div>

      {shown.length === 0 ? (
        <p className="rounded-[var(--radius-lg)] bg-white px-5 py-12 text-center text-sm text-ink-500 ring-1 ring-line">No questions yet.</p>
      ) : (
        shown.map((s) => {
          const mine = rows.filter((r) => r.subject_id === s.id);
          const cats = [...new Set(mine.map((r) => r.category_id))];
          const name = (id: string | null) => topics.find((t) => t.id === id)?.name ?? "Untagged";
          const ordered = cats.sort((a, b) => topics.findIndex((t) => t.id === a) - topics.findIndex((t) => t.id === b));
          const get = (c: string | null, d: string) => mine.find((r) => r.category_id === c && r.difficulty === d) ?? { total: 0, live: 0 };
          const liveTotal = mine.reduce((n, r) => n + r.live, 0);
          return (
            <section key={s.id} className="overflow-hidden rounded-[var(--radius-lg)] bg-white ring-1 ring-line">
              <div className="flex items-center justify-between border-b border-line px-5 py-3.5">
                <h2 className="font-semibold text-ink-950">{s.name}</h2>
                <span className="text-sm text-ink-500">
                  <b className="tabular text-ink-950">{liveTotal}</b> live
                </span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[560px] text-sm">
                  <thead>
                    <tr className="text-left text-xs font-semibold uppercase tracking-[0.08em] text-ink-500">
                      <th className="px-5 py-2.5">Topic</th>
                      {(["easy", "medium", "hard"] as const).map((d) => (
                        <th key={d} className="w-28 px-2 py-2.5 text-center">
                          <span className="inline-flex items-center gap-1.5">
                            <span className={cn("h-1.5 w-1.5 rounded-full", DIFF[d])} />
                            {d}
                          </span>
                        </th>
                      ))}
                      <th className="w-24 px-5 py-2.5 text-right">Live</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ordered.map((c) => {
                      const sum = (["easy", "medium", "hard"] as const).reduce((n, d) => n + get(c, d).live, 0);
                      return (
                        <tr key={c ?? "none"} className="border-t border-line">
                          <td className="px-5 py-2 text-ink-800">{name(c)}</td>
                          {(["easy", "medium", "hard"] as const).map((d) => {
                            const v = get(c, d);
                            const qs = new URLSearchParams({ subject: s.code, difficulty: d, ...(c ? { category: c } : {}) }).toString();
                            return (
                              <td key={d} className="px-1.5 py-1.5">
                                <Link href={`/admin/questions?${qs}`} className={cn("flex h-11 flex-col items-center justify-center rounded-lg transition hover:ring-2 hover:ring-ink-950", cell(v.live))}>
                                  <span className="font-display text-lg leading-none tabular">{v.live}</span>
                                  {v.total !== v.live ? <span className="text-[0.625rem] tabular opacity-70">{v.total} total</span> : null}
                                </Link>
                              </td>
                            );
                          })}
                          <td className="px-5 py-2 text-right font-semibold tabular text-ink-950">{sum}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>
          );
        })
      )}
    </div>
  );
}

function FilterSelect({ name, value, label, options }: { name: string; value: string; label: string; options: { value: string; label: string }[] }) {
  return (
    <select
      name={name}
      defaultValue={value}
      className={cn(
        "h-10 max-w-48 cursor-pointer rounded-[var(--radius-md)] bg-white px-3 text-sm ring-1 ring-inset focus:outline-none focus:ring-2 focus:ring-mark-500",
        value ? "font-medium text-ink-950 ring-ink-950" : "text-ink-600 ring-line",
      )}
    >
      <option value="">{label}</option>
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

function Pager({ page, total, href }: { page: number; total: number; href: (p: number) => string }) {
  const pages = Math.max(1, Math.ceil(total / PAGE));
  if (pages <= 1) return null;
  const cls = "flex h-8 min-w-8 items-center justify-center rounded-md px-2 text-sm font-medium ring-1 ring-inset ring-line transition hover:ring-ink-400";
  return (
    <nav aria-label="Pages" className="flex items-center gap-1.5">
      {page > 1 ? (
        <Link href={href(page - 1)} className={cls} aria-label="Previous page">
          ←
        </Link>
      ) : (
        <span className={cn(cls, "opacity-40")}>←</span>
      )}
      <span className="px-1.5 text-sm tabular text-ink-600">
        {page} / {pages}
      </span>
      {page < pages ? (
        <Link href={href(page + 1)} className={cls} aria-label="Next page">
          →
        </Link>
      ) : (
        <span className={cn(cls, "opacity-40")}>→</span>
      )}
    </nav>
  );
}

function Tag({ tone, children }: { tone?: "danger" | "warning"; children: React.ReactNode }) {
  return (
    <span
      className={cn(
        "rounded px-1.5 py-0.5 text-[0.625rem] font-semibold uppercase tracking-wide",
        tone === "danger" ? "bg-danger-50 text-danger-600" : tone === "warning" ? "bg-warning-50 text-warning-700" : "bg-paper-2 text-ink-600",
      )}
    >
      {children}
    </span>
  );
}

function Legend({ className, label }: { className: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className={cn("h-3.5 w-5 rounded ring-1 ring-inset", className)} />
      {label}
    </span>
  );
}
