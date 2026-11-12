import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

export async function loadTaxonomy(supabase: SupabaseClient) {
  const [{ data: subjects }, { data: topics }] = await Promise.all([
    supabase.from("subjects").select("id, code, name, official_duration_minutes, official_sections, is_active").order("sort_order"),
    supabase.from("topics").select("id, subject_id, kind, name").order("sort_order"),
  ]);
  return { subjects: subjects ?? [], topics: topics ?? [] };
}

export type Taxonomy = Awaited<ReturnType<typeof loadTaxonomy>>;
