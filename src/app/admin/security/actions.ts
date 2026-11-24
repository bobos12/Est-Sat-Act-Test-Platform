"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { adminClient } from "@/lib/admin/server";
import { codeToHexPrefix, decodeMarks } from "@/lib/watermark";

export type LimitsState = { error?: string; ok?: string } | undefined;

const limitsSchema = z.object({
  max_new_attempts_per_day: z.coerce.number().int().min(1, "Allow at least 1 exam a day.").max(100),
  max_practice_questions_per_day: z.coerce.number().int().min(10, "Allow at least 10 practice questions a day.").max(5000),
  flag_score: z.coerce.number().int().min(20, "A flag score under 20 would catch normal students.").max(100),
});

export async function saveLimits(_: LimitsState, formData: FormData): Promise<LimitsState> {
  const { supabase, viewer } = await adminClient();
  const parsed = limitsSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { error } = await supabase
    .from("app_settings")
    .upsert({ key: "content_protection", value: parsed.data, updated_by: viewer.id, updated_at: new Date().toISOString() });
  if (error) return { error: error.message };
  revalidatePath("/admin/security");
  return { ok: "Limits saved. They apply from the next exam or practice session." };
}

export type TraceMatch = { code: string; source: "hidden" | "typed"; accounts: { id: string; email: string; full_name: string; premium: boolean }[] };
export type TraceState = { error?: string; matches?: TraceMatch[] } | undefined;

/** Find the account behind leaked text (hidden marks) or a code read off a screenshot. */
export async function traceLeak(_: TraceState, formData: FormData): Promise<TraceState> {
  const { supabase } = await adminClient();
  const input = String(formData.get("input") ?? "").slice(0, 200_000);
  if (!input.trim()) return { error: "Paste the leaked text, or type the code from the screenshot." };

  const hidden = decodeMarks(input).map((code) => ({ code, source: "hidden" as const }));
  const typed = input.trim().replace(/^TS[\s·.:\-_]*/i, "").replace(/[\s·.\-_]/g, "");
  const codes = hidden.length ? hidden : codeToHexPrefix(typed) ? [{ code: typed.toUpperCase(), source: "typed" as const }] : [];
  if (!codes.length) {
    return { error: "No code found. Pasted text carries no hidden mark (it may have been retyped), and a typed code must be the 8 characters after “TS”." };
  }

  const matches: TraceMatch[] = [];
  for (const c of codes.slice(0, 10)) {
    const { data, error } = await supabase.rpc("admin_find_by_watermark", { p_prefix: codeToHexPrefix(c.code)! });
    if (error) return { error: error.message };
    matches.push({ ...c, accounts: (data ?? []) as TraceMatch["accounts"] });
  }
  return { matches };
}
