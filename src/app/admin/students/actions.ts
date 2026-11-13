"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { redirect } from "next/navigation";
import { adminClient } from "@/lib/admin/server";
import { createServiceClient } from "@/lib/supabase/server";

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

/* ---------------- Edit, suspend and delete (need the service role key) ---------------- */

function serviceOrNull() {
  try {
    return createServiceClient();
  } catch {
    return null;
  }
}
const NO_SERVICE = "Add SUPABASE_SERVICE_ROLE_KEY to the server environment to change logins (email, suspend, delete).";

const editSchema = z.object({
  user_id: z.string().uuid(),
  full_name: z.string().trim().max(120),
  email: z.string().trim().toLowerCase().email("Enter a valid email."),
  phone: z.string().trim().max(30),
  school: z.string().trim().max(120),
  grade: z.string().trim().max(40),
});

export async function updateStudent(_: AccessState, formData: FormData): Promise<AccessState> {
  const { supabase } = await adminClient();
  const parsed = editSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { user_id, email, ...rest } = parsed.data;
  const { data: current } = await supabase.from("profiles").select("email").eq("id", user_id).single();
  if (current && current.email !== email) {
    const svc = serviceOrNull();
    if (!svc) return { error: NO_SERVICE };
    const { error } = await svc.auth.admin.updateUserById(user_id, { email, email_confirm: true });
    if (error) return { error: error.message.includes("already") ? "Another account already uses that email." : error.message };
  }
  const row = Object.fromEntries(Object.entries({ ...rest, email }).map(([k, v]) => [k, v === "" ? null : v]));
  const { error } = await supabase.from("profiles").update(row).eq("id", user_id);
  if (error) return { error: error.message };
  revalidatePath(`/admin/students/${user_id}`);
  revalidatePath("/admin/students");
  return { ok: "Details saved." };
}

export async function setSuspended(_: AccessState, formData: FormData): Promise<AccessState> {
  const { viewer } = await adminClient();
  const id = z.string().uuid().parse(formData.get("user_id"));
  const suspend = formData.get("suspend") === "true";
  if (id === viewer.id) return { error: "You can't suspend your own account." };
  const svc = serviceOrNull();
  if (!svc) return { error: NO_SERVICE };
  const { error } = await svc.auth.admin.updateUserById(id, { ban_duration: suspend ? "876000h" : "none" });
  if (error) return { error: error.message };
  revalidatePath(`/admin/students/${id}`);
  return { ok: suspend ? "Account suspended. They can't sign in until you restore it." : "Account restored. They can sign in again." };
}

export async function deleteStudent(_: AccessState, formData: FormData): Promise<AccessState> {
  const { supabase, viewer } = await adminClient();
  const id = z.string().uuid().parse(formData.get("user_id"));
  const typed = String(formData.get("confirm") ?? "").trim().toLowerCase();
  if (id === viewer.id) return { error: "You can't delete your own account." };
  const { data: p } = await supabase.from("profiles").select("email, role").eq("id", id).single();
  if (!p) return { error: "Student not found." };
  if (p.role === "admin") return { error: "Remove the admin role first, then delete." };
  if (typed !== p.email.toLowerCase()) return { error: "Type the student's email exactly to confirm." };
  const svc = serviceOrNull();
  if (!svc) return { error: NO_SERVICE };
  // Payments don't cascade (kept for accounting), so remove them first; everything else cascades from the login.
  await svc.from("payments").delete().eq("user_id", id);
  const { error } = await svc.auth.admin.deleteUser(id);
  if (error) return { error: error.message };
  revalidatePath("/admin/students");
  redirect(`/admin/students?deleted=${encodeURIComponent(p.email)}`);
}
