import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { textToContent } from "@/lib/content";
import { optionLabels, type AiQuestion, type AiStimulus } from "@/lib/ai/schemas";

type TopicRow = { id: string; kind: string; name: string };

function topicIds(topics: TopicRow[]) {
  const byName = new Map(topics.map((t) => [`${t.kind}:${t.name.toLowerCase()}`, t.id]));
  return (kind: string, name?: string | null) => (name ? byName.get(`${kind}:${name.toLowerCase()}`) ?? null : null);
}

/** Inserts stimuli and returns a ref → id map. */
async function insertStimuli(
  db: SupabaseClient,
  stimuli: AiStimulus[],
  common: { subject_id: string; origin: "source" | "ai_generated"; source_document_id?: string | null; created_by?: string | null },
  domainId: (name?: string | null) => string | null,
) {
  const map = new Map<string, string>();
  for (const s of stimuli) {
    const { data, error } = await db
      .from("stimuli")
      .insert({
        ...common,
        kind: s.kind,
        title: s.title || null,
        attribution: s.attribution || null,
        domain_topic_id: domainId(s.domain),
        content: textToContent(s.content),
      })
      .select("id")
      .single();
    if (error) throw new Error(`Saving a passage failed: ${error.message}`);
    map.set(s.ref, data.id);
  }
  return map;
}

/** Saves an extracted official paper as reference questions (origin = source). */
export async function saveExtraction(
  db: SupabaseClient,
  doc: { id: string; subject_id: string },
  topics: TopicRow[],
  data: { stimuli: AiStimulus[]; questions: AiQuestion[] },
  userId: string,
) {
  const id = topicIds(topics);
  const stim = await insertStimuli(db, data.stimuli, { subject_id: doc.subject_id, origin: "source", source_document_id: doc.id, created_by: userId }, (n) => id("domain", n));
  let saved = 0;
  const items: { id: string; number: number | null; hasKey: boolean }[] = [];
  for (const q of data.questions) {
    const { data: row, error } = await db
      .from("questions")
      .insert({
        subject_id: doc.subject_id,
        stimulus_id: q.stimulus_ref ? stim.get(q.stimulus_ref) ?? null : null,
        stimulus_marker: q.marker ?? null,
        stem: textToContent(q.stem),
        explanation: textToContent(q.explanation ?? ""),
        topic_id: id("topic", q.topic),
        skill_id: id("skill", q.skill),
        cognitive_level: q.cognitive_level ?? null,
        difficulty: q.difficulty ?? "medium",
        origin: "source",
        status: "draft",
        source_document_id: doc.id,
        source_question_number: q.number ?? null,
        review_notes: (q as { review_note?: string }).review_note ?? (q.has_figure ? "Contains a figure in the original paper. Check that it was captured." : null),
        created_by: userId,
      })
      .select("id")
      .single();
    if (error) throw new Error(`Saving question ${q.number ?? saved + 1} failed: ${error.message}`);
    const { error: oErr } = await db.from("question_options").insert(
      optionLabels(q).map((l) => ({ question_id: row.id, label: l, content: textToContent(q.options[l] || "—"), is_correct: q.correct === l })),
    );
    if (oErr) throw new Error(oErr.message);
    items.push({ id: row.id, number: q.number ?? null, hasKey: Boolean(q.correct) });
    saved++;
  }
  return { saved, items };
}

/**
 * Turns an extracted official paper into a student exam. Questions are approved and the exam is
 * published as soon as every question has an answer key; otherwise it waits in review.
 * Literacy modules are detected where the printed question numbers restart.
 */
export async function publishSourceExam(
  db: SupabaseClient,
  input: { subject_id: string; title: string; slug: string; access: "free" | "premium"; duration_minutes: number; sort_order: number; created_by: string },
  items: { id: string; number: number | null; hasKey: boolean }[],
) {
  const { data: exam, error } = await db
    .from("exams")
    .insert({ ...input, description: "", kind: "full_mock", status: "draft", origin: "source" })
    .select("id")
    .single();
  if (error) throw new Error(`Creating the exam failed: ${error.message}`);

  const modules: (typeof items)[] = [];
  items.forEach((it, i) => {
    const prev = items[i - 1]?.number;
    if (!modules.length || (it.number != null && prev != null && it.number < prev)) modules.push([]);
    modules[modules.length - 1].push(it);
  });
  let position = 0;
  for (const [m, list] of modules.entries()) {
    const { data: section, error: sErr } = await db
      .from("exam_sections")
      .insert({ exam_id: exam.id, position: m + 1, title: modules.length > 1 ? `Module ${m + 1}` : "Section 1" })
      .select("id")
      .single();
    if (sErr) throw new Error(sErr.message);
    const { error: lErr } = await db
      .from("exam_questions")
      .insert(list.map((it) => ({ exam_id: exam.id, section_id: section.id, question_id: it.id, position: ++position })));
    if (lErr) throw new Error(lErr.message);
  }

  const missing = items.filter((i) => !i.hasKey).length;
  if (missing) {
    await db.from("exams").update({ status: "in_review" }).eq("id", exam.id);
    return { examId: exam.id as string, published: false, missingKeys: missing };
  }
  const { error: aErr } = await db.from("questions").update({ status: "approved" }).in("id", items.map((i) => i.id));
  if (aErr) throw new Error(aErr.message);
  const { error: pErr } = await db.from("exams").update({ status: "published" }).eq("id", exam.id);
  if (pErr) throw new Error(pErr.message);
  return { examId: exam.id as string, published: true, missingKeys: 0 };
}

/** Saves AI-generated content as a draft exam awaiting review. Never publishes. */
export async function saveGeneratedExam(
  db: SupabaseClient,
  input: {
    subject_id: string;
    title: string;
    slug: string;
    description: string;
    access: "free" | "premium";
    duration_minutes: number;
    focus_topic_id: string | null;
    kind: "practice" | "full_mock";
    generation_job_id: string;
    created_by: string;
  },
  topics: TopicRow[],
  data: { stimuli: AiStimulus[]; questions: (AiQuestion & { review_note?: string })[] },
) {
  const id = topicIds(topics);
  const { data: exam, error } = await db
    .from("exams")
    .insert({ ...input, status: "in_review", origin: "ai_generated" })
    .select("id")
    .single();
  if (error) throw new Error(`Creating the exam failed: ${error.message}`);
  const { data: section, error: sErr } = await db.from("exam_sections").insert({ exam_id: exam.id, position: 1, title: "Section 1" }).select("id").single();
  if (sErr) throw new Error(sErr.message);

  const stim = await insertStimuli(db, data.stimuli, { subject_id: input.subject_id, origin: "ai_generated", created_by: input.created_by }, (n) => id("domain", n));

  // Keep questions that share a stimulus together, in the order generated.
  let position = 0;
  for (const q of data.questions) {
    const { data: row, error: qErr } = await db
      .from("questions")
      .insert({
        subject_id: input.subject_id,
        stimulus_id: q.stimulus_ref ? stim.get(q.stimulus_ref) ?? null : null,
        stimulus_marker: q.marker ?? null,
        stem: textToContent(q.stem),
        explanation: textToContent(q.explanation ?? ""),
        topic_id: id("topic", q.topic),
        skill_id: id("skill", q.skill),
        cognitive_level: q.cognitive_level ?? null,
        difficulty: q.difficulty ?? "medium",
        origin: "ai_generated",
        status: "draft",
        generation_job_id: input.generation_job_id,
        review_notes: q.review_note ?? null,
        created_by: input.created_by,
      })
      .select("id")
      .single();
    if (qErr) throw new Error(qErr.message);
    const { error: oErr } = await db.from("question_options").insert(
      (["A", "B", "C", "D"] as const).map((l) => ({ question_id: row.id, label: l, content: textToContent(q.options[l]), is_correct: q.correct === l })),
    );
    if (oErr) throw new Error(oErr.message);
    const { error: lErr } = await db.from("exam_questions").insert({ exam_id: exam.id, section_id: section.id, question_id: row.id, position: ++position });
    if (lErr) throw new Error(lErr.message);
  }
  return exam.id as string;
}
