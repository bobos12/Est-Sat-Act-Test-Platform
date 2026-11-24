"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { adminClient } from "@/lib/admin/server";
import { createServiceClient } from "@/lib/supabase/server";

/** Only same-site admin paths are accepted as the place to come back to. */
function backTo(formData: FormData, fallback: string) {
  const b = String(formData.get("back") ?? "");
  return b.startsWith("/admin") && !b.startsWith("//") ? b : fallback;
}
function withFlash(path: string, key: "ok" | "error", msg: string) {
  const url = new URL(path, "http://x");
  url.searchParams.delete("ok");
  url.searchParams.delete("error");
  url.searchParams.set(key, msg);
  return url.pathname + url.search;
}

/** Approve (access starts now) or reject a manual InstaPay / Vodafone Cash payment. */
export async function reviewPayment(formData: FormData) {
  const { supabase } = await adminClient();
  const id = z.string().uuid().parse(formData.get("id"));
  const approve = formData.get("decision") === "approve";
  const reason = String(formData.get("reason") ?? "").slice(0, 200);
  const back = backTo(formData, "/admin/payments");
  const { error } = await supabase.rpc("admin_review_payment", { p_payment: id, p_approve: approve, p_reason: reason || null });
  revalidatePath("/admin", "layout");
  if (error) redirect(withFlash(back, "error", error.message));
  redirect(withFlash(back, "ok", approve ? "Payment approved. Premium access is active now." : "Payment rejected. The student sees it as failed."));
}

/**
 * Mark a successful payment as refunded and end the access it bought.
 * Payments are written only by the server, so this uses the service key and records the admin in the audit log.
 */
export async function refundPayment(formData: FormData) {
  const { viewer } = await adminClient();
  const id = z.string().uuid().parse(formData.get("id"));
  const note = String(formData.get("note") ?? "").trim().slice(0, 300);
  const back = backTo(formData, "/admin/payments?view=all");
  if (note.length < 3) redirect(withFlash(back, "error", "Add a short reason for the refund."));

  let svc;
  try {
    svc = createServiceClient();
  } catch {
    redirect(withFlash(back, "error", "Refunds need SUPABASE_SERVICE_ROLE_KEY in the server environment."));
  }
  const { data: pay } = await svc.from("payments").select("id, user_id, status, subscription_id, amount_cents, currency").eq("id", id).single();
  if (!pay) redirect(withFlash(back, "error", "Payment not found."));
  if (pay.status !== "succeeded") redirect(withFlash(back, "error", "Only paid payments can be refunded."));

  const { error } = await svc.from("payments").update({ status: "refunded", failure_reason: `Refunded: ${note}` }).eq("id", id);
  if (error) redirect(withFlash(back, "error", error.message));
  if (pay.subscription_id) {
    await svc
      .from("subscriptions")
      .update({ status: "canceled", canceled_at: new Date().toISOString(), note: `Refunded: ${note}` })
      .eq("id", pay.subscription_id)
      .eq("status", "active");
  }
  await svc.from("admin_audit_log").insert({
    actor_id: viewer.id,
    action: "payment.refund",
    target_type: "profile",
    target_id: pay.user_id,
    details: { payment_id: id, amount_cents: pay.amount_cents, currency: pay.currency, note },
  });
  revalidatePath("/admin", "layout");
  redirect(withFlash(back, "ok", "Payment marked as refunded and its premium access ended."));
}
