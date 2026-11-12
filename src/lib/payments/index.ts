import "server-only";
import { paymob } from "./paymob";
import type { PaymentProvider } from "./types";

const providers: Record<string, PaymentProvider> = { [paymob.id]: paymob };

export function getProvider(id: string): PaymentProvider | undefined {
  return providers[id];
}

/** The provider used for new checkouts (PAYMENT_PROVIDER, default paymob). */
export function checkoutProvider(): PaymentProvider | undefined {
  const p = getProvider(process.env.PAYMENT_PROVIDER || "paymob");
  return p?.isConfigured() ? p : undefined;
}
