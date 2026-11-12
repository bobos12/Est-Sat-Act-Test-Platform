"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { adminClient } from "@/lib/admin/server";
import { aiConfigured, pool } from "@/lib/ai/client";
import { generateExamContent } from "@/lib/ai/generate";
import { saveGeneratedExam } from "@/lib/admin/persist";
import { contentToText, type RichContent } from "@/lib/content";
import { blueprints } from "@/lib/est-blueprint";

export type GenerateState = { error?: string } | undefined;

const schema = z
  .object({
    subject_id: z.string().uuid(),
    title: z.string().trim().min(3).max(120),
    questions: z.coerce.number().int().min(5).max(60),
    exams: z.coerce.number().int().min(1).max(3),
    duration: z.coerce.number().int().min(5).max(180),
    easy: z.coerce.number().int().min(0).max(100),
    medium: z.coerce.number().int().min(0).max(100),
    hard: z.coerce.number().int().min(0).max(100),
    access: z.enum(["free", "premium"]),
  })
  .refine((v) => v.easy + v.medium + v.hard === 100, { message: "Difficulty percentages must add up to 100." });

function slugify(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60);
}

export async function generateExams(_: GenerateState, formData: FormData): Promise<GenerateState> {
  const { supabase, viewer } = await adminClient();
  if (!aiConfigured()) return { error: "Add GEMINI_API_KEY (free) or ANTHROPIC_API_KEY to the server environment to enable generation." };
  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const v = parsed.data;
  const topicIds = formData.getAll("topic_ids").map(String).filter((x) => z.string().uuid().safeParse(x).success);

  const { data: subject } = await supabase.from("subjects").select("id, code, name").eq("id", v.subject_id).single();
  if (!subject) return { error: "Unknown subject." };
  const blueprint = blueprints[subject.code];
  if (!blueprint) return { error: `${subject.name} is not set up for generation yet.` };

  const { data: topics } = await supabase.from("topics").select("id, kind, name").eq("subject_id", subject.id).order("sort_order");
  const all = topics ?? [];
  const chosen = all.filter((t) => topicIds.includes(t.id));
  const chosenTopics = chosen.filter((t) => t.kind === "topic").map((t) => t.name);
  const chosenDomains = chosen.filter((t) => t.kind === "domain").map((t) => t.name);

  // Style references from the knowledge base (never reused as content).
  const { data: refs } = await supabase
    .from("questions")
    .select("stem, question_options(label, content, is_correct), topics:topic_id(name)")
    .eq("subject_id", subject.id)
    .eq("origin", "source")
    .neq("status", "retired")
    .limit(200);
  const pickedRefs = (refs ?? [])
    .filter((r) => {
      const t = Array.isArray(r.topics) ? r.topics[0] : r.topics;
      return !chosenTopics.length || (t && chosenTopics.includes(t.name));
    })
    .sort(() => Math.random() - 0.5)
    .slice(0, 8)
    .map((r) => {
      const opts = (r.question_options ?? []).sort((a, b) => a.label.localeCompare(b.label));
      return `${contentToText(r.stem as RichContent)}\n${opts.map((o) => `${o.label}. ${contentToText(o.content as RichContent)}`).join("\n")}\nAnswer: ${opts.find((o) => o.is_correct)?.label ?? "?"}`;
    });

  const { data: job, error: jobErr } = await supabase
    .from("generation_jobs")
    .insert({
      subject_id: subject.id,
      topic_ids: chosen.map((t) => t.id),
      questions_per_exam: v.questions,
      exam_count: v.exams,
      duration_minutes: v.duration,
      difficulty_mix: { easy: v.easy, medium: v.medium, hard: v.hard },
      status: "running",
      status_detail: "Writing questions…",
      created_by: viewer.id,
    })
    .select("id")
    .single();
  if (jobErr) return { error: jobErr.message };

  try {
    const ids = await pool(Array.from({ length: v.exams }, (_, i) => i), 2, async (i) => {
      const content = await generateExamContent({
        subjectCode: subject.code,
        subjectName: subject.name,
        topics: chosenTopics.length ? chosenTopics : subject.code.includes("math") ? Object.keys(blueprint.topicWeights ?? {}) : [],
        topicWeights: chosenTopics.length ? undefined : blueprint.topicWeights,
        skills: all.filter((t) => t.kind === "skill").map((t) => t.name),
        domains: chosenDomains.length ? chosenDomains : all.filter((t) => t.kind === "domain").map((t) => t.name),
        questionCount: v.questions,
        difficultyMix: { easy: v.easy, medium: v.medium, hard: v.hard },
        references: pickedRefs,
        blueprint: blueprint.text,
      });
      if (content.questions.length < Math.ceil(v.questions * 0.8)) {
        throw new Error(`Only ${content.questions.length} of ${v.questions} questions passed validation. Try again.`);
      }
      const title = v.exams > 1 ? `${v.title} ${i + 1}` : v.title;
      const focus = chosen.filter((t) => t.kind === "topic");
      return saveGeneratedExam(
        supabase,
        {
          subject_id: subject.id,
          title,
          slug: `${slugify(title)}-${job.id.slice(0, 6)}${v.exams > 1 ? `-${i + 1}` : ""}`,
          description: "",
          access: v.access,
          duration_minutes: v.duration,
          focus_topic_id: focus.length === 1 ? focus[0].id : null,
          kind: v.questions >= 40 ? "full_mock" : "practice",
          generation_job_id: job.id,
          created_by: viewer.id,
        },
        all,
        content,
      );
    });
    await supabase
      .from("generation_jobs")
      .update({ status: "completed", status_detail: null, result_exam_ids: ids, completed_at: new Date().toISOString() })
      .eq("id", job.id);
    redirect(ids.length === 1 ? `/admin/exams/${ids[0]}?ok=${encodeURIComponent("Draft generated. Review every question, approve, then publish.")}` : "/admin/exams?status=in_review");
  } catch (e) {
    if (e && typeof e === "object" && "digest" in e && String((e as { digest: unknown }).digest).startsWith("NEXT_REDIRECT")) throw e;
    const msg = e instanceof Error ? e.message : "Generation failed";
    await supabase.from("generation_jobs").update({ status: "failed", status_detail: msg.slice(0, 500), completed_at: new Date().toISOString() }).eq("id", job.id);
    return { error: msg };
  }
}
