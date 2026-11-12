import Link from "next/link";
import { notFound } from "next/navigation";
import { RichContentView } from "@/components/exam/rich-content";
import { PageHeader, StatusBadge } from "@/components/admin/ui";
import { adminClient } from "@/lib/admin/server";
import type { RichContent } from "@/lib/content";
import { cn } from "@/lib/utils";

export const metadata = { title: "Preview" };

export default async function ExamPreviewPage({ params }: PageProps<"/admin/exams/[id]/preview">) {
  const { supabase } = await adminClient();
  const { id } = await params;
  const { data: exam } = await supabase.from("exams").select("id, title, status, duration_minutes").eq("id", id).maybeSingle();
  if (!exam) notFound();
  const { data: eqs } = await supabase
    .from("exam_questions")
    .select("id, position, questions(id, stem, explanation, stimulus_id, status, question_options(id, label, content, is_correct))")
    .eq("exam_id", id)
    .order("position");
  const qs = (eqs ?? []).map((eq) => ({ ...eq, q: Array.isArray(eq.questions) ? eq.questions[0] : eq.questions }));
  const stimulusIds = [...new Set(qs.map((x) => x.q?.stimulus_id).filter(Boolean))] as string[];
  const { data: stimuli } = stimulusIds.length
    ? await supabase.from("stimuli").select("id, title, attribution, content").in("id", stimulusIds)
    : { data: [] };
  const stimById = new Map((stimuli ?? []).map((s) => [s.id, s]));
  const shown = new Set<string>();

  return (
    <>
      <Link href={`/admin/exams/${id}`} className="text-sm text-ink-500 hover:text-ink-950">
        ← Back to editor
      </Link>
      <PageHeader
        title={`Preview: ${exam.title}`}
        description={<>Every question with its answer key, as students will see it. <StatusBadge status={exam.status} /></>}
      />
      <ol className="space-y-6">
        {qs.map((x) => {
          const q = x.q;
          if (!q) return null;
          const stim = q.stimulus_id && !shown.has(q.stimulus_id) ? stimById.get(q.stimulus_id) : undefined;
          if (q.stimulus_id) shown.add(q.stimulus_id);
          return (
            <li key={x.id} className="space-y-4">
              {stim ? (
                <div className="rounded-[var(--radius-lg)] bg-paper-2 p-6">
                  {stim.title ? <h3 className="font-display text-lg font-medium">{stim.title}</h3> : null}
                  {stim.attribution ? <p className="text-sm italic text-ink-500">{stim.attribution}</p> : null}
                  <RichContentView content={stim.content as RichContent} className="mt-3 font-reading leading-[1.8]" />
                </div>
              ) : null}
              <div className="rounded-[var(--radius-lg)] bg-white p-6 ring-1 ring-line">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium text-ink-500">Question {x.position}</p>
                  <StatusBadge status={q.status} />
                </div>
                <RichContentView content={q.stem as RichContent} className="mt-3 font-reading text-lg leading-relaxed" />
                <div className="mt-4 grid gap-2">
                  {(q.question_options ?? [])
                    .sort((a, b) => a.label.localeCompare(b.label))
                    .map((o) => (
                      <div
                        key={o.id}
                        className={cn(
                          "flex items-start gap-3 rounded-[var(--radius-md)] px-3.5 py-2.5 ring-1 ring-inset",
                          o.is_correct ? "bg-success-50 ring-success-600" : "ring-line",
                        )}
                      >
                        <span className="w-5 shrink-0 text-sm font-semibold">{o.label}</span>
                        <RichContentView content={o.content as RichContent} className="flex-1 font-reading [&_p]:my-0" />
                      </div>
                    ))}
                </div>
                <RichContentView content={q.explanation as RichContent} className="mt-4 border-t border-line pt-4 text-sm leading-relaxed text-ink-700" />
              </div>
            </li>
          );
        })}
      </ol>
    </>
  );
}
