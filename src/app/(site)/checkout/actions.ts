"use server";

import { z } from "zod";
import { getViewer } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

export type Quote = { subtotal_cents: number; discount_cents: number; total_cents: number; currency: string; code: string | null };

const CODE_ERRORS: Record<string, string> = {
  CODE_INVALID: "That code isn't valid.",
  CODE_EXPIRED: "That code has expired.",
  CODE_USED_UP: "That code has reached its usage limit.",
  PLAN_NOT_FOUND: "This plan is no longer available.",
};

/** Price for a plan, optionally with a discount code. The server is the only place the total is computed. */
export async function quotePlan(plan: string, code: string): Promise<{ quote?: Quote; error?: string }> {
  const viewer = await getViewer();
  if (!viewer) return { error: "Please sign in again." };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("quote_plan", { p_plan_code: plan, p_code: code.trim() || null });
  if (error) return { error: "Couldn't check that code. Please try again." };
  const res = data as Quote & { error?: string };
  if (res.error) return { error: CODE_ERRORS[res.error] ?? "That code isn't valid." };
  return { quote: res };
}

const submitSchema = z.object({
  plan: z.string().min(1).max(60),
  method: z.enum(["instapay", "vodafone_cash"]),
  proofPath: z.string().min(10).max(300),
  sender: z.string().trim().max(80).optional(),
  code: z.string().trim().max(30).optional(),
});

const SUBMIT_ERRORS: Record<string, string> = {
  ALREADY_PENDING: "You already have a payment waiting for review. We'll confirm it soon.",
  BAD_PROOF: "Please upload the payment screenshot again.",
  ...CODE_ERRORS,
};

export async function submitManualPayment(input: z.input<typeof submitSchema>): Promise<{ reference?: string; error?: string }> {
  const viewer = await getViewer();
  if (!viewer) return { error: "Please sign in again." };
  const parsed = submitSchema.safeParse(input);
  if (!parsed.success) return { error: "Please choose a payment method and upload your screenshot." };
  const { plan, method, proofPath, sender, code } = parsed.data;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("submit_manual_payment", {
    p_plan_code: plan,
    p_method: method,
    p_proof_path: proofPath,
    p_sender: sender || null,
    p_code: code || null,
  });
  if (error) {
    const key = Object.keys(SUBMIT_ERRORS).find((k) => error.message.includes(k));
    if (!key) console.error("[manual payment]", error);
    return { error: key ? SUBMIT_ERRORS[key] : "We couldn't submit your payment. Please try again." };
  }
  const { data: pay } = await supabase.from("payments").select("merchant_reference").eq("id", data as string).single();
  return { reference: pay?.merchant_reference ?? "" };
}
