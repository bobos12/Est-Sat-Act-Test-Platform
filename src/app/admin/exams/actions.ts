"use server";

import { revalidatePath, updateTag } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { adminClient } from "@/lib/admin/server";
import { CATALOG_TAG } from "@/lib/catalog";
import { textToContent } from "@/lib/content";

export type ActionState = { error?: string; ok?: string } | undefined;

const uuid = z.string().uuid();
const optionalUuid = z.preprocess((v) => (v === "" || v == null ? null : v), z.string().uuid().nullable());
const difficulty = z.enum(["easy", "medium", "hard"]);

function slugify(s: string) {
  return s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/[\s_]+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 80);
}

function dbError(message: string) {
  if (message.includes("duplicate key") && message.includes("slug")) return "Another exam already uses that URL slug.";
  return message;
}

// ---------------------------------------------------------------------------
// Exams
// ---------------------------------------------------------------------------

const examSchema = z.object({
  subject_id: uuid,
  title: z.string().trim().min(3).max(140),
  slug: z.string().trim().max(80).optional(),
  description: z.string().trim().max(1000).default(""),
  kind: z.enum(["full_mock", "practice"]),
  focus_topic_id: optionalUuid,
  difficulty: z.preprocess((v) => (v === "" ? null : v), difficulty.nullable()),
  access: z.enum(["free", "premium"]),
  duration_minutes: z.coerce.number().int().min(1).max(300),
  sort_order: z.coerce.number().int().min(0).max(10000).default(0),
});

export async function createExam(_: ActionState, formData: FormData): Promise<ActionState> {
  const { supabase, viewer } = await adminClient();
  const parsed = examSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues.map((i) => `${String(i.path[0])}: ${i.message}`).join("; ") };
  const v = parsed.data;
  const sections = z.coerce.number().int().min(1).max(5).catch(1).parse(formData.get("sections"));

  const { data: exam, error } = await supabase
    .from("exams")
    .insert({ ...v, slug: slugify(v.slug || v.title), origin: "manual", created_by: viewer.id })
    .select("id")
    .single();
  if (error) return { error: dbError(error.message) };

  const rows = Array.from({ length: sections }, (_, i) => ({
    exam_id: exam.id,
    position: i + 1,
    title: sections > 1 ? `Module ${i + 1}` : "Section 1",
  }));
  const { error: secErr } = await supabase.from("exam_sections").insert(rows);
  if (secErr) return { error: secErr.message };
  redirect(`/admin/exams/${exam.id}`);
}

export async function updateExam(_: ActionState, formData: FormData): Promise<ActionState> {
  const { supabase } = await adminClient();
  const id = uuid.safeParse(formData.get("id"));
  const parsed = examSchema.safeParse(Object.fromEntries(formData));
  if (!id.success || !parsed.success) return { error: parsed.error?.issues.map((i) => `${String(i.path[0])}: ${i.message}`).join("; ") ?? "Invalid exam" };
  const v = parsed.data;
  const { error } = await supabase
    .from("exams")
    .update({ ...v, slug: slugify(v.slug || v.title) })
    .eq("id", id.data);
  if (error) return { error: dbError(error.message) };
  updateTag(CATALOG_TAG);
  return { ok: "Saved." };
}

const statusInput = z.object({ id: uuid, status: z.enum(["draft", "in_review", "published", "archived"]) });

/** Publish / unpublish / archive. Publishing rules are enforced by the database. */
export async function setExamStatus(formData: FormData) {
  const { supabase } = await adminClient();
  const { id, status } = statusInput.parse(Object.fromEntries(formData));
  const { error } = await supabase.from("exams").update({ status }).eq("id", id);
  if (error) redirect(`/admin/exams/${id}?error=${encodeURIComponent(error.message)}`);
  updateTag(CATALOG_TAG);
  redirect(`/admin/exams/${id}?ok=${encodeURIComponent(`Exam is now ${status.replace("_", " ")}.`)}`);
}

/** One-click switch between Free and Premium from the exam list. */
export async function setExamAccess(formData: FormData) {
  const { supabase } = await adminClient();
  const id = uuid.parse(formData.get("id"));
  const access = z.enum(["free", "premium"]).parse(formData.get("access"));
  const { error } = await supabase.from("exams").update({ access }).eq("id", id);
  if (error) throw new Error(error.message);
  updateTag(CATALOG_TAG);
}

/** Approve every draft question in an exam (after review) so it can be published. */
export async function approveAllQuestions(formData: FormData) {
  const { supabase } = await adminClient();
  const id = uuid.parse(formData.get("id"));
  const { data: eqs } = await supabase.from("exam_questions").select("question_id").eq("exam_id", id);
  const ids = (eqs ?? []).map((r) => r.question_id);
  if (ids.length) {
    const { error } = await supabase.from("questions").update({ status: "approved" }).in("id", ids).eq("status", "draft");
    if (error) redirect(`/admin/exams/${id}?error=${encodeURIComponent(error.message)}`);
  }
  redirect(`/admin/exams/${id}?ok=${encodeURIComponent("All questions approved.")}`);
}

export async function moveQuestion(formData: FormData) {
  const { supabase } = await adminClient();
  const examId = uuid.parse(formData.get("exam_id"));
  const eqId = uuid.parse(formData.get("eq_id"));
  const dir = z.enum(["up", "down"]).parse(formData.get("dir"));
  const { data: rows } = await supabase.from("exam_questions").select("id").eq("exam_id", examId).order("position");
  const ids = (rows ?? []).map((r) => r.id);
  const i = ids.indexOf(eqId);
  const j = dir === "up" ? i - 1 : i + 1;
  if (i < 0 || j < 0 || j >= ids.length) return;
  [ids[i], ids[j]] = [ids[j], ids[i]];
  const { error } = await supabase.rpc("admin_reorder_exam", { p_exam: examId, p_exam_question_ids: ids });
  if (error) redirect(`/admin/exams/${examId}?error=${encodeURIComponent(error.message)}`);
  redirect(`/admin/exams/${examId}`);
}

export async function removeQuestion(formData: FormData) {
  const { supabase } = await adminClient();
  const examId = uuid.parse(formData.get("exam_id"));
  const eqId = uuid.parse(formData.get("eq_id"));
  const { data: exam } = await supabase.from("exams").select("status").eq("id", examId).single();
  if (exam?.status === "published") redirect(`/admin/exams/${examId}?error=${encodeURIComponent("Unpublish the exam before removing questions.")}`);
  await supabase.from("exam_questions").delete().eq("id", eqId).eq("exam_id", examId);
  // Close the gap in positions.
  const { data: rows } = await supabase.from("exam_questions").select("id").eq("exam_id", examId).order("position");
  await supabase.rpc("admin_reorder_exam", { p_exam: examId, p_exam_question_ids: (rows ?? []).map((r) => r.id) });
  redirect(`/admin/exams/${examId}?ok=${encodeURIComponent("Question removed from the exam.")}`);
}

// ---------------------------------------------------------------------------
// Questions
// ---------------------------------------------------------------------------

const questionSchema = z.object({
  exam_id: uuid,
  question_id: optionalUuid,
  section_id: uuid,
  stimulus_id: optionalUuid,
  stimulus_marker: z.preprocess((v) => (v === "" || v == null ? null : v), z.coerce.number().int().min(1).max(200).nullable()),
  stem: z.string().trim().min(1, "The question needs a stem."),
  explanation: z.string().trim().default(""),
  option_A: z.string().trim().min(1, "Option A is empty."),
  option_B: z.string().trim().min(1, "Option B is empty."),
  option_C: z.string().trim().default(""),
  option_D: z.string().trim().default(""),
  correct: z.enum(["A", "B", "C", "D"], { message: "Mark the correct answer." }),
  topic_id: optionalUuid,
  skill_id: optionalUuid,
  cognitive_level: z.preprocess((v) => (v === "" ? null : v), z.enum(["knowledge", "application", "reasoning", "synthesis"]).nullable()),
  difficulty,
  approve: z.preprocess((v) => v === "on", z.boolean()),
});

export async function saveQuestion(_: ActionState, formData: FormData): Promise<ActionState> {
  const { supabase, viewer } = await adminClient();
  const parsed = questionSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues.map((i) => i.message).join(" ") };
  const v = parsed.data;

  const labels = (["A", "B", "C", "D"] as const).filter((l) => v[`option_${l}`]);
  if (!labels.includes(v.correct)) return { error: `Option ${v.correct} is marked correct but is empty.` };

  const { data: exam } = await supabase.from("exams").select("status, subject_id").eq("id", v.exam_id).single();
  if (!exam) return { error: "Exam not found." };
  if (exam.status === "published") return { error: "Unpublish the exam before editing its questions." };

  const fields = {
    subject_id: exam.subject_id,
    stimulus_id: v.stimulus_id,
    stimulus_marker: v.stimulus_marker,
    stem: textToContent(v.stem),
    explanation: textToContent(v.explanation),
    topic_id: v.topic_id,
    skill_id: v.skill_id,
    cognitive_level: v.cognitive_level,
    difficulty: v.difficulty,
    ...(v.approve ? { status: "approved" as const } : {}),
  };

  let questionId = v.question_id;
  if (questionId) {
    const { error } = await supabase.from("questions").update(fields).eq("id", questionId);
    if (error) return { error: error.message };
    const { error: delErr } = await supabase.from("question_options").delete().eq("question_id", questionId);
    if (delErr) return { error: delErr.message };
  } else {
    const { data: q, error } = await supabase
      .from("questions")
      .insert({ ...fields, origin: "manual", status: v.approve ? "approved" : "draft", created_by: viewer.id })
      .select("id")
      .single();
    if (error) return { error: error.message };
    questionId = q.id;
  }

  const { error: optErr } = await supabase.from("question_options").insert(
    labels.map((l) => ({
      question_id: questionId,
      label: l,
      content: textToContent(v[`option_${l}`]),
      is_correct: l === v.correct,
    })),
  );
  if (optErr) return { error: optErr.message };

  if (!v.question_id) {
    const { count } = await supabase.from("exam_questions").select("id", { count: "exact", head: true }).eq("exam_id", v.exam_id);
    const { error: linkErr } = await supabase
      .from("exam_questions")
      .insert({ exam_id: v.exam_id, section_id: v.section_id, question_id: questionId, position: (count ?? 0) + 1 });
    if (linkErr) return { error: linkErr.message };
  } else {
    await supabase.from("exam_questions").update({ section_id: v.section_id }).eq("exam_id", v.exam_id).eq("question_id", questionId);
  }

  redirect(`/admin/exams/${v.exam_id}?ok=${encodeURIComponent("Question saved.")}`);
}

// ---------------------------------------------------------------------------
// Shared stimuli (passages, tables, figures)
// ---------------------------------------------------------------------------

const stimulusSchema = z.object({
  exam_id: uuid,
  stimulus_id: optionalUuid,
  kind: z.enum(["passage", "figure", "table", "data_set", "text"]),
  title: z.string().trim().max(200).default(""),
  attribution: z.string().trim().max(300).default(""),
  domain_topic_id: optionalUuid,
  content: z.string().trim().min(1, "The passage is empty."),
});

export async function saveStimulus(_: ActionState, formData: FormData): Promise<ActionState> {
  const { supabase, viewer } = await adminClient();
  const parsed = stimulusSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues.map((i) => i.message).join(" ") };
  const v = parsed.data;
  const { data: exam } = await supabase.from("exams").select("status, subject_id").eq("id", v.exam_id).single();
  if (!exam) return { error: "Exam not found." };
  if (exam.status === "published") return { error: "Unpublish the exam before editing its passages." };

  const fields = {
    subject_id: exam.subject_id,
    kind: v.kind,
    title: v.title || null,
    attribution: v.attribution || null,
    domain_topic_id: v.domain_topic_id,
    content: textToContent(v.content),
  };
  const { error } = v.stimulus_id
    ? await supabase.from("stimuli").update(fields).eq("id", v.stimulus_id)
    : await supabase.from("stimuli").insert({ ...fields, origin: "manual", created_by: viewer.id });
  if (error) return { error: error.message };
  redirect(`/admin/exams/${v.exam_id}?ok=${encodeURIComponent("Passage saved.")}`);
}

// ---------------------------------------------------------------------------
// Question media upload (figures, graphs) → public bucket, returns markdown
// ---------------------------------------------------------------------------

const MAX_IMAGE = 5 * 1024 * 1024;
const IMAGE_TYPES: Record<string, string> = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp", "image/svg+xml": "svg" };

export async function uploadQuestionImage(formData: FormData): Promise<{ markdown?: string; error?: string }> {
  const { supabase } = await adminClient();
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return { error: "Choose an image." };
  const ext = IMAGE_TYPES[file.type];
  if (!ext) return { error: "Use PNG, JPG, WebP or SVG." };
  if (file.size > MAX_IMAGE) return { error: "Images must be under 5 MB." };
  const path = `questions/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from("question-media").upload(path, file, { contentType: file.type, upsert: false });
  if (error) return { error: error.message };
  const { data } = supabase.storage.from("question-media").getPublicUrl(path);
  const alt = String(formData.get("alt") ?? "").trim() || "Figure";
  return { markdown: `![${alt.replace(/[[\]]/g, "")}](${data.publicUrl})` };
}

const backTo = (formData: FormData) => {
  const qs = String(formData.get("back") ?? "");
  return `/admin/exams${qs.startsWith("?") ? qs : ""}`;
};
const withMsg = (url: string, key: "ok" | "error", msg: string) => `${url}${url.includes("?") ? "&" : "?"}${key}=${encodeURIComponent(msg)}`;

/** One row's quick action, sent as "id:field:value" (access free/premium, status published/draft/archived). */
export async function examRowAction(formData: FormData) {
  const { supabase } = await adminClient();
  const [id, field, value] = String(formData.get("row") ?? "").split(":");
  uuid.parse(id);
  const patch =
    field === "access"
      ? { access: z.enum(["free", "premium"]).parse(value) }
      : { status: z.enum(["draft", "published", "archived"]).parse(value) };
  const { error } = await supabase.from("exams").update(patch).eq("id", id);
  updateTag(CATALOG_TAG);
  revalidatePath("/admin/exams");
  redirect(error ? withMsg(backTo(formData), "error", error.message) : backTo(formData));
}

/** Apply one change to every ticked exam. */
export async function bulkExams(formData: FormData) {
  // Row buttons (Free/Premium, Publish/Unpublish) submit through the same form.
  if (formData.get("row")) return examRowAction(formData);
  const { supabase } = await adminClient();
  const ids = formData.getAll("ids").map(String).filter((v) => uuid.safeParse(v).success);
  const op = String(formData.get("op") ?? "");
  const back = backTo(formData);
  if (!ids.length) redirect(withMsg(back, "error", "Tick at least one exam first."));
  const patch: Record<string, string> | null =
    op === "free" ? { access: "free" } : op === "premium" ? { access: "premium" } : op === "publish" ? { status: "published" } : op === "unpublish" ? { status: "draft" } : op === "archive" ? { status: "archived" } : null;
  if (!patch) redirect(back);
  const failed: string[] = [];
  for (const id of ids) {
    const { error } = await supabase.from("exams").update(patch).eq("id", id);
    if (error) failed.push(error.message);
  }
  updateTag(CATALOG_TAG);
  revalidatePath("/admin/exams");
  const done = ids.length - failed.length;
  redirect(
    failed.length
      ? withMsg(back, "error", `${done} updated, ${failed.length} could not be changed: ${failed[0]}`)
      : withMsg(back, "ok", `${done} ${done === 1 ? "exam" : "exams"} updated.`),
  );
}
