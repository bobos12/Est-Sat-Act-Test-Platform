import Link from "next/link";
import { notFound } from "next/navigation";
import { ButtonLink } from "@/components/ui/button";
import { FormMessage } from "@/components/ui/field";
import { DataTable, Empty, Panel, PageHeader, StatusBadge, Td, Th } from "@/components/admin/ui";
import { adminClient } from "@/lib/admin/server";
import { loadTaxonomy } from "@/lib/admin/data";
import { plainText, type RichContent } from "@/lib/content";
import { approveAllQuestions, moveQuestion, removeQuestion, setExamStatus, updateExam } from "../actions";
import { ExamForm } from "../exam-form";

export const metadata = { title: "Edit exam" };

export default async function EditExam({ params, searchParams }: PageProps<"/admin/exams/[id]">) {
  const { supabase } = await adminClient();
  const { id } = await params;
  const sp = await searchParams;
  const ok = typeof sp.ok === "string" ? sp.ok : undefined;
  const error = typeof sp.error === "string" ? sp.error : undefined;

  const { data: exam } = await supabase
    .from("exams")
    .select("id, subject_id, title, slug, description, kind, focus_topic_id, difficulty, access, status, duration_minutes, sort_order, question_count, origin, published_at")
    .eq("id", id)
    .maybeSingle();
  if (!exam) notFound();

  const [{ subjects, topics }, { data: sections }, { data: eqs }, { data: stimuli }] = await Promise.all([
    loadTaxonomy(supabase),
    supabase.from("exam_sections").select("id, position, title").eq("exam_id", id).order("position"),
    supabase
      .from("exam_questions")
      .select("id, position, section_id, questions(id, stem, status, origin, stimulus_id, difficulty, topic_id, skill_id, question_options(label, is_correct))")
      .eq("exam_id", id)
      .order("position"),
    supabase.from("stimuli").select("id, kind, title, content, created_at").eq("subject_id", exam.subject_id).order("created_at", { ascending: false }).limit(200),
  ]);

  const topicName = new Map(topics.map((t) => [t.id, t.name]));
  const questions = (eqs ?? []).map((eq) => {
    const q = Array.isArray(eq.questions) ? eq.questions[0] : eq.questions;
    return { ...eq, q };
  });
  const usedStimuli = new Set(questions.map((x) => x.q?.stimulus_id).filter(Boolean));
  const examStimuli = (stimuli ?? []).filter((s) => usedStimuli.has(s.id));
  const drafts = questions.filter((x) => x.q?.status !== "approved").length;
  const published = exam.status === "published";
  const subject = subjects.find((s) => s.id === exam.subject_id);

  return (
    <>
      <Link href="/admin/exams" className="text-sm text-ink-500 hover:text-ink-950">
        ← Exams
      </Link>
      <PageHeader
        title={exam.title}
        description={
          <span className="inline-flex flex-wrap items-center gap-2">
            <StatusBadge status={exam.status} />
            <span>
              {subject?.name} · {exam.question_count} questions · {exam.duration_minutes} min · <span className="capitalize">{exam.access}</span>
              {exam.origin === "ai_generated" ? " · AI-generated — review every question before publishing" : ""}
            </span>
          </span>
        }
        actions={
          <>
            <ButtonLink href={`/admin/exams/${id}/preview`} variant="secondary">
              Preview
            </ButtonLink>
            {published ? (
              <>
                <ButtonLink href={`/exams/${exam.slug}`} variant="secondary">
                  View in library
                </ButtonLink>
                <StatusButton id={id} status="draft" label="Unpublish" variant="secondary" />
              </>
            ) : (
              <>
                {drafts > 0 ? (
                  <form action={approveAllQuestions}>
                    <input type="hidden" name="id" value={id} />
                    <button className="h-10 rounded-[var(--radius-md)] bg-white px-4 text-sm font-medium text-ink-950 ring-1 ring-inset ring-line-strong hover:bg-paper-2">
                      Approve {drafts} reviewed question{drafts === 1 ? "" : "s"}
                    </button>
                  </form>
                ) : null}
                <StatusButton id={id} status="published" label="Publish" variant="primary" />
              </>
            )}
            {exam.status !== "archived" ? <StatusButton id={id} status="archived" label="Archive" variant="ghost" /> : null}
          </>
        }
      />

      {ok ? <div className="mb-6"><FormMessage tone="success">{ok}</FormMessage></div> : null}
      {error ? <div className="mb-6"><FormMessage>{error}</FormMessage></div> : null}
      {published ? (
        <div className="mb-6 rounded-[var(--radius-md)] bg-info-50 px-4 py-3 text-sm text-info-600">
          This exam is live. Questions and passages are locked so students always see consistent content — unpublish to edit.
        </div>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[1fr_380px]">
        <Panel
          title={`Questions (${questions.length})`}
          actions={
            !published ? (
              <Link href={`/admin/exams/${id}/questions/new`} className="text-sm font-medium text-ink-950 hover:underline">
                + Add question
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
                  <Th>Key</Th>
                  <Th>Status</Th>
                  <Th className="w-32" />
                </tr>
              </thead>
              <tbody>
                {questions.map((x, i) => {
                  const q = x.q;
                  const key = q?.question_options?.find((o) => o.is_correct)?.label ?? "—";
                  const section = (sections ?? []).find((s) => s.id === x.section_id);
                  return (
                    <tr key={x.id} className="align-top">
                      <Td className="tabular text-ink-500">{x.position}</Td>
                      <Td>
                        <Link href={`/admin/exams/${id}/questions/${q?.id}`} className="text-ink-950 hover:underline">
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
                            <RowButton examId={id} eqId={x.id} action={moveQuestion} dir="up" disabled={i === 0} label="↑" title="Move up" />
                            <RowButton examId={id} eqId={x.id} action={moveQuestion} dir="down" disabled={i === questions.length - 1} label="↓" title="Move down" />
                            <RowButton examId={id} eqId={x.id} action={removeQuestion} label="✕" title="Remove from exam" />
                          </div>
                        ) : null}
                      </Td>
                    </tr>
                  );
                })}
              </tbody>
            </DataTable>
          ) : (
            <Empty>No questions yet. Add them one by one, or generate an exam with AI.</Empty>
          )}
        </Panel>

        <div className="space-y-6">
          <Panel
            title="Shared passages & data"
            actions={
              !published ? (
                <Link href={`/admin/exams/${id}/stimuli/new`} className="text-sm font-medium text-ink-950 hover:underline">
                  + Add
                </Link>
              ) : null
            }
          >
            {examStimuli.length ? (
              <ul className="divide-y divide-line">
                {examStimuli.map((s) => (
                  <li key={s.id} className="px-5 py-3">
                    <Link href={`/admin/exams/${id}/stimuli/${s.id}`} className="text-sm font-medium text-ink-950 hover:underline">
                      {s.title || plainText(s.content as RichContent, 60) || "Untitled"}
                    </Link>
                    <p className="text-xs capitalize text-ink-500">
                      {s.kind.replace("_", " ")} · {questions.filter((x) => x.q?.stimulus_id === s.id).length} questions
                    </p>
                  </li>
                ))}
              </ul>
            ) : (
              <Empty>Passages, tables and figures shared by several questions appear here.</Empty>
            )}
          </Panel>

          <Panel title="Details" className="p-0">
            <div className="p-5">
              <ExamForm action={updateExam} subjects={subjects} topics={topics} exam={exam} />
            </div>
          </Panel>
        </div>
      </div>
    </>
  );
}

function StatusButton({ id, status, label, variant }: { id: string; status: string; label: string; variant: "primary" | "secondary" | "ghost" }) {
  const cls =
    variant === "primary"
      ? "bg-ink-950 text-paper hover:bg-ink-800"
      : variant === "secondary"
        ? "bg-white text-ink-950 ring-1 ring-inset ring-line-strong hover:bg-paper-2"
        : "text-ink-600 hover:bg-paper-2 hover:text-ink-950";
  return (
    <form action={setExamStatus}>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="status" value={status} />
      <button className={`h-10 rounded-[var(--radius-md)] px-4 text-sm font-medium ${cls}`}>{label}</button>
    </form>
  );
}

function RowButton({
  examId,
  eqId,
  action,
  dir,
  disabled,
  label,
  title,
}: {
  examId: string;
  eqId: string;
  action: (fd: FormData) => Promise<void>;
  dir?: string;
  disabled?: boolean;
  label: string;
  title: string;
}) {
  return (
    <form action={action}>
      <input type="hidden" name="exam_id" value={examId} />
      <input type="hidden" name="eq_id" value={eqId} />
      {dir ? <input type="hidden" name="dir" value={dir} /> : null}
      <button
        title={title}
        aria-label={title}
        disabled={disabled}
        className="flex h-8 w-8 items-center justify-center rounded-[var(--radius-sm)] text-ink-500 hover:bg-paper-2 hover:text-ink-950 disabled:opacity-30"
      >
        {label}
      </button>
    </form>
  );
}
