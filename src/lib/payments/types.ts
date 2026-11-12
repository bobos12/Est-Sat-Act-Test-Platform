/**
 * Payment provider contract. Add a provider (Fawry, Kashier, Stripe…) by implementing
 * this interface and registering it in ./index.ts — nothing else in the app changes.
 *
 * Rule: a payment is only ever marked successful from a verified server-to-server
 * notification (webhook). Browser redirects are for showing status, never for granting access.
 */
export type CheckoutRequest = {
  merchantReference: string; // our unique order id (payments.merchant_reference)
  amountCents: number;
  currency: string;
  description: string;
  customer: { email: string; firstName: string; lastName: string; phone: string };
  notificationUrl: string; // webhook
  redirectionUrl: string; // where the student returns after paying
};

export type CheckoutSession = { redirectUrl: string; providerReference?: string };

export type WebhookOutcome =
  | { kind: "ignored"; reason: string; eventId?: string; raw: unknown }
  | {
      kind: "transaction";
      eventId: string; // unique per provider event → idempotency key
      merchantReference: string;
      transactionId: string;
      status: "succeeded" | "failed" | "pending" | "refunded";
      amountCents: number;
      currency: string;
      failureReason?: string;
      raw: unknown;
    };

export interface PaymentProvider {
  readonly id: string;
  readonly label: string;
  isConfigured(): boolean;
  createCheckout(req: CheckoutRequest): Promise<CheckoutSession>;
  /** Must verify the signature and throw `InvalidSignatureError` when it does not match. */
  parseWebhook(request: Request): Promise<WebhookOutcome>;
}

export class InvalidSignatureError extends Error {
  constructor(public raw: unknown) {
    super("Invalid webhook signature");
  }
}
