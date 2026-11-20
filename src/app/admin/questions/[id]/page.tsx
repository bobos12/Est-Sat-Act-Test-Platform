import Link from "next/link";
import { notFound } from "next/navigation";
import { RichContentView } from "@/components/exam/rich-content";
import { Label, Panel, Select, StatusBadge, Textarea, adminDate } from "@/components/admin/ui";
import { adminClient } from "@/lib/admin/server";
import type { RichContent } from "@/lib/content";
import { cn } from "@/lib/utils";
import { updateQuestionMeta } from "../actions";

export const metadata = { title: "Question" };

type Insights = {
  options: { id: string; label: string; is_correct: boolean; practice: number; exam: number }[];
  practice: { attempts: number; correct: number; avg_ms: number | null; students: number; bookmarks: number };
  exam: { attempts: number; correct: number; skipped: number };
};

const ORIGIN = { source: "Official paper", ai_generated: "AI generated", manual: "Written manually" } as const;

export default async function AdminQuestion({ params, searchParams }: PageProps<"/admin/questions/[id]">) {
  const { supabase } = await adminClient();
  const { id } = await params;
  const sp = await searchParams;
  const ok = typeof sp.ok === "string" ? sp.ok : "";
  const err = typeof sp.error === "string" ? sp.error : "";

  const { data: q, error } = await supabase
    .from("questions")
    .select(
      "id, subject_id, stem, explanation, difficulty, status, origin, topic_id, skill_id, cognitive_level, stimulus_id, stimulus_marker, source_question_number, review_notes, created_at, updated_at, subjects(code, name), question_options(id, label, content, is_correct), exam_questions(position, exams(id, title, status, slug))",
    )
    .eq("id", id)
    .maybeSingle();
  if (error && error.code !== "22P02") throw new Error(error.message);
  if (!q) notFound();

  const [{ data: topics }, { data: stimulus }, { data: insightsRaw }] = await Promise.all([
    supabase.from("topics").select("id, kind, name").eq("subject_id", q.subject_id).order("sort_order"),
    q.stimulus_id ? supabase.from("stimuli").select("title, attribution, content").eq("id", q.stimulus_id).maybeSingle() : Promise.resolve({ data: null }),
    supabase.rpc("admin_question_insights", { p_question: id }),
  ]);
  const insights = insightsRaw as Insights;
  const subject = Array.isArray(q.subjects) ? q.subjects[0] : q.subjects;
  const options = [...(q.question_options ?? [])].sort((a, b) => a.label.localeCompare(b.label));
  const usages = (q.exam_questions ?? [])
    .map((l) => ({ position: l.position, exam: Array.isArray(l.exams) ? l.exams[0] : l.exams }))
    .filter((u): u is { position: number; exam: { id: string; title: string; status: string; slug: string } } => Boolean(u.exam));
  const editable = usages.find((u) => u.exam.status !== "published") ?? usages[0];
  const correctCount = options.filter((o) => o.is_correct).length;

  // Answer distribution across practice + timed exams.
  const dist = insights.options.map((o) => ({ ...o, n: o.practice + o.exam }));
  const picks = dist.reduce((t, o) => t + o.n, 0);
  const keyRow = dist.find((o) => o.is_correct);
  const topDistractor = [...dist].filter((o) => !o.is_correct).sort((a, b) => b.n - a.n)[0];
  const keyWarning = picks >= 10 && keyRow && topDistractor && topDistractor.n > keyRow.n * 1.5;
  const pAcc = insights.practice.attempts ? Math.round((100 * insights.practice.correct) / insights.practice.attempts) : null;
  const eAcc = insights.exam.attempts ? Math.round((100 * insights.exam.correct) / insights.exam.attempts) : null;
  const topicList = (topics ?? []).filter((t) => t.kind === "topic" || t.kind === "domain");
  const skillList = (topics ?? []).filter((t) => t.kind === "skill");

  return (
    <>
      <Link href="/admin/questions" className="text-sm text-ink-500 hover:text-ink-950">
        ← Question bank
      </Link>
      <div className="mb-6 mt-2 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm text-ink-500">
            {subject?.name} · {ORIGIN[q.origin as keyof typeof ORIGIN]}
            {q.source_question_number ? ` · Q${q.source_question_number} in source` : ""}
          </p>
          <h1 className="mt-1 flex items-center gap-3 font-display text-3xl font-medium text-ink-950">
            Question <span className="font-mono text-lg text-ink-400">{q.id.slice(0, 8)}</span>
            <StatusBadge status={q.status} />
          </h1>
        </div>
        {editable ? (
          <Link
            href={`/admin/exams/${editable.exam.id}/questions/${q.id}`}
            className="inline-flex h-10 items-center rounded-[var(--radius-md)] bg-ink-950 px-4 text-sm font-medium text-paper hover:bg-ink-800"
          >
            Edit content
          </Link>
        ) : null}
      </div>

      {ok ? <p className="mb-4 rounded-[var(--radius-md)] bg-success-50 px-4 py-3 text-sm text-success-700">{ok}</p> : null}
      {err ? <p className="mb-4 rounded-[var(--radius-md)] bg-danger-50 px-4 py-3 text-sm text-danger-600">{err}</p> : null}
      {correctCount !== 1 || options.length < 2 ? (
        <p className="mb-4 rounded-[var(--radius-md)] bg-danger-50 px-4 py-3 text-sm text-danger-600">
          Answer key issue: this question has {options.length} options and {correctCount} marked correct. Students won&apos;t see it in the bank until it&apos;s fixed and approved.
        </p>
      ) : null}
      {keyWarning ? (
        <p className="mb-4 rounded-[var(--radius-md)] bg-warning-50 px-4 py-3 text-sm text-warning-700">
          Check the answer key: more students chose <b>{topDistractor.label}</b> ({topDistractor.n}) than the marked answer <b>{keyRow.label}</b> ({keyRow.n}).
        </p>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[1fr_340px] lg:items-start">
        {/* Preview */}
        <div className="space-y-6">
          <Panel title="Student view">
            <div className="px-6 py-6">
              {stimulus ? (
                <details className="group/p mb-6 overflow-hidden rounded-[var(--radius-md)] bg-paper ring-1 ring-line">
                  <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3 text-sm font-semibold text-ink-950 [&::-webkit-details-marker]:hidden">
                    <span>
                      Passage: {stimulus.title ?? "Untitled"}
                      {q.stimulus_marker ? <span className="font-normal text-ink-500"> · marker [{q.stimulus_marker}]</span> : null}
                    </span>
                    <span className="text-ink-400 transition-transform group-open/p:rotate-180">⌄</span>
                  </summary>
                  <RichContentView content={stimulus.content as RichContent} activeMarker={q.stimulus_marker} className="max-h-96 overflow-y-auto border-t border-line px-4 py-4 font-reading leading-relaxed text-ink-800" />
                </details>
              ) : null}
              <RichContentView content={q.stem as RichContent} activeMarker={q.stimulus_marker} className="font-reading text-lg leading-relaxed text-ink-950" />
              <ul className="mt-5 grid gap-2.5">
                {options.map((o) => {
                  const d = dist.find((x) => x.id === o.id);
                  const share = picks && d ? Math.round((100 * d.n) / picks) : 0;
                  return (
                    <li key={o.id} className={cn("relative overflow-hidden rounded-[var(--radius-md)] ring-1 ring-inset", o.is_correct ? "ring-success-600" : "ring-line")}>
                      {picks ? (
                        <span aria-hidden className={cn("absolute inset-y-0 left-0", o.is_correct ? "bg-success-50" : "bg-paper-2")} style={{ width: `${share}%` }} />
                      ) : null}
                      <div className="relative flex items-start gap-3 px-4 py-3">
                        <span className={cn("flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm font-semibold", o.is_correct ? "bg-success-600 text-white" : "bg-white text-ink-600 ring-1 ring-line")}>
                          {o.label}
                        </span>
                        <RichContentView content={o.content as RichContent} className="flex-1 pt-0.5 font-reading [&_p]:my-0" />
                        {picks ? (
                          <span className="shrink-0 pt-1 text-xs tabular text-ink-500">
                            <b className="text-ink-950">{share}%</b> · {d?.n ?? 0}
                          </span>
                        ) : null}
                      </div>
                    </li>
                  );
                })}
              </ul>
              {picks ? <p className="mt-2 text-xs text-ink-400">Bars show how {picks} student answers (practice + exams) were split.</p> : null}
              {(q.explanation as RichContent)?.blocks?.length ? (
                <div className="mt-6 rounded-[var(--radius-md)] bg-mark-50 px-5 py-4">
                  <h3 className="text-sm font-semibold text-mark-500">Explanation</h3>
                  <RichContentView content={q.explanation as RichContent} className="mt-2 leading-relaxed text-ink-800" />
                </div>
              ) : (
                <p className="mt-6 rounded-[var(--radius-md)] bg-warning-50 px-4 py-3 text-sm text-warning-700">No explanation yet. Students learn most from one.</p>
              )}
            </div>
          </Panel>

          <Panel title={`Used in ${usages.length} ${usages.length === 1 ? "exam" : "exams"}`}>
            {usages.length ? (
              <ul className="divide-y divide-line">
                {usages.map((u) => (
                  <li key={u.exam.id} className="flex items-center gap-3 px-5 py-3 text-sm">
                    <span className="w-10 shrink-0 font-mono text-xs text-ink-400">Q{u.position}</span>
                    <Link href={`/admin/exams/${u.exam.id}`} className="min-w-0 flex-1 truncate font-medium text-ink-950 hover:underline">
                      {u.exam.title}
                    </Link>
                    <StatusBadge status={u.exam.status} />
                    <Link href={`/admin/exams/${u.exam.id}/questions/${q.id}`} className="text-xs font-medium text-mark-500 hover:underline">
                      Edit here
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="px-5 py-6 text-sm text-ink-500">Not in any exam yet. Select it in the bank and use “Add to exam”. Only questions in a published exam appear in the student bank.</p>
            )}
          </Panel>
        </div>

        {/* Sidebar */}
        <div className="space-y-6 lg:sticky lg:top-6">
          <Panel title="Performance">
            <dl className="grid grid-cols-2 gap-px bg-line">
              <Metric label="Practice accuracy" value={pAcc == null ? "—" : `${pAcc}%`} sub={`${insights.practice.attempts} answers`} />
              <Metric label="Exam accuracy" value={eAcc == null ? "—" : `${eAcc}%`} sub={`${insights.exam.attempts} answers · ${insights.exam.skipped} skipped`} />
              <Metric label="Avg. time" value={insights.practice.avg_ms ? `${Math.round(insights.practice.avg_ms / 1000)}s` : "—"} sub="in practice" />
              <Metric label="Bookmarked" value={String(insights.practice.bookmarks)} sub={`${insights.practice.students} students practised`} />
            </dl>
          </Panel>

          <Panel title="Tags">
            <form action={updateQuestionMeta} className="space-y-4 px-5 py-5">
              <input type="hidden" name="id" value={q.id} />
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="status">Status</Label>
                  <Select id="status" name="status" defaultValue={q.status}>
                    <option value="draft">Draft</option>
                    <option value="approved">Approved</option>
                    <option value="retired">Retired</option>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="difficulty">Difficulty</Label>
                  <Select id="difficulty" name="difficulty" defaultValue={q.difficulty}>
                    <option value="easy">Easy</option>
                    <option value="medium">Medium</option>
                    <option value="hard">Hard</option>
                  </Select>
                </div>
              </div>
              <div>
                <Label htmlFor="topic_id">Topic</Label>
                <Select id="topic_id" name="topic_id" defaultValue={q.topic_id ?? ""}>
                  <option value="">None</option>
                  {topicList.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </Select>
              </div>
              {skillList.length ? (
                <div>
                  <Label htmlFor="skill_id">Skill</Label>
                  <Select id="skill_id" name="skill_id" defaultValue={q.skill_id ?? ""}>
                    <option value="">None</option>
                    {skillList.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                  </Select>
                </div>
              ) : (
                <input type="hidden" name="skill_id" value={q.skill_id ?? ""} />
              )}
              <div>
                <Label htmlFor="review_notes">Reviewer notes</Label>
                <Textarea id="review_notes" name="review_notes" rows={3} defaultValue={q.review_notes ?? ""} placeholder="Only admins see this." className="font-sans" />
              </div>
              <button className="h-10 w-full rounded-[var(--radius-md)] bg-ink-950 text-sm font-medium text-paper hover:bg-ink-800">Save tags</button>
              <p className="text-xs text-ink-400">
                Created {adminDate.format(new Date(q.created_at))} · updated {adminDate.format(new Date(q.updated_at))}
              </p>
            </form>
          </Panel>
        </div>
      </div>
    </>
  );
}

function Metric({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="bg-white px-4 py-3.5">
      <dt className="text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-ink-500">{label}</dt>
      <dd className="mt-1 font-display text-2xl tabular text-ink-950">{value}</dd>
      <dd className="text-xs text-ink-400">{sub}</dd>
    </div>
  );
}
