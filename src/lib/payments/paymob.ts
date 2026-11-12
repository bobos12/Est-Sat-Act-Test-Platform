import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { InvalidSignatureError, type CheckoutRequest, type PaymentProvider, type WebhookOutcome } from "./types";

/**
 * Paymob (Egypt) — Intention API + Unified Checkout.
 * Env: PAYMOB_SECRET_KEY, PAYMOB_PUBLIC_KEY, PAYMOB_HMAC_SECRET, PAYMOB_INTEGRATION_IDS (comma-separated),
 *      PAYMOB_BASE_URL (default https://accept.paymob.com)
 * Dashboard: no callback URL needs configuring — the notification URL is sent with each intention.
 */

const HMAC_FIELDS = [
  "amount_cents",
  "created_at",
  "currency",
  "error_occured",
  "has_parent_transaction",
  "id",
  "integration_id",
  "is_3d_secure",
  "is_auth",
  "is_capture",
  "is_refunded",
  "is_standalone_payment",
  "is_voided",
  "order.id",
  "owner",
  "pending",
  "source_data.pan",
  "source_data.sub_type",
  "source_data.type",
  "success",
] as const;

type Obj = Record<string, unknown>;

function dig(obj: Obj, path: string): unknown {
  return path.split(".").reduce<unknown>((o, k) => (o && typeof o === "object" ? (o as Obj)[k] : undefined), obj);
}

function hmacString(obj: Obj) {
  return HMAC_FIELDS.map((f) => {
    const v = dig(obj, f);
    return v === null || v === undefined ? "" : String(v);
  }).join("");
}

export function computePaymobHmac(obj: Obj, secret: string) {
  return createHmac("sha512", secret).update(hmacString(obj)).digest("hex");
}

function safeEqualHex(a: string, b: string) {
  const ab = Buffer.from(a.toLowerCase(), "utf8");
  const bb = Buffer.from(b.toLowerCase(), "utf8");
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

function env(name: string) {
  const v = process.env[name];
  if (!v) throw new Error(`Paymob is not configured: missing ${name}`);
  return v;
}

const baseUrl = () => (process.env.PAYMOB_BASE_URL || "https://accept.paymob.com").replace(/\/$/, "");

export const paymob: PaymentProvider = {
  id: "paymob",
  label: "Card or mobile wallet (Paymob)",

  isConfigured() {
    return Boolean(
      process.env.PAYMOB_SECRET_KEY && process.env.PAYMOB_PUBLIC_KEY && process.env.PAYMOB_HMAC_SECRET && process.env.PAYMOB_INTEGRATION_IDS,
    );
  },

  async createCheckout(req: CheckoutRequest) {
    const integrationIds = env("PAYMOB_INTEGRATION_IDS")
      .split(",")
      .map((s) => Number(s.trim()))
      .filter((n) => Number.isFinite(n) && n > 0);

    const res = await fetch(`${baseUrl()}/v1/intention/`, {
      method: "POST",
      headers: { Authorization: `Token ${env("PAYMOB_SECRET_KEY")}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        amount: req.amountCents,
        currency: req.currency,
        payment_methods: integrationIds,
        items: [{ name: req.description.slice(0, 50), amount: req.amountCents, description: req.description, quantity: 1 }],
        billing_data: {
          first_name: req.customer.firstName || "Student",
          last_name: req.customer.lastName || "16hundred",
          email: req.customer.email,
          phone_number: req.customer.phone,
          // Paymob requires these keys; "NA" is its documented placeholder for unknown address fields.
          apartment: "NA",
          floor: "NA",
          street: "NA",
          building: "NA",
          city: "NA",
          state: "NA",
          country: "EG",
        },
        special_reference: req.merchantReference,
        notification_url: req.notificationUrl,
        redirection_url: req.redirectionUrl,
      }),
      cache: "no-store",
    });
    const body = (await res.json().catch(() => ({}))) as { client_secret?: string; id?: string; detail?: string };
    if (!res.ok || !body.client_secret) {
      throw new Error(`Paymob intention failed (${res.status}): ${body.detail ?? JSON.stringify(body).slice(0, 300)}`);
    }
    const url = new URL(`${baseUrl()}/unifiedcheckout/`);
    url.searchParams.set("publicKey", env("PAYMOB_PUBLIC_KEY"));
    url.searchParams.set("clientSecret", body.client_secret);
    return { redirectUrl: url.toString(), providerReference: body.id };
  },

  async parseWebhook(request: Request): Promise<WebhookOutcome> {
    const received = new URL(request.url).searchParams.get("hmac") ?? "";
    const payload = (await request.json().catch(() => null)) as { type?: string; obj?: Obj } | null;
    if (!payload?.obj) return { kind: "ignored", reason: "No transaction object", raw: payload };

    const expected = computePaymobHmac(payload.obj, env("PAYMOB_HMAC_SECRET"));
    if (!received || !safeEqualHex(expected, received)) throw new InvalidSignatureError(payload);

    if (payload.type && payload.type !== "TRANSACTION") {
      return { kind: "ignored", reason: `Unhandled type ${payload.type}`, raw: payload };
    }

    const o = payload.obj;
    const order = (o.order ?? {}) as Obj;
    const merchantReference = String(order.merchant_order_id ?? dig(o, "payment_key_claims.extra.merchant_order_id") ?? "");
    const transactionId = String(o.id);
    const refunded = o.is_refunded === true || o.is_voided === true;
    const status: "succeeded" | "failed" | "pending" | "refunded" = refunded
      ? "refunded"
      : o.pending === true
        ? "pending"
        : o.success === true
          ? "succeeded"
          : "failed";

    const dataMessage = dig(o, "data.message");
    return {
      kind: "transaction",
      eventId: `${transactionId}:${status}`,
      merchantReference,
      transactionId,
      status,
      amountCents: Number(o.amount_cents),
      currency: String(o.currency ?? ""),
      failureReason: status === "failed" ? String(dataMessage ?? "Declined") : undefined,
      raw: payload,
    };
  },
};
