import Link from "next/link";
import { notFound } from "next/navigation";
import { ConfirmSubmit, SubmitButton, Tabs, btn } from "@/components/admin/client";
import { Icon } from "@/components/admin/icons";
import { Avatar, Badge, Callout, DataTable, Empty, Panel, PageHeader, ScorePill, StatCard, StatusBadge, Td, Th, adminDate, one, relative } from "@/components/admin/ui";
import { adminClient } from "@/lib/admin/server";
import { loadTaxonomy } from "@/lib/admin/data";
import { plainText, type RichContent } from "@/lib/content";
import { requestTime } from "@/lib/time";
import { cn } from "@/lib/utils";
import { approveAllQuestions, moveQuestion, removeQuestion, setExamAccess, setExamStatus, updateExam } from "../actions";
import { ExamForm } from "../exam-form";

export const metadata = { title: "Edit exam" };

export default async function EditExam({ params, searchParams }: PageProps<"/admin/exams/[id]">) {
  const { supabase } = await adminClient();
  const { id } = await params;
  const sp = await searchParams;
  const tab = typeof sp.tab === "string" ? sp.tab : undefined;
  const now = requestTime();

  const { data: exam } = await supabase
    .from("exams")
    .select("id, subject_id, title, slug, description, kind, focus_topic_id, difficulty, access, status, duration_minutes, sort_order, question_count, origin, published_at, updated_at")
    .eq("id", id)
    .maybeSingle();
  if (!exam) notFound();

  const [{ subjects, topics }, { data: sections }, { data: eqs }, { data: stimuli }, { data: attempts, count: attemptCount }] = await Promise.all([
    loadTaxonomy(supabase),
    supabase.from("exam_sections").select("id, position, title").eq("exam_id", id).order("position"),
    supabase
      .from("exam_questions")
      .select("id, position, section_id, questions(id, stem, status, origin, stimulus_id, difficulty, topic_id, skill_id, answer_format, accepted_answers, question_options(label, is_correct))")
      .eq("exam_id", id)
      .order("position"),
    supabase.from("stimuli").select("id, kind, title, content, created_at").eq("subject_id", exam.subject_id).order("created_at", { ascending: false }).limit(200),
    supabase
      .from("exam_attempts")
      .select("id, user_id, status, percent, correct_count, question_count, started_at, submitted_at, profiles(full_name, email)", { count: "exact" })
      .eq("exam_id", id)
      .order("started_at", { ascending: false })
      .limit(300),
  ]);

  const topicName = new Map(topics.map((t) => [t.id, t.name]));
  const questions = (eqs ?? []).map((eq) => ({ ...eq, q: one(eq.questions) }));
  const usedStimuli = new Set(questions.map((x) => x.q?.stimulus_id).filter(Boolean));
  const examStimuli = (stimuli ?? []).filter((s) => usedStimuli.has(s.id));
  const drafts = questions.filter((x) => x.q?.status !== "approved").length;
  const published = exam.status === "published";
  const subject = subjects.find((s) => s.id === exam.subject_id);

  const done = (attempts ?? []).filter((a) => a.status !== "in_progress" && a.percent != null);
  const avg = done.length ? Math.round(done.reduce((t, a) => t + Number(a.percent), 0) / done.length) : null;
  const students = new Set((attempts ?? []).map((a) => a.user_id)).size;
  const buckets = [
    { label: "0–49%", n: done.filter((a) => Number(a.percent) < 50).length, cls: "bg-danger-600" },
    { label: "50–74%", n: done.filter((a) => Number(a.percent) >= 50 && Number(a.percent) < 75).length, cls: "bg-warning-500" },
    { label: "75–100%", n: done.filter((a) => Number(a.percent) >= 75).length, cls: "bg-success-600" },
  ];

  const statusForm = (status: string, label: string, variant: "dark" | "secondary" | "success", pendingLabel: string) => (
    <form action={setExamStatus}>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="status" value={status} />
      <SubmitButton variant={variant} pendingLabel={pendingLabel}>
        {label}
      </SubmitButton>
    </form>
  );

  /* ----------------------------- tabs ----------------------------- */

  const questionsTab = (
    <div className="grid gap-6 xl:grid-cols-[1fr_340px]">
      <Panel
        title={`Questions (${questions.length})`}
        icon="bank"
        actions={
          !published ? (
            <Link href={`/admin/exams/${id}/questions/new`} className={btn("dark", "sm")}>
              <Icon name="plus" size={14} /> Add question
            </Link>
          ) : null
        }
      >
        {questions.length ? (
          <DataTable>
            <thead>
              <tr>
                <Th className="w-12">#</Th>
                <Th>Question</Th>
                <Th>Answer</Th>
                <Th>Status</Th>
                <Th className="w-32" />
              </tr>
            </thead>
            <tbody>
              {questions.map((x, i) => {
                const q = x.q;
                const key = q?.answer_format === "spr" ? (q.accepted_answers ?? []).join("; ") || "—" : (q?.question_options?.find((o) => o.is_correct)?.label ?? "—");
                const section = (sections ?? []).find((s) => s.id === x.section_id);
                return (
                  <tr key={x.id} className="align-top hover:bg-paper">
                    <Td className="tabular text-ink-500">{x.position}</Td>
                    <Td>
                      <Link href={`/admin/exams/${id}/questions/${q?.id}`} className="text-ink-950 hover:text-mark-600">
                        {plainText(q?.stem as RichContent, 110) || "(empty)"}
                      </Link>
                      <p className="mt-0.5 text-xs text-ink-500">
                        {(sections?.length ?? 0) > 1 && section ? `${section.title} · ` : ""}
                        {q?.topic_id ? topicName.get(q.topic_id) : q?.skill_id ? topicName.get(q.skill_id) : "No topic"}
                        {q?.stimulus_id ? " · shared passage" : ""}
                        {q?.difficulty ? ` · ${q.difficulty}` : ""}
                      </p>
                    </Td>
                    <Td className="font-semibold">{key}</Td>
                    <Td>
                      <StatusBadge status={q?.status ?? "draft"} />
                    </Td>
                    <Td>
                      {!published ? (
                        <div className="flex items-center justify-end gap-1">
                          <RowButton examId={id} eqId={x.id} action={moveQuestion} dir="up" disabled={i === 0} icon="arrowUp" title="Move up" />
                          <RowButton examId={id} eqId={x.id} action={moveQuestion} dir="down" disabled={i === questions.length - 1} icon="arrowDown" title="Move down" />
                          <form action={removeQuestion}>
                            <input type="hidden" name="exam_id" value={id} />
                            <input type="hidden" name="eq_id" value={x.id} />
                            <ConfirmSubmit
                              size="xs"
                              variant="ghost"
                              icon="x"
                              title={`Remove question ${x.position} from this exam?`}
                              body="The question stays in your question bank; it's only taken out of this exam."
                              confirmLabel="Remove"
                              pendingLabel="Removing…"
                            >
                              <span className="sr-only">Remove</span>
                            </ConfirmSubmit>
                          </form>
                        </div>
                      ) : null}
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </DataTable>
        ) : (
          <Empty icon="bank" action={<Link href={`/admin/exams/${id}/questions/new`} className={btn("dark", "sm")}>Add the first question</Link>}>
            No questions yet. Add them one by one, or generate an exam with AI.
          </Empty>
        )}
      </Panel>

      <Panel
        title="Shared passages & data"
        icon="book"
        actions={
          !published ? (
            <Link href={`/admin/exams/${id}/stimuli/new`} className="text-sm font-medium text-mark-600 hover:underline">
              + Add
            </Link>
          ) : null
        }
      >
        {examStimuli.length ? (
          <ul className="divide-y divide-line">
            {examStimuli.map((s) => (
              <li key={s.id}>
                <Link href={`/admin/exams/${id}/stimuli/${s.id}`} className="block px-5 py-3 transition hover:bg-paper">
                  <span className="block text-sm font-medium text-ink-950">{s.title || plainText(s.content as RichContent, 60) || "Untitled"}</span>
                  <span className="text-xs capitalize text-ink-500">
                    {s.kind.replace("_", " ")} · {questions.filter((x) => x.q?.stimulus_id === s.id).length} questions
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <Empty icon="book">Passages, tables and figures shared by several questions appear here.</Empty>
        )}
      </Panel>
    </div>
  );

  const settingsTab = (
    <Panel title="Exam settings" icon="edit" description="Title, subject, timing, difficulty and who can take it.">
      <div className="max-w-3xl p-5">
        <ExamForm action={updateExam} subjects={subjects} topics={topics} exam={exam} />
      </div>
    </Panel>
  );

  const resultsTab = (
    <div className="space-y-6">
      {done.length ? (
        <Panel title="Score spread" icon="chart">
          <div className="space-y-2.5 p-5">
            {buckets.map((b) => (
              <div key={b.label} className="flex items-center gap-3 text-sm">
                <span className="w-16 shrink-0 tabular text-ink-600">{b.label}</span>
                <span className="h-3 flex-1 overflow-hidden rounded-full bg-paper-2">
                  <span className={cn("block h-full rounded-full", b.cls)} style={{ width: `${(b.n / done.length) * 100}%` }} />
                </span>
                <span className="w-24 shrink-0 text-right tabular text-ink-700">
                  <b>{b.n}</b> ({Math.round((b.n / done.length) * 100)}%)
                </span>
              </div>
            ))}
          </div>
        </Panel>
      ) : null}
      <Panel title={`Attempts (${attemptCount ?? 0})`} icon="users" description={(attemptCount ?? 0) > 300 ? "Showing the latest 300" : undefined}>
        {attempts?.length ? (
          <DataTable>
            <thead>
              <tr>
                <Th>Student</Th>
                <Th>Started</Th>
                <Th>Score</Th>
                <Th className="w-10" />
              </tr>
            </thead>
            <tbody>
              {attempts.map((a) => {
                const u = one(a.profiles);
                return (
                  <tr key={a.id} className="hover:bg-paper">
                    <Td>
                      <Link href={`/admin/students/${a.user_id}?tab=exams`} className="flex items-center gap-2.5">
                        <Avatar name={u?.full_name || u?.email || "?"} size={30} />
                        <span className="min-w-0">
                          <span className="block truncate font-medium text-ink-950 hover:text-mark-600">{u?.full_name || u?.email}</span>
                          <span className="block truncate text-xs text-ink-500">{u?.email}</span>
                        </span>
                      </Link>
                    </Td>
                    <Td className="whitespace-nowrap text-ink-600">
                      {adminDate.format(new Date(a.started_at))}
                      <p className="text-xs text-ink-400">{relative(a.started_at, now)}</p>
                    </Td>
                    <Td>
                      {a.status === "in_progress" ? (
                        <StatusBadge status="in_progress" />
                      ) : (
                        <span className="flex items-center gap-2">
                          <ScorePill percent={Number(a.percent)} />
                          <span className="text-xs tabular text-ink-500">
                            {a.correct_count}/{a.question_count}
                            {a.status === "expired" ? " · time ran out" : ""}
                          </span>
                        </span>
                      )}
                    </Td>
                    <Td className="text-right">
                      {a.status !== "in_progress" ? (
                        <Link href={`/results/${a.id}`} target="_blank" title="Open their result" className="inline-flex h-8 w-8 items-center justify-center rounded-md text-ink-400 hover:bg-paper-2 hover:text-mark-600">
                          <Icon name="external" size={15} />
                        </Link>
                      ) : null}
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </DataTable>
        ) : (
          <Empty icon="users">No one has taken this exam yet.</Empty>
        )}
      </Panel>
    </div>
  );

  return (
    <>
      <PageHeader
        back={{ href: "/admin/exams", label: "All exams" }}
        title={exam.title}
        description={
          <span className="inline-flex flex-wrap items-center gap-2">
            <StatusBadge status={exam.status} label={published ? "Live" : undefined} />
            {exam.access === "free" ? <Badge tone="brand">Free</Badge> : <Badge tone="dark" icon="crown">Premium</Badge>}
            <span className="text-sm text-ink-600">
              {subject?.name} · {exam.question_count} questions · {exam.duration_minutes} min
            </span>
          </span>
        }
        actions={
          <>
            <Link href={`/admin/exams/${id}/preview`} className={btn("secondary")}>
              <Icon name="eye" size={15} /> Preview
            </Link>
            {published ? (
              <>
                <Link href={`/exams/${exam.slug}`} target="_blank" className={btn("secondary")}>
                  <Icon name="external" size={15} /> View live
                </Link>
                {statusForm("draft", "Unpublish", "secondary", "Unpublishing…")}
              </>
            ) : (
              <>
                {drafts > 0 ? (
                  <form action={approveAllQuestions}>
                    <input type="hidden" name="id" value={id} />
                    <SubmitButton variant="secondary" icon="check" pendingLabel="Approving…">
                      Approve {drafts} question{drafts === 1 ? "" : "s"}
                    </SubmitButton>
                  </form>
                ) : null}
                {statusForm("published", "Publish", "success", "Publishing…")}
              </>
            )}
          </>
        }
      />

      {exam.origin === "ai_generated" && !published ? (
        <div className="mb-5">
          <Callout tone="warning" title="AI-generated exam">
            Review every question before publishing.
          </Callout>
        </div>
      ) : null}
      {published ? (
        <div className="mb-5">
          <Callout tone="info">This exam is live. Questions and passages are locked so students always see consistent content. Unpublish to edit them.</Callout>
        </div>
      ) : null}

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Questions" value={questions.length} note={drafts ? `${drafts} not approved yet` : "All approved"} icon="bank" tone={drafts ? "warning" : "success"} />
        <StatCard label="Attempts" value={attemptCount ?? 0} note={`${students} student${students === 1 ? "" : "s"}`} icon="users" />
        <StatCard label="Average score" value={avg == null ? "—" : `${avg}%`} note={`${done.length} finished`} icon="chart" tone="brand" />
        <div className="rounded-[var(--radius-lg)] bg-white p-4 shadow-[0_1px_2px_rgba(10,15,28,0.04)] ring-1 ring-line">
          <p className="text-[0.75rem] font-semibold uppercase tracking-[0.08em] text-ink-500">Who can take it</p>
          <form action={setExamAccess} className="mt-2 inline-flex rounded-full bg-paper-2 p-0.5">
            <input type="hidden" name="id" value={id} />
            {(["free", "premium"] as const).map((a) =>
              exam.access === a ? (
                <span key={a} className={cn("rounded-full px-3.5 py-1.5 text-sm font-semibold", a === "free" ? "bg-mark-500 text-white" : "bg-ink-950 text-white")}>
                  {a === "free" ? "Free" : "Premium"}
                </span>
              ) : (
                <SubmitButton key={a} name="access" value={a} variant="ghost" size="sm" className="rounded-full" pendingLabel="Saving…">
                  {a === "free" ? "Free" : "Premium"}
                </SubmitButton>
              ),
            )}
          </form>
          <p className="mt-1.5 text-[0.8125rem] text-ink-500">{exam.access === "free" ? "Every account" : "Premium students only"}</p>
        </div>
      </div>

      <Tabs
        initial={tab}
        tabs={[
          { id: "questions", label: "Questions", icon: "bank", count: questions.length, content: questionsTab },
          { id: "results", label: "Results", icon: "chart", count: attemptCount ?? 0, content: resultsTab },
          { id: "settings", label: "Settings", icon: "edit", content: settingsTab },
        ]}
      />

      {exam.status !== "archived" ? (
        <div className="mt-10 flex flex-wrap items-center justify-between gap-3 rounded-[var(--radius-lg)] border border-dashed border-line-strong px-5 py-4">
          <p className="text-sm text-ink-600">Archive hides this exam from students. Past results are kept and you can publish it again later.</p>
          <form action={setExamStatus}>
            <input type="hidden" name="id" value={id} />
            <ConfirmSubmit name="status" value="archived" size="sm" title="Archive this exam?" body="Students won't see it any more. Their past results are kept." confirmLabel="Archive exam" pendingLabel="Archiving…">
              Archive exam
            </ConfirmSubmit>
          </form>
        </div>
      ) : null}
    </>
  );
}

function RowButton({
  examId,
  eqId,
  action,
  dir,
  disabled,
  icon,
  title,
}: {
  examId: string;
  eqId: string;
  action: (fd: FormData) => Promise<void>;
  dir?: string;
  disabled?: boolean;
  icon: "arrowUp" | "arrowDown";
  title: string;
}) {
  return (
    <form action={action}>
      <input type="hidden" name="exam_id" value={examId} />
      <input type="hidden" name="eq_id" value={eqId} />
      {dir ? <input type="hidden" name="dir" value={dir} /> : null}
      <SubmitButton variant="ghost" size="xs" disabled={disabled} title={title} aria-label={title} icon={icon} className="w-7 px-0">
        {null}
      </SubmitButton>
    </form>
  );
}
