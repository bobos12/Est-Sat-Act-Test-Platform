import { ButtonLink } from "@/components/ui/button";
import { formatPrice, getActivePlans } from "@/lib/catalog";
import { periodLabel, planPitch } from "@/lib/marketing";
import { cn } from "@/lib/utils";

/** Lists active plans from the database. No placeholder prices are ever shown. */
export async function PlanList() {
  const plans = await getActivePlans();

  if (plans.length === 0) {
    return (
      <div className="rounded-[var(--radius-lg)] bg-white p-8 ring-1 ring-line sm:p-10">
        <p className="font-display text-2xl font-medium text-ink-950">Free exams are open now.</p>
        <p className="mt-3 max-w-xl text-ink-600">
          Create a free account to take every exam marked Free. Premium plans with the full mock exam library are
          coming soon.
        </p>
        <ButtonLink href="/sign-up" className="mt-6">
          Create free account
        </ButtonLink>
      </div>
    );
  }

  const monthly = plans.find((p) => p.interval_months === 1)?.price_cents;
  return (
    <>
      <div className="grid items-stretch gap-5 md:grid-cols-3">
        {plans.map((plan) => {
          const pitch = planPitch(plan, monthly);
          const dark = pitch.popular;
          return (
            <div
              key={plan.id}
              className={cn(
                "relative flex flex-col rounded-[var(--radius-lg)] p-7",
                dark ? "order-first mt-3 bg-ink-950 text-paper shadow-2xl ring-2 ring-mark-500 md:order-none md:-my-4 md:mt-0 md:py-11" : "bg-white ring-1 ring-line",
              )}
            >
              {dark ? (
                <span className="absolute -top-3.5 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-mark-500 px-4 py-1.5 text-xs font-bold uppercase tracking-wide text-white shadow-lg">
                  ★ Most popular
                </span>
              ) : null}
              <div className="flex items-center justify-between gap-3">
                <h3 className="font-display text-2xl">{plan.name}</h3>
                {pitch.compareAtCents ? (
                  <span className="rounded-full bg-gradient-to-br from-[#ff7a18] to-[#e8233a] px-3 py-1 text-sm font-extrabold text-white shadow-[0_8px_18px_-8px_rgba(232,35,58,.75)] motion-safe:animate-pulse">
                    🔥 −{pitch.save}%
                  </span>
                ) : pitch.save > 0 ? (
                  <span className="rounded-full bg-success-600 px-2.5 py-1 text-xs font-bold text-white">Save {pitch.save}%</span>
                ) : null}
              </div>
              <p className="mt-1 text-sm opacity-70">{pitch.hook}</p>
              {pitch.compareAtCents ? (
                <>
                  <span className={cn("mt-4 self-start rounded-full px-2.5 py-1 text-[0.6875rem] font-bold uppercase tracking-wide", dark ? "bg-[#e8233a]/20 text-[#ffb3bc]" : "bg-[#fdecee] text-[#e8233a]")}>
                    Limited-time offer
                  </span>
                  <p className="mt-3">
                    <span className={cn("relative inline-block text-xl font-semibold tabular", dark ? "text-ink-400" : "text-ink-400")}>
                      {formatPrice(pitch.compareAtCents, plan.currency)}
                      <span aria-hidden className="absolute -inset-x-1 top-1/2 h-[2.5px] -rotate-[8deg] rounded bg-[#e8233a]" />
                    </span>
                  </p>
                </>
              ) : null}
              <p className={cn("font-display text-5xl font-medium tabular", pitch.compareAtCents ? "mt-1" : "mt-5")}>
                {formatPrice(plan.price_cents, plan.currency)}
                <span className="ml-1 font-sans text-base font-normal opacity-60">/ {periodLabel(plan.interval_months)}</span>
              </p>
              {pitch.savedCents ? (
                <p className={cn("mt-1 text-sm font-bold", dark ? "text-[#7be0a4]" : "text-success-700")}>You save {formatPrice(pitch.savedCents, plan.currency)}</p>
              ) : null}
              <p className="mt-2 text-sm opacity-75">
                {plan.interval_months > 1 ? (
                  <>
                    Just <b>{formatPrice(pitch.perMonth, plan.currency)}</b> a month
                  </>
                ) : (
                  "Full access, billed monthly"
                )}
                {pitch.perDay ? ` · less than ${pitch.perDay} EGP a day` : ""}
              </p>
              <ButtonLink href={`/checkout/${plan.code}`} variant={dark ? "primary" : "accent"} className="mt-6 w-full">
                {pitch.cta} →
              </ButtonLink>
              {plan.features.length ? (
                <ul className="mt-6 space-y-2.5 border-t border-current/10 pt-6 text-[0.9375rem]">
                  {plan.features.map((f) => (
                    <li key={f} className="flex gap-2.5">
                      <span className={cn("mt-0.5 shrink-0 font-bold", dark ? "text-sky" : "text-mark-500")}>✓</span>
                      {f}
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          );
        })}
      </div>
      <p className="mt-10 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm text-ink-600">
        <span>🔒 Secure checkout by Paymob</span>
        <span>⚡ Instant access after payment</span>
        <span>✕ Cancel anytime</span>
      </p>
    </>
  );
}

export function PlanListSkeleton() {
  return <div className="h-64 animate-pulse rounded-[var(--radius-lg)] bg-paper-2" />;
}
