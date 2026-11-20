"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { adminClient } from "@/lib/admin/server";

const uuid = z.string().uuid();
const difficulty = z.enum(["easy", "medium", "hard"]);
const status = z.enum(["draft", "approved", "retired"]);

const back = (formData: FormData) => {
  const qs = String(formData.get("back") ?? "");
  return `/admin/questions${qs.startsWith("?") ? qs : ""}`;
};
const withMsg = (url: string, key: "ok" | "error", msg: string) => `${url}${url.includes("?") ? "&" : "?"}${key}=${encodeURIComponent(msg)}`;
const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? "" : "s"}`;

/**
 * Apply one change to every ticked question. op is one of:
 *   status:approved|draft|retired · difficulty:easy|medium|hard · category:<topic id> · exam:<exam id>
 */
export async function bulkQuestions(formData: FormData) {
  const { supabase } = await adminClient();
  const ids = [...new Set(formData.getAll("ids").map(String))].filter((v) => uuid.safeParse(v).success);
  const [kind, value] = String(formData.get("op") ?? "").split(":");
  const url = back(formData);
  if (!ids.length) redirect(withMsg(url, "error", "Tick at least one question first."));

  let msg = "";
  if (kind === "status") {
    const next = status.parse(value);
    let target = ids;
    let skipped = 0;
    if (next === "approved") {
      // Only questions with exactly one correct answer and at least two options can be approved.
      const { data: opts } = await supabase.from("question_options").select("question_id, is_correct").in("question_id", ids);
      const ok = ids.filter((id) => {
        const rows = (opts ?? []).filter((o) => o.question_id === id);
        return rows.length >= 2 && rows.filter((o) => o.is_correct).length === 1;
      });
      skipped = ids.length - ok.length;
      target = ok;
    }
    if (target.length) {
      const { error } = await supabase.from("questions").update({ status: next }).in("id", target);
      if (error) redirect(withMsg(url, "error", error.message));
    }
    msg = `${plural(target.length, "question")} marked ${next}.${skipped ? ` ${skipped} skipped: they need exactly one correct answer.` : ""}`;
  } else if (kind === "difficulty") {
    const { error } = await supabase.from("questions").update({ difficulty: difficulty.parse(value) }).in("id", ids);
    if (error) redirect(withMsg(url, "error", error.message));
    msg = `${plural(ids.length, "question")} set to ${value}.`;
  } else if (kind === "category") {
    const topicId = uuid.parse(value);
    const { data: topic } = await supabase.from("topics").select("id, kind, subject_id, name").eq("id", topicId).single();
    if (!topic) redirect(withMsg(url, "error", "Topic not found."));
    const { data: qs } = await supabase.from("questions").select("id, subject_id").in("id", ids);
    const same = (qs ?? []).filter((q) => q.subject_id === topic.subject_id).map((q) => q.id);
    if (same.length) {
      const patch = topic.kind === "skill" ? { skill_id: topic.id } : { topic_id: topic.id };
      const { error } = await supabase.from("questions").update(patch).in("id", same);
      if (error) redirect(withMsg(url, "error", error.message));
    }
    const other = ids.length - same.length;
    msg = `${plural(same.length, "question")} moved to ${topic.name}.${other ? ` ${other} skipped: different subject.` : ""}`;
  } else if (kind === "exam") {
    const examId = uuid.parse(value);
    const { data: exam } = await supabase.from("exams").select("id, title, status, subject_id").eq("id", examId).single();
    if (!exam) redirect(withMsg(url, "error", "Exam not found."));
    if (exam.status === "published") redirect(withMsg(url, "error", "Unpublish the exam before adding questions."));
    const [{ data: section }, { data: existing }, { data: qs }] = await Promise.all([
      supabase.from("exam_sections").select("id").eq("exam_id", examId).order("position", { ascending: false }).limit(1).maybeSingle(),
      supabase.from("exam_questions").select("question_id, position").eq("exam_id", examId),
      supabase.from("questions").select("id, subject_id").in("id", ids),
    ]);
    if (!section) redirect(withMsg(url, "error", "That exam has no sections yet."));
    const have = new Set((existing ?? []).map((r) => r.question_id));
    const add = (qs ?? []).filter((q) => q.subject_id === exam.subject_id && !have.has(q.id)).map((q) => q.id);
    let pos = Math.max(0, ...(existing ?? []).map((r) => r.position));
    if (add.length) {
      const { error } = await supabase
        .from("exam_questions")
        .insert(add.map((question_id) => ({ exam_id: examId, section_id: section.id, question_id, position: ++pos })));
      if (error) redirect(withMsg(url, "error", error.message));
    }
    const skipped = ids.length - add.length;
    msg = `${plural(add.length, "question")} added to ${exam.title}.${skipped ? ` ${skipped} skipped: already in it or a different subject.` : ""}`;
  } else {
    redirect(url);
  }

  revalidatePath("/admin/questions");
  redirect(withMsg(url, "ok", msg));
}

const metaSchema = z.object({
  id: uuid,
  status,
  difficulty,
  topic_id: z.preprocess((v) => (v === "" || v == null ? null : v), uuid.nullable()),
  skill_id: z.preprocess((v) => (v === "" || v == null ? null : v), uuid.nullable()),
  review_notes: z.string().trim().max(2000).default(""),
});

/** Quick edit of a question's tags from its detail page. Content edits stay in the exam editor. */
export async function updateQuestionMeta(formData: FormData) {
  const { supabase } = await adminClient();
  const parsed = metaSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) redirect(`/admin/questions/${String(formData.get("id"))}?error=${encodeURIComponent("Check the fields and try again.")}`);
  const { id, review_notes, ...rest } = parsed.data;
  if (rest.status === "approved") {
    const { data: opts } = await supabase.from("question_options").select("is_correct").eq("question_id", id);
    if ((opts ?? []).length < 2 || (opts ?? []).filter((o) => o.is_correct).length !== 1) {
      redirect(`/admin/questions/${id}?error=${encodeURIComponent("A question needs at least two options and exactly one correct answer before it can be approved.")}`);
    }
  }
  const { error } = await supabase.from("questions").update({ ...rest, review_notes: review_notes || null }).eq("id", id);
  if (error) redirect(`/admin/questions/${id}?error=${encodeURIComponent(error.message)}`);
  revalidatePath("/admin/questions");
  redirect(`/admin/questions/${id}?ok=${encodeURIComponent("Saved.")}`);
}
