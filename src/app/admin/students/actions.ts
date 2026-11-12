"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { adminClient } from "@/lib/admin/server";

export type AccessState = { error?: string; ok?: string } | undefined;

const grantSchema = z.object({
  user_id: z.string().uuid(),
  days: z.coerce.number().int().min(1, "At least 1 day.").max(730, "At most 730 days."),
  note: z.string().trim().min(3, "Add a short reason — it goes into the audit log.").max(500),
});

export async function grantAccess(_: AccessState, formData: FormData): Promise<AccessState> {
  const { supabase } = await adminClient();
  const parsed = grantSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { error } = await supabase.rpc("admin_grant_access", {
    p_user: parsed.data.user_id,
    p_days: parsed.data.days,
    p_note: parsed.data.note,
  });
  if (error) return { error: error.message };
  revalidatePath(`/admin/students/${parsed.data.user_id}`);
  return { ok: `Premium access granted for ${parsed.data.days} days.` };
}

const revokeSchema = z.object({
  user_id: z.string().uuid(),
  note: z.string().trim().min(3, "Add a short reason — it goes into the audit log.").max(500),
});

export async function revokeAccess(_: AccessState, formData: FormData): Promise<AccessState> {
  const { supabase } = await adminClient();
  const parsed = revokeSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { data, error } = await supabase.rpc("admin_revoke_access", { p_user: parsed.data.user_id, p_note: parsed.data.note });
  if (error) return { error: error.message };
  revalidatePath(`/admin/students/${parsed.data.user_id}`);
  return { ok: data ? `Revoked ${data} active subscription${data === 1 ? "" : "s"}.` : "There was no active access to revoke." };
}

const roleSchema = z.object({ user_id: z.string().uuid(), role: z.enum(["student", "admin"]) });

export async function setRole(_: AccessState, formData: FormData): Promise<AccessState> {
  const { supabase } = await adminClient();
  const parsed = roleSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "Invalid role." };
  const { error } = await supabase.rpc("admin_set_role", { p_user: parsed.data.user_id, p_role: parsed.data.role });
  if (error) return { error: error.message };
  revalidatePath(`/admin/students/${parsed.data.user_id}`);
  return { ok: `Role set to ${parsed.data.role}.` };
}
