import "server-only";
import { randomBytes } from "node:crypto";
import { createServiceClient } from "@/lib/supabase/server";
import { publicEnv } from "@/lib/env";
import { checkoutProvider, getProvider } from "./index";
import { InvalidSignatureError } from "./types";

export class CheckoutUnavailableError extends Error {}

function merchantReference() {
  return `NM-${Date.now().toString(36).toUpperCase()}-${randomBytes(4).toString("hex").toUpperCase()}`;
}

/** Creates a pending payment and returns the provider's checkout URL. */
export async function startCheckout(input: {
  userId: string;
  email: string;
  fullName: string;
  phone: string;
  planCode: string;
}) {
  const provider = checkoutProvider();
  if (!provider) throw new CheckoutUnavailableError("Online payment is not available yet.");

  const db = createServiceClient();
  const { data: plan } = await db
    .from("plans")
    .select("id, name, price_cents, currency, interval_months, is_active")
    .eq("code", input.planCode)
    .maybeSingle();
  if (!plan || !plan.is_active) throw new CheckoutUnavailableError("This plan is not available.");

  const reference = merchantReference();
  const { data: payment, error } = await db
    .from("payments")
    .insert({
      user_id: input.userId,
      plan_id: plan.id,
      provider: provider.id,
      merchant_reference: reference,
      amount_cents: plan.price_cents, // always the server-side price, never a client value
      currency: plan.currency,
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);

  const site = publicEnv().NEXT_PUBLIC_SITE_URL;
  const [firstName, ...rest] = input.fullName.trim().split(/\s+/);
  try {
    const session = await provider.createCheckout({
      merchantReference: reference,
      amountCents: plan.price_cents,
      currency: plan.currency,
      description: `16hundred ${plan.name}`,
      customer: { email: input.email, firstName: firstName ?? "", lastName: rest.join(" "), phone: input.phone },
      notificationUrl: `${site}/api/webhooks/${provider.id}`,
      redirectionUrl: `${site}/checkout/return?ref=${encodeURIComponent(reference)}`,
    });
    if (session.providerReference) {
      await db.from("payments").update({ provider_payload: { intention_id: session.providerReference } }).eq("id", payment.id);
    }
    return session.redirectUrl;
  } catch (e) {
    await db.rpc("apply_payment_failure", {
      p_payment: payment.id,
      p_provider_transaction_id: null,
      p_reason: e instanceof Error ? e.message.slice(0, 500) : "Checkout could not be created",
      p_payload: {},
    });
    throw e;
  }
}

/**
 * Verified, idempotent webhook processing. Returns an HTTP status for the provider.
 * Every delivery is logged in payment_events; the same event is never applied twice.
 */
export async function handleWebhook(providerId: string, request: Request): Promise<number> {
  const provider = getProvider(providerId);
  if (!provider || !provider.isConfigured()) return 404;
  const db = createServiceClient();

  let outcome;
  try {
    outcome = await provider.parseWebhook(request);
  } catch (e) {
    if (e instanceof InvalidSignatureError) {
      await db.from("payment_events").insert({
        provider: providerId,
        event_id: `invalid:${randomBytes(8).toString("hex")}`,
        signature_valid: false,
        payload: (e.raw ?? {}) as object,
        error: "Signature mismatch",
      });
      return 401;
    }
    throw e;
  }

  if (outcome.kind === "ignored") return 200;

  const { data: event, error: evErr } = await db
    .from("payment_events")
    .insert({ provider: providerId, event_id: outcome.eventId, event_type: outcome.status, signature_valid: true, payload: outcome.raw as object })
    .select("id")
    .single();
  if (evErr) {
    if (evErr.code === "23505") return 200; // duplicate delivery — already handled
    throw new Error(evErr.message);
  }

  const finish = (patch: { payment_id?: string; error?: string }) =>
    db.from("payment_events").update({ ...patch, processed_at: new Date().toISOString() }).eq("id", event.id);

  const { data: payment } = await db
    .from("payments")
    .select("id, provider")
    .eq("merchant_reference", outcome.merchantReference)
    .eq("provider", providerId)
    .maybeSingle();
  if (!payment) {
    await finish({ error: `Unknown merchant reference ${outcome.merchantReference}` });
    return 200; // acknowledge so the provider stops retrying; visible to admins
  }

  if (outcome.status === "succeeded") {
    const { error } = await db.rpc("apply_payment_success", {
      p_payment: payment.id,
      p_provider_transaction_id: outcome.transactionId,
      p_amount_cents: outcome.amountCents,
      p_currency: outcome.currency,
      p_payload: outcome.raw as object,
    });
    await finish({ payment_id: payment.id, error: error?.message });
    if (error) return 500; // let the provider retry
  } else if (outcome.status === "failed") {
    await db.rpc("apply_payment_failure", {
      p_payment: payment.id,
      p_provider_transaction_id: outcome.transactionId,
      p_reason: outcome.failureReason ?? "Declined",
      p_payload: outcome.raw as object,
    });
    await finish({ payment_id: payment.id });
  } else if (outcome.status === "refunded") {
    await db.from("payments").update({ status: "refunded", provider_payload: outcome.raw as object }).eq("id", payment.id);
    await finish({ payment_id: payment.id, error: "Refunded — review the student's access in the admin dashboard" });
  } else {
    await finish({ payment_id: payment.id });
  }
  return 200;
}
