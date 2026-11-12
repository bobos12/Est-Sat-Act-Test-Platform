import type { Metadata } from "next";
import { Suspense } from "react";
import { PlanList, PlanListSkeleton } from "@/components/site/plans";

export const metadata: Metadata = {
  title: "Pricing",
  description: "Simple, honest pricing: full access to every EST, SAT and ACT exam. Cancel anytime.",
};

const included = [
  "Every published EST, SAT and ACT mock exam",
  "Topic and skill practice sets at every difficulty",
  "Instant scoring with a breakdown by topic",
  "Worked explanations for every question",
  "Full history of your attempts and results",
];

export default function PricingPage() {
  return (
    <div className="mx-auto max-w-6xl px-5 pb-24 pt-12 sm:px-6 sm:pt-16">
      <header className="max-w-2xl">
        <h1 className="font-display text-4xl font-medium text-ink-950 sm:text-5xl">Simple, honest pricing</h1>
        <p className="mt-4 text-lg text-ink-600">
          One membership, full access to every track, question and test. Free exams stay open with an account, and
          access starts as soon as your payment is confirmed. Cancel anytime.
        </p>
      </header>
      <div className="mt-12">
        <Suspense fallback={<PlanListSkeleton />}>
          <PlanList />
        </Suspense>
      </div>
      <section className="mt-16 max-w-2xl">
        <h2 className="text-lg font-semibold text-ink-950">What Premium includes</h2>
        <ul className="mt-4 space-y-3">
          {included.map((i) => (
            <li key={i} className="flex gap-3 text-ink-700">
              <span className="mt-[0.6em] h-1.5 w-1.5 shrink-0 rounded-full bg-mark-500" />
              {i}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
