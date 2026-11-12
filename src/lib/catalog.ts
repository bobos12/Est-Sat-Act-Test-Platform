import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { isSupabaseConfigured } from "@/lib/env";

/**
 * Public catalog reads: subjects, topics, published exams and active plans.
 * They use the anon key without cookies, so RLS returns only public rows and
 * results can be cached across users. Admin writes call updateTag(CATALOG_TAG).
 */
export const CATALOG_TAG = "catalog";

export type Subject = {
  id: string;
  code: string;
  name: string;
  short_name: string;
  test_family: string;
  description: string;
  official_duration_minutes: number;
  official_question_count: number;
  official_sections: number;
};

export type Topic = { id: string; subject_id: string; kind: "topic" | "skill" | "domain"; name: string };

export type Difficulty = "easy" | "medium" | "hard";

export type CatalogExam = {
  id: string;
  slug: string;
  title: string;
  description: string;
  kind: "full_mock" | "practice";
  difficulty: Difficulty | null;
  access: "free" | "premium";
  duration_minutes: number;
  question_count: number;
  subject_id: string;
  focus_topic_id: string | null;
  sort_order: number;
};

export type Plan = {
  id: string;
  code: string;
  name: string;
  description: string;
  price_cents: number;
  currency: string;
  interval_months: number;
  features: string[];
};

function anonClient() {
  return createSupabaseClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export async function getSubjects(): Promise<Subject[]> {
  "use cache";
  cacheLife("hours");
  cacheTag(CATALOG_TAG);
  if (!isSupabaseConfigured()) return [];
  const { data, error } = await anonClient()
    .from("subjects")
    .select("id, code, name, short_name, test_family, description, official_duration_minutes, official_question_count, official_sections")
    .order("sort_order");
  if (error) throw new Error(`Could not load subjects: ${error.message}`);
  return data ?? [];
}

export async function getTopics(): Promise<Topic[]> {
  "use cache";
  cacheLife("hours");
  cacheTag(CATALOG_TAG);
  if (!isSupabaseConfigured()) return [];
  const { data, error } = await anonClient().from("topics").select("id, subject_id, kind, name").order("sort_order");
  if (error) throw new Error(`Could not load topics: ${error.message}`);
  return data ?? [];
}

export async function getPublishedExams(): Promise<CatalogExam[]> {
  "use cache";
  cacheLife("minutes");
  cacheTag(CATALOG_TAG);
  if (!isSupabaseConfigured()) return [];
  const { data, error } = await anonClient()
    .from("exams")
    .select("id, slug, title, description, kind, difficulty, access, duration_minutes, question_count, subject_id, focus_topic_id, sort_order")
    .eq("status", "published")
    .order("sort_order")
    .order("title");
  if (error) throw new Error(`Could not load exams: ${error.message}`);
  return data ?? [];
}

export async function getExamBySlug(slug: string): Promise<CatalogExam | null> {
  "use cache";
  cacheLife("minutes");
  cacheTag(CATALOG_TAG);
  if (!isSupabaseConfigured()) return null;
  const { data, error } = await anonClient()
    .from("exams")
    .select("id, slug, title, description, kind, difficulty, access, duration_minutes, question_count, subject_id, focus_topic_id, sort_order")
    .eq("slug", slug)
    .eq("status", "published")
    .maybeSingle();
  if (error) throw new Error(`Could not load exam: ${error.message}`);
  return data;
}

export async function getActivePlans(): Promise<Plan[]> {
  "use cache";
  cacheLife("minutes");
  cacheTag(CATALOG_TAG);
  if (!isSupabaseConfigured()) return [];
  const { data, error } = await anonClient()
    .from("plans")
    .select("id, code, name, description, price_cents, currency, interval_months, features")
    .eq("is_active", true)
    .order("sort_order");
  if (error) throw new Error(`Could not load plans: ${error.message}`);
  return (data ?? []).map((p) => ({ ...p, features: Array.isArray(p.features) ? (p.features as string[]) : [] }));
}

export function formatPrice(cents: number, currency: string) {
  const amount = cents / 100;
  return new Intl.NumberFormat("en-EG", {
    style: "currency",
    currency,
    maximumFractionDigits: amount % 1 === 0 ? 0 : 2,
  }).format(amount);
}

export const difficultyLabel: Record<Difficulty, string> = { easy: "Foundation", medium: "Standard", hard: "Challenging" };
