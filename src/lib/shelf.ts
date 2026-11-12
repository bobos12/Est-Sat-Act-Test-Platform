import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { CATALOG_TAG, getPublishedExams, getSubjects, type CatalogExam } from "@/lib/catalog";
import { isSupabaseConfigured } from "@/lib/env";
import { createServiceClient } from "@/lib/supabase/server";
import { FALLBACK_CATALOG, SUBJECT_BY_CODE, type ShelfExam, type SubjectKey } from "@/lib/exam-catalog";

/**
 * Question count per section for the published exams. exam_questions is admin-only under RLS, so this
 * reads with the service client, server-side only, and returns counts only (never question content).
 * Falls back to a single module when unavailable.
 */
async function sectionCounts(examIds: string[]): Promise<Map<string, number[]>> {
  const out = new Map<string, number[]>();
  if (!examIds.length) return out;
  try {
    const db = createServiceClient();
    const [{ data: sections }, { data: rows }] = await Promise.all([
      db.from("exam_sections").select("id, exam_id, position").in("exam_id", examIds).order("position"),
      db.from("exam_questions").select("exam_id, section_id").in("exam_id", examIds),
    ]);
    const perSection = new Map<string, number>();
    for (const r of rows ?? []) perSection.set(r.section_id, (perSection.get(r.section_id) ?? 0) + 1);
    for (const s of sections ?? []) {
      const list = out.get(s.exam_id) ?? [];
      list.push(perSection.get(s.id) ?? 0);
      out.set(s.exam_id, list);
    }
  } catch {
    // Service key missing or query failed: callers fall back to one module.
  }
  return out;
}

function toShelf(e: CatalogExam, subject: SubjectKey, modules: number[] | undefined): ShelfExam {
  const mods = modules?.filter((n) => n > 0);
  return {
    id: e.slug,
    subject,
    title: e.title,
    kind: e.kind === "full_mock" ? "Full-length mock" : "Practice set",
    questions: e.question_count,
    minutes: e.duration_minutes,
    modules: mods?.length ? mods : [Math.max(e.question_count, 1)],
    access: e.access === "free" ? "free" : "pro",
    live: true,
  };
}

/** Published exams (free first), then "soon" entries for subjects with nothing published. Never lists unpublished exams. */
export async function getShelfExams(): Promise<ShelfExam[]> {
  "use cache";
  cacheLife("minutes");
  cacheTag(CATALOG_TAG);

  const allSoon = FALLBACK_CATALOG.filter((e) => e.access === "soon");
  if (!isSupabaseConfigured()) return allSoon;

  const [exams, subjects] = await Promise.all([getPublishedExams(), getSubjects()]);
  const codeById = new Map(subjects.map((s) => [s.id, s.code]));
  const published = exams.filter((e) => SUBJECT_BY_CODE[codeById.get(e.subject_id) ?? ""]);
  const counts = await sectionCounts(published.map((e) => e.id));

  const shelf = published.map((e) => toShelf(e, SUBJECT_BY_CODE[codeById.get(e.subject_id)!], counts.get(e.id)));
  shelf.sort((a, b) => Number(b.access === "free") - Number(a.access === "free"));
  // "Soon" placeholders only for subjects that have nothing published yet.
  const live = new Set(shelf.map((e) => e.subject));
  return [...shelf, ...allSoon.filter((e) => !live.has(e.subject))];
}
