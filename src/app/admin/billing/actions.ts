"use server";

import { revalidatePath, updateTag } from "next/cache";
import { z } from "zod";
import { adminClient } from "@/lib/admin/server";
import { CATALOG_TAG } from "@/lib/catalog";

export type PlanState = { error?: string; ok?: string } | undefined;

const planSchema = z.object({
  id: z.preprocess((v) => (v === "" || v == null ? undefined : v), z.string().uuid().optional()),
  code: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9-]{2,40}$/, "Code: 2–40 lowercase letters, numbers or dashes (used in the checkout URL)."),
  name: z.string().trim().min(2).max(60),
  description: z.string().trim().max(300).default(""),
  price: z.coerce.number().min(0, "Price can't be negative.").max(1_000_000),
  currency: z.string().trim().toUpperCase().length(3),
  interval_months: z.coerce.number().int().min(1).max(24),
  features: z.string().default(""),
  sort_order: z.coerce.number().int().min(0).default(0),
  is_active: z.preprocess((v) => v === "on", z.boolean()),
});

export async function savePlan(_: PlanState, formData: FormData): Promise<PlanState> {
  const { supabase } = await adminClient();
  const parsed = planSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { id, price, features, ...rest } = parsed.data;
  const row = {
    ...rest,
    price_cents: Math.round(price * 100),
    features: features
      .split("\n")
      .map((f) => f.trim())
      .filter(Boolean)
      .slice(0, 12),
  };
  const { error } = id ? await supabase.from("plans").update(row).eq("id", id) : await supabase.from("plans").insert(row);
  if (error) return { error: error.message.includes("duplicate") ? "Another plan already uses that code." : error.message };
  updateTag(CATALOG_TAG);
  return { ok: id ? "Plan updated." : "Plan created." };
}

/** Approve (access starts now) or reject a manual InstaPay / Vodafone Cash payment. */
export async function reviewPayment(formData: FormData) {
  const { supabase } = await adminClient();
  const id = z.string().uuid().parse(formData.get("id"));
  const approve = formData.get("decision") === "approve";
  const reason = String(formData.get("reason") ?? "").slice(0, 200);
  const { error } = await supabase.rpc("admin_review_payment", { p_payment: id, p_approve: approve, p_reason: reason || null });
  if (error) throw new Error(error.message);
  revalidatePath("/admin/billing");
}

const codeSchema = z.object({
  code: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z0-9_-]{3,30}$/, "Code: 3–30 letters, numbers, dashes or underscores."),
  kind: z.enum(["percent", "amount"]),
  value: z.coerce.number().positive("Enter a discount above zero."),
  expires_at: z.preprocess((v) => (v === "" || v == null ? undefined : v), z.string().optional()),
  max_uses: z.preprocess((v) => (v === "" || v == null ? undefined : Number(v)), z.number().int().positive().optional()),
});

export async function saveDiscount(_: PlanState, formData: FormData): Promise<PlanState> {
  const { supabase } = await adminClient();
  const parsed = codeSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { code, kind, value, expires_at, max_uses } = parsed.data;
  if (kind === "percent" && value > 100) return { error: "A percentage can't be more than 100." };
  const { error } = await supabase.from("discount_codes").insert({
    code,
    kind,
    value: kind === "percent" ? Math.round(value) : Math.round(value * 100),
    expires_at: expires_at ? new Date(`${expires_at}T23:59:59+02:00`).toISOString() : null,
    max_uses: max_uses ?? null,
  });
  if (error) return { error: error.message.includes("duplicate") ? "That code already exists." : error.message };
  revalidatePath("/admin/billing");
  return { ok: `Code ${code} created.` };
}

export async function toggleDiscount(formData: FormData) {
  const { supabase } = await adminClient();
  const id = z.string().uuid().parse(formData.get("id"));
  await supabase.from("discount_codes").update({ is_active: formData.get("active") === "true" }).eq("id", id);
  revalidatePath("/admin/billing");
}
