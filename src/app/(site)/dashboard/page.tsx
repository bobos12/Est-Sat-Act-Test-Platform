import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { requireViewer } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "My exams", robots: { index: false } };

export default function DashboardPage() {
  return (
    <div className="mx-auto max-w-5xl px-5 pb-24 pt-10 sm:px-6 sm:pt-14">
      <Suspense fallback={<div className="h-80 animate-pulse rounded-[var(--radius-lg)] bg-paper-2" />}>
        <Dashboard />
      </Suspense>
    </div>
  );
}

const dateFmt = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "Africa/Cairo" });

async function Dashboard() {
  const viewer = await requireViewer("/dashboard");
  const supabase = await createClient();
  const [{ data: attempts }, { data: subs }] = await Promise.all([
    supabase
      .from("exam_attempts")
      .select("id, status, started_at, submitted_at, percent, correct_count, question_count, exams(title, slug)")
      .order("started_at", { ascending: false })
      .limit(50),
    supabase
      .from("subscriptions")
      .select("id, status, current_period_end")
      .eq("status", "active")
      .order("current_period_end", { ascending: false })
      .limit(1),
  ]);

  const activeSub = subs?.[0];
  const firstName = viewer.fullName.split(" ")[0] || "there";

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-6">
        <div>
          <h1 className="font-display text-4xl font-medium text-ink-950">Hello, {firstName}</h1>
          <p className="mt-2 text-ink-600">
            {viewer.hasPremium && activeSub?.current_period_end
              ? `Premium access until ${dateFmt.format(new Date(activeSub.current_period_end))}.`
              : "You're on the free plan."}{" "}
            {!viewer.hasPremium ? (
              <Link href="/pricing" className="font-medium text-ink-950 underline underline-offset-4">
                See Premium
              </Link>
            ) : null}
          </p>
        </div>
        <ButtonLink href="/exams">Browse exams</ButtonLink>
      </div>

      <section className="mt-12">
        <h2 className="text-lg font-semibold text-ink-950">Your attempts</h2>
        {attempts?.length ? (
          <ul className="mt-4 divide-y divide-line overflow-hidden rounded-[var(--radius-lg)] bg-white ring-1 ring-line">
            {attempts.map((a) => {
              const exam = Array.isArray(a.exams) ? a.exams[0] : a.exams;
              const open = a.status === "in_progress";
              return (
                <li key={a.id}>
                  <Link
                    href={open ? `/exam/${a.id}` : `/results/${a.id}`}
                    className="flex items-center gap-4 px-5 py-4 hover:bg-paper sm:px-6"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium text-ink-950">{exam?.title ?? "Exam"}</p>
                      <p className="mt-0.5 text-sm text-ink-500">{dateFmt.format(new Date(a.started_at))}</p>
                    </div>
                    {open ? (
                      <Badge tone="warning">In progress · Resume</Badge>
                    ) : (
                      <span className="text-right">
                        <span className="block font-display text-2xl font-medium tabular text-ink-950">{Math.round(Number(a.percent))}%</span>
                        <span className="text-xs text-ink-500 tabular">
                          {a.correct_count}/{a.question_count} correct
                        </span>
                      </span>
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        ) : (
          <div className="mt-4 rounded-[var(--radius-lg)] border border-dashed border-line-strong px-6 py-14 text-center">
            <p className="font-medium text-ink-950">No exams taken yet</p>
            <p className="mt-2 text-sm text-ink-600">Start with a free exam to see where you stand.</p>
            <ButtonLink href="/exams?access=free" className="mt-5">
              Start free exam
            </ButtonLink>
          </div>
        )}
      </section>
    </>
  );
}
