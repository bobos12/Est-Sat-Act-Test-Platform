import type { Metadata } from "next";
import { Suspense } from "react";
import { ButtonLink } from "@/components/ui/button";
import { requireViewer } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { Refresher } from "./refresher";

export const metadata: Metadata = { title: "Payment status", robots: { index: false } };

// The provider redirects here after checkout. Access is granted only by the verified
// webhook — this page just reads the payment's status from our database.
export default function ReturnPage({ searchParams }: PageProps<"/checkout/return">) {
  return (
    <div className="mx-auto max-w-lg px-5 pb-24 pt-16 text-center sm:px-6">
      <Suspense fallback={<p className="text-ink-500">Checking your payment…</p>}>
        <Status searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function Status({ searchParams }: { searchParams: PageProps<"/checkout/return">["searchParams"] }) {
  const sp = await searchParams;
  const ref = typeof sp.ref === "string" ? sp.ref.slice(0, 80) : "";
  const n = Math.min(50, Number(sp.n) || 0);
  await requireViewer(`/checkout/return?ref=${encodeURIComponent(ref)}`);
  const supabase = await createClient();
  const { data: payment } = ref
    ? await supabase.from("payments").select("status, failure_reason").eq("merchant_reference", ref).maybeSingle()
    : { data: null };

  if (payment?.status === "succeeded") {
    return (
      <>
        <h1 className="font-display text-4xl font-medium text-ink-950">You&apos;re all set</h1>
        <p className="mt-3 text-ink-600">Your payment is confirmed and Premium is active. Every exam in the library is now open to you.</p>
        <ButtonLink href="/exams" size="lg" className="mt-8">
          Go to the exam library
        </ButtonLink>
      </>
    );
  }
  if (payment?.status === "failed") {
    return (
      <>
        <h1 className="font-display text-4xl font-medium text-ink-950">Payment didn&apos;t go through</h1>
        <p className="mt-3 text-ink-600">{payment.failure_reason ? `${payment.failure_reason}. ` : ""}You haven&apos;t been charged for this attempt.</p>
        <ButtonLink href="/pricing" size="lg" className="mt-8">
          Try again
        </ButtonLink>
      </>
    );
  }
  if (!payment) {
    return (
      <>
        <h1 className="font-display text-4xl font-medium text-ink-950">Payment not found</h1>
        <p className="mt-3 text-ink-600">We couldn&apos;t find this payment on your account.</p>
        <ButtonLink href="/dashboard" size="lg" className="mt-8">
          My account
        </ButtonLink>
      </>
    );
  }
  const waiting = n < 20;
  return (
    <>
      {waiting ? <Refresher attempts={n} /> : null}
      <h1 className="font-display text-4xl font-medium text-ink-950">Confirming your payment…</h1>
      <p className="mt-3 text-ink-600">
        {waiting
          ? "This usually takes a few seconds. Please keep this page open."
          : "It's taking longer than usual. Your access will switch on automatically once the payment is confirmed — check My exams in a few minutes."}
      </p>
      {!waiting ? (
        <ButtonLink href="/dashboard" size="lg" className="mt-8">
          My account
        </ButtonLink>
      ) : null}
    </>
  );
}
