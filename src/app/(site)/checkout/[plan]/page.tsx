import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { requireViewer } from "@/lib/auth/session";
import { getActivePlans } from "@/lib/catalog";
import { PLAN_EXTRAS } from "@/lib/marketing";
import { createClient } from "@/lib/supabase/server";
import { ManualCheckout, PendingCard } from "../checkout-form";

export const metadata: Metadata = { title: "Checkout", robots: { index: false } };

export default function CheckoutPage({ params }: PageProps<"/checkout/[plan]">) {
  return (
    <div className="mx-auto max-w-6xl px-5 pb-24 pt-10 sm:px-6 sm:pt-12">
      <Link href="/pricing" className="text-sm text-ink-500 hover:text-ink-950">
        ← All plans
      </Link>
      <Suspense fallback={<div className="mt-8 h-96 animate-pulse rounded-[var(--radius-lg)] bg-paper-2" />}>
        <Checkout params={params} />
      </Suspense>
    </div>
  );
}

const egp = (cents: number) => `${Math.round(cents / 100).toLocaleString("en-US")} EGP`;

async function Checkout({ params }: { params: PageProps<"/checkout/[plan]">["params"] }) {
  const { plan: code } = await params;
  const viewer = await requireViewer(`/checkout/${code}`);
  const plan = (await getActivePlans()).find((p) => p.code === code);
  if (!plan) notFound();

  const supabase = await createClient();
  const { data: pending } = await supabase
    .from("payments")
    .select("merchant_reference, amount_cents, plans(name)")
    .eq("user_id", viewer.id)
    .eq("status", "pending")
    .in("provider", ["instapay", "vodafone_cash"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return (
    <div className="mt-6">
      <header className="mb-8 max-w-2xl">
        <h1 className="font-display text-4xl font-medium text-ink-950 sm:text-5xl">Complete your subscription</h1>
        <p className="mt-3 text-ink-600">Three quick steps: pick a method, send the amount, upload the screenshot.</p>
      </header>
      {pending ? (
        <PendingCard
          reference={pending.merchant_reference}
          amount={egp(pending.amount_cents)}
          planName={(Array.isArray(pending.plans) ? pending.plans[0]?.name : (pending.plans as { name: string } | null)?.name) ?? plan.name}
        />
      ) : (
        <ManualCheckout
          userId={viewer.id}
          extendsAccess={viewer.hasPremium}
          plan={{
            code: plan.code,
            name: plan.name,
            months: plan.interval_months,
            priceCents: plan.price_cents,
            compareAtCents: PLAN_EXTRAS[plan.code]?.compareAtCents,
            currency: plan.currency,
            features: plan.features,
          }}
        />
      )}
      <p className="mt-6 text-center text-xs text-ink-500">Signed in as {viewer.email}</p>
    </div>
  );
}
