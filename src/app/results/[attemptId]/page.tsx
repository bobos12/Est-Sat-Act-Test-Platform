import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { QuestionReviewer, type ReviewQuestion } from "@/components/exam/question-reviewer";
import { ButtonLink } from "@/components/ui/button";
import { requireViewer } from "@/lib/auth/session";
import type { RichContent } from "@/lib/content";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Your results", robots: { index: false } };

type Review = {
  attempt: {
    id: string;
    status: "submitted" | "expired";
    started_at: string;
    submitted_at: string;
    score: number;
    max_score: number;
    percent: number;
    correct_count: number;
    answered_count: number;
    question_count: number;
    result_summary: { by_topic: { topic: string; correct: number; total: number }[] } | null;
  };
  exam: { id: string; title: string; slug: string };
  questions: {
    id: string;
    position: number;
    stem: RichContent;
    explanation: RichContent;
    stimulus_id: string | null;
    topic: string | null;
    skill: string | null;
    selected_option_id: string | null;
    is_correct: boolean;
    options: { id: string; label: string; content: RichContent; is_correct: boolean }[];
  }[];
  stimuli: { id: string; title: string | null; attribution: string | null; content: RichContent }[];
};

export default function ResultsPage({ params }: PageProps<"/results/[attemptId]">) {
  return (
    <div className="mx-auto max-w-5xl px-5 pb-24 pt-10 sm:px-6 sm:pt-14">
      <Suspense fallback={<div className="h-96 animate-pulse rounded-[var(--radius-lg)] bg-paper-2" />}>
        <Results params={params} />
      </Suspense>
    </div>
  );
}

function minutesBetween(a: string, b: string) {
  return Math.max(1, Math.round((Date.parse(b) - Date.parse(a)) / 60000));
}

async function Results({ params }: { params: PageProps<"/results/[attemptId]">["params"] }) {
  const { attemptId } = await params;
  await requireViewer(`/results/${attemptId}`);
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_attempt_review", { p_attempt: attemptId });
  if (error) {
    if (error.message.includes("ATTEMPT_OPEN")) redirect(`/exam/${attemptId}`);
    if (error.message.includes("ATTEMPT_NOT_FOUND") || error.code === "22P02") notFound();
    throw new Error("We couldn't load your results. Please refresh.");
  }
  const review = data as Review;
  const a = review.attempt;
  const percent = Math.round(Number(a.percent));
  // EST-style estimate: everyone starts at 400, correct answers add up to 800.
  const scaled = Math.round((400 + (400 * Math.min(100, Math.max(0, Number(a.percent)))) / 100) / 10) * 10;
  const scalePct = ((scaled - 400) / 400) * 100;
  const topics = [...(a.result_summary?.by_topic ?? [])].sort((x, y) => x.correct / (x.total || 1) - y.correct / (y.total || 1));
  const weakest = topics[0];
  const incorrect = a.answered_count - a.correct_count;
  const skipped = a.question_count - a.answered_count;
  const stimuli = new Map(review.stimuli.map((s) => [s.id, s]));
  const questions: ReviewQuestion[] = review.questions.map((q) => {
    const st = q.stimulus_id ? stimuli.get(q.stimulus_id) : undefined;
    return { ...q, stimulus: st ? { title: st.title, content: st.content } : null };
  });
  const band =
    scaled >= 750 ? "Outstanding work!" : scaled >= 650 ? "Great job!" : scaled >= 550 ? "Solid progress!" : "Good start, keep going!";
  const nextGoal = Math.min(800, Math.floor(scaled / 100) * 100 + 100);

  return (
    <>
      <Link href="/dashboard" className="text-sm text-ink-500 hover:text-ink-950">
        ← My exams
      </Link>

      <section className="mt-6 overflow-hidden rounded-[var(--radius-xl)] bg-ink-950 text-paper">
        <div className="grid gap-10 p-8 sm:p-10 md:grid-cols-[1.1fr_1fr] md:items-center">
          <div className="text-center">
            <p className="text-sm text-ink-300">{review.exam.title}</p>
            <ScoreGauge score={scaled} pct={scalePct} />
            <p className="mt-5 text-lg font-semibold">{band}</p>
            <p className="mt-1 text-sm text-ink-300">
              {scaled >= 800 ? (
                "A perfect score. Amazing!"
              ) : (
                <>
                  <span className="font-semibold text-paper">+{nextGoal - scaled}</span> points to reach {nextGoal}
                  <span className="text-ink-500"> · {percent}% correct</span>
                </>
              )}
            </p>
            {a.status === "expired" ? (
              <p className="mt-3 text-sm text-warning-500">Submitted automatically when time ran out</p>
            ) : null}
          </div>
          <dl className="grid grid-cols-2 gap-x-6 gap-y-6 border-t border-white/10 pt-8 md:border-l md:border-t-0 md:pl-10 md:pt-0">
            <Stat label="Correct" value={a.correct_count} dot="bg-success-600" />
            <Stat label="Incorrect" value={incorrect} dot="bg-danger-600" />
            <Stat label="Skipped" value={skipped} dot="bg-ink-500" />
            <Stat label="Time used" value={`${minutesBetween(a.started_at, a.submitted_at)} min`} />
          </dl>
        </div>
      </section>

      <div className="mt-6 flex flex-wrap gap-3">
        <ButtonLink href="#review">Review my answers</ButtonLink>
        <ButtonLink href={`/exams/${review.exam.slug}`} variant="secondary">
          Retake this exam
        </ButtonLink>
      </div>

      {topics.length ? (
        <section className="mt-12 grid gap-6 md:grid-cols-[1fr_1.4fr]">
          {weakest ? (
            <div className="rounded-[var(--radius-lg)] bg-mark-50 p-6">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-mark-500">Focus next</p>
              <p className="mt-3 font-display text-2xl leading-tight text-ink-950">{weakest.topic}</p>
              <p className="mt-2 text-sm leading-relaxed text-ink-700">
                You got {weakest.correct} of {weakest.total} here. This is where practice will move your score most.
              </p>
            </div>
          ) : null}
          <div className="rounded-[var(--radius-lg)] bg-white p-6 ring-1 ring-line">
            <h2 className="text-base font-semibold text-ink-950">Performance by topic</h2>
            <ul className="mt-5 space-y-4">
              {topics.map((t) => {
                const pct = t.total ? Math.round((100 * t.correct) / t.total) : 0;
                return (
                  <li key={t.topic}>
                    <div className="flex items-baseline justify-between gap-3 text-sm">
                      <span className="font-medium text-ink-900">{t.topic}</span>
                      <span className="shrink-0 tabular text-ink-500">
                        {t.correct}/{t.total} · <span className="font-semibold text-ink-900">{pct}%</span>
                      </span>
                    </div>
                    <div className="mt-2 h-2 overflow-hidden rounded-full bg-paper-3">
                      <div
                        className={cn("h-full rounded-full", pct >= 70 ? "bg-success-600" : pct >= 50 ? "bg-warning-500" : "bg-danger-600")}
                        style={{ width: `${Math.max(pct, 2)}%` }}
                      />
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        </section>
      ) : null}

      <section id="review" className="mt-14 scroll-mt-24">
        <h2 className="text-lg font-semibold text-ink-950">Question review</h2>
        <p className="mt-1 text-sm text-ink-500">Pick a question on the left, or step through with Next.</p>
        <QuestionReviewer questions={questions} />
      </section>
    </>
  );
}

function ScoreGauge({ score, pct }: { score: number; pct: number }) {
  const C = 120;
  const R = 96;
  const f = Math.min(1, Math.max(0, pct / 100));
  const arc = Math.PI * R;
  const t = Math.PI * (1 - f);
  const knob = [C + R * Math.cos(t), C - R * Math.sin(t)];
  const d = `M ${C - R} ${C} A ${R} ${R} 0 0 1 ${C + R} ${C}`;
  return (
    <div className="relative mx-auto mt-5 w-full max-w-[320px]">
      <svg viewBox="0 0 240 132" className="w-full overflow-visible" role="img" aria-label={`Score ${score} out of 800`}>
        <defs>
          <linearGradient id="score-fill" x1="0" x2="1">
            <stop offset="0%" stopColor="#7aa7ff" />
            <stop offset="100%" stopColor="#1559ed" />
          </linearGradient>
        </defs>
        <style>{`@keyframes sweep{from{stroke-dasharray:0 999}}@keyframes pop{0%,70%{opacity:0;transform:scale(.4)}100%{opacity:1;transform:scale(1)}}`}</style>
        <path d={d} fill="none" stroke="rgba(255,255,255,.08)" strokeWidth="18" strokeLinecap="round" />
        <path
          d={d}
          fill="none"
          stroke="url(#score-fill)"
          strokeWidth="18"
          strokeLinecap="round"
          strokeDasharray={`${f * arc} 999`}
          style={{ animation: "sweep 1.1s cubic-bezier(.2,.8,.2,1)" }}
        />
        <circle
          cx={knob[0]}
          cy={knob[1]}
          r="7"
          fill="#fff"
          stroke="#1559ed"
          strokeWidth="3"
          style={{ transformOrigin: `${knob[0]}px ${knob[1]}px`, transformBox: "view-box", animation: "pop 1.2s ease-out" }}
        />
      </svg>
      <div className="absolute inset-x-0 bottom-0 flex flex-col items-center">
        <span className="font-display text-6xl leading-none tabular">{score}</span>
        <span className="mt-1 text-xs uppercase tracking-[0.14em] text-ink-400">out of 800</span>
      </div>
      <div className="mt-2 flex justify-between px-1 text-xs tabular text-ink-500">
        <span>400</span>
        <span>800</span>
      </div>
    </div>
  );
}

function Stat({ label, value, dot }: { label: string; value: string | number; dot?: string }) {
  return (
    <div>
      <dt className="flex items-center gap-1.5 text-xs uppercase tracking-[0.12em] text-ink-400">
        {dot ? <span className={cn("h-1.5 w-1.5 rounded-full", dot)} /> : null}
        {label}
      </dt>
      <dd className="mt-1.5 text-2xl font-semibold tabular">{value}</dd>
    </div>
  );
}
