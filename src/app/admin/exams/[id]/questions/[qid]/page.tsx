import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/admin/ui";
import { adminClient } from "@/lib/admin/server";
import { contentToText, plainText, type RichContent } from "@/lib/content";
import { QuestionForm, type QuestionDraft } from "../../../question-form";

export const metadata = { title: "Edit question" };

export default async function QuestionEditor({ params }: PageProps<"/admin/exams/[id]/questions/[qid]">) {
  const { supabase } = await adminClient();
  const { id, qid } = await params;
  const isNew = qid === "new";

  const { data: exam } = await supabase.from("exams").select("id, title, status, subject_id, subjects(code)").eq("id", id).maybeSingle();
  if (!exam) notFound();
  const subject = Array.isArray(exam.subjects) ? exam.subjects[0] : exam.subjects;
  const isLiteracy = Boolean(subject?.code?.includes("literacy"));

  const [{ data: sections }, { data: topics }, { data: stimuli }] = await Promise.all([
    supabase.from("exam_sections").select("id, title").eq("exam_id", id).order("position"),
    supabase.from("topics").select("id, kind, name").eq("subject_id", exam.subject_id).order("sort_order"),
    supabase.from("stimuli").select("id, title, content").eq("subject_id", exam.subject_id).order("created_at", { ascending: false }).limit(200),
  ]);
  if (!sections?.length) notFound();

  let draft: QuestionDraft = {
    section_id: sections[0].id,
    stimulus_id: null,
    stimulus_marker: null,
    stem: "",
    explanation: "",
    options: { A: "", B: "", C: "", D: "" },
    correct: "",
    topic_id: null,
    skill_id: null,
    cognitive_level: null,
    difficulty: "medium",
    status: "draft",
  };

  if (!isNew) {
    const { data: q } = await supabase
      .from("questions")
      .select("id, stem, explanation, stimulus_id, stimulus_marker, topic_id, skill_id, cognitive_level, difficulty, status, origin, question_options(label, content, is_correct), exam_questions(section_id, exam_id)")
      .eq("id", qid)
      .maybeSingle();
    if (!q) notFound();
    const opts = { A: "", B: "", C: "", D: "" } as QuestionDraft["options"];
    let correct: QuestionDraft["correct"] = "";
    for (const o of q.question_options ?? []) {
      if (o.label in opts) opts[o.label as keyof typeof opts] = contentToText(o.content as RichContent);
      if (o.is_correct) correct = o.label as QuestionDraft["correct"];
    }
    const link = (q.exam_questions ?? []).find((l) => l.exam_id === id);
    draft = {
      question_id: q.id,
      section_id: link?.section_id ?? sections[0].id,
      stimulus_id: q.stimulus_id,
      stimulus_marker: q.stimulus_marker,
      stem: contentToText(q.stem as RichContent),
      explanation: contentToText(q.explanation as RichContent),
      options: opts,
      correct,
      topic_id: q.topic_id,
      skill_id: q.skill_id,
      cognitive_level: q.cognitive_level,
      difficulty: q.difficulty,
      status: q.status,
      origin: q.origin,
    };
  }

  const locked = exam.status === "published";
  return (
    <>
      <Link href={`/admin/exams/${id}`} className="text-sm text-ink-500 hover:text-ink-950">
        ← {exam.title}
      </Link>
      <PageHeader
        title={isNew ? "New question" : "Edit question"}
        description={
          locked
            ? "This exam is published — unpublish it to save changes."
            : draft.origin === "ai_generated"
              ? "AI-generated: check the wording, the answer key and the explanation before approving."
              : undefined
        }
      />
      <QuestionForm
        examId={id}
        draft={draft}
        sections={sections}
        stimuli={(stimuli ?? []).map((s) => ({ id: s.id, name: s.title || plainText(s.content as RichContent, 50) || "Untitled" }))}
        topics={(topics ?? []).filter((t) => t.kind === "topic").map((t) => ({ id: t.id, name: t.name }))}
        skills={(topics ?? []).filter((t) => t.kind === "skill").map((t) => ({ id: t.id, name: t.name }))}
        isLiteracy={isLiteracy}
      />
    </>
  );
}
