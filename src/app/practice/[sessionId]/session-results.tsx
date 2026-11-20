import Link from "next/link";
import { QuestionReviewer, type ReviewQuestion } from "@/components/exam/question-reviewer";
import type { BankSessionPayload } from "@/lib/bank-types";
import { modeLabel } from "@/lib/bank-types";
import { cn } from "@/lib/utils";
import { quickSession } from "../actions";

const fmtTime = (ms: number) => {
  const s = Math.round(ms / 1000);
  return s >= 60 ? `${Math.floor(s / 60)}m ${s % 60}s` : `${s}s`;
};

export function SessionResults({ payload }: { payload: BankSessionPayload }) {
  const { session, questions, stimuli } = payload;
  const stimulusById = new Map(stimuli.map((s) => [s.id, s]));

  const total = questions.length;
  const answered = questions.filter((q) => q.answer).length;
  const correct = questions.filter((q) => q.answer?.is_correct).length;
  const incorrect = answered - correct;
  const skipped = total - answered;
  const score = total ? Math.round((100 * correct) / total) : 0;
  const timed = questions.filter((q) => q.answer?.time_ms);
  const avgMs = timed.length ? timed.reduce((t, q) => t + (q.answer?.time_ms ?? 0), 0) / timed.length : 0;

  const byCategory = new Map<string, { correct: number; total: number }>();
  for (const q of questions) {
    const k = q.category ?? "Other";
    const cur = byCategory.get(k) ?? { correct: 0, total: 0 };
    byCategory.set(k, { correct: cur.correct + (q.answer?.is_correct ? 1 : 0), total: cur.total + 1 });
  }
  const categories = [...byCategory.entries()]
    .map(([name, v]) => ({ name, ...v, pct: Math.round((100 * v.correct) / v.total) }))
    .sort((a, b) => a.pct - b.pct);

  const review: ReviewQuestion[] = questions.map((q, i) => {
    const keyId = q.answer?.correct_option_id ?? q.key?.correct_option_id ?? null;
    const st = q.stimulus_id ? stimulusById.get(q.stimulus_id) : undefined;
    return {
      id: q.id,
      position: i + 1,
      stem: q.stem,
      explanation: q.answer?.explanation ?? q.key?.explanation ?? { blocks: [] },
      topic: q.category,
      skill: null,
      selected_option_id: q.answer?.option_id ?? null,
      is_correct: Boolean(q.answer?.is_correct),
      options: q.options.map((o) => ({ ...o, is_correct: o.id === keyId })),
      stimulus: st ? { title: st.title, content: st.content } : null,
    };
  });

  const headline = score >= 85 ? "Outstanding session!" : score >= 70 ? "Great work!" : score >= 50 ? "Solid progress." : "Every miss is a lesson.";
  const R = 52;

  return (
    <div className="mx-auto max-w-5xl px-5 pb-24 pt-8 sm:px-6 sm:pt-12">
      <Link href={`/practice?subject=${session.subject.code}`} className="text-sm text-ink-500 hover:text-ink-950">
        ← Question bank
      </Link>

      <section className="dash-rise mt-4 overflow-hidden rounded-[28px] bg-white ring-1 ring-line">
        <div className="grid gap-8 p-6 sm:p-8 md:grid-cols-[auto_1fr] md:items-center">
          <div className="relative mx-auto h-40 w-40">
            <svg viewBox="0 0 120 120" className="h-full w-full -rotate-90" aria-hidden>
              <circle cx="60" cy="60" r={R} fill="none" strokeWidth="10" className="stroke-paper-3" />
              <circle
                cx="60"
                cy="60"
                r={R}
                fill="none"
                strokeWidth="10"
                strokeLinecap="round"
                className={cn("dash-draw", score >= 70 ? "stroke-success-600" : score >= 50 ? "stroke-mark-500" : "stroke-warning-500")}
                pathLength={1}
                style={{ strokeDasharray: `${score / 100} 1` } as React.CSSProperties}
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="font-display text-4xl tabular text-ink-950">{score}%</span>
              <span className="text-xs text-ink-500">
                {correct} of {total}
              </span>
            </div>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-mark-500">
              {session.subject.name} · {modeLabel[session.mode]}
            </p>
            <h1 className="mt-1 font-display text-3xl text-ink-950 sm:text-4xl">{headline}</h1>
            <dl className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Stat label="Correct" value={correct} tone="text-success-700" />
              <Stat label="Incorrect" value={incorrect} tone="text-danger-600" />
              <Stat label="Skipped" value={skipped} tone="text-ink-500" />
              <Stat label="Avg. time" value={avgMs ? fmtTime(avgMs) : "—"} />
            </dl>
            <div className="mt-6 flex flex-wrap gap-2">
              {incorrect > 0 ? (
                <form action={quickSession}>
                  <input type="hidden" name="subject" value={session.subject.id} />
                  <input type="hidden" name="mode" value="mistakes" />
                  <input type="hidden" name="tutor" value="tutor" />
                  <button className="inline-flex h-11 cursor-pointer items-center gap-2 rounded-xl bg-mark-500 px-5 text-sm font-semibold text-white transition hover:bg-mark-600">
                    Practise my mistakes →
                  </button>
                </form>
              ) : null}
              <Link
                href={`/practice?subject=${session.subject.code}`}
                className="inline-flex h-11 items-center rounded-xl px-5 text-sm font-semibold text-ink-800 ring-1 ring-inset ring-line transition hover:ring-ink-400"
              >
                New session
              </Link>
            </div>
          </div>
        </div>

        {categories.length > 1 ? (
          <div className="border-t border-line bg-paper/50 px-6 py-5 sm:px-8">
            <h2 className="text-sm font-semibold text-ink-950">By topic</h2>
            <ul className="mt-3 grid gap-x-8 gap-y-3 sm:grid-cols-2">
              {categories.map((c, i) => (
                <li key={c.name}>
                  <div className="flex items-baseline justify-between gap-3 text-sm">
                    <span className="truncate text-ink-800">{c.name}</span>
                    <span className="shrink-0 tabular text-ink-500">
                      <b className="font-semibold text-ink-950">{c.correct}</b>/{c.total}
                    </span>
                  </div>
                  <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-paper-3">
                    <div
                      className={cn("dash-grow h-full rounded-full", c.pct >= 75 ? "bg-success-600" : c.pct >= 50 ? "bg-mark-500" : "bg-warning-500")}
                      style={{ width: `${Math.max(c.pct, 3)}%`, "--d": `${0.3 + i * 0.06}s` } as React.CSSProperties}
                    />
                  </div>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </section>

      <h2 className="mt-10 font-display text-2xl text-ink-950">Review your answers</h2>
      <p className="text-sm text-ink-500">Every question with the correct answer and a full explanation.</p>
      <QuestionReviewer questions={review} />
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: number | string; tone?: string }) {
  return (
    <div className="rounded-xl bg-paper px-3.5 py-3">
      <dt className="text-[0.6875rem] font-semibold uppercase tracking-[0.1em] text-ink-500">{label}</dt>
      <dd className={cn("mt-0.5 font-display text-2xl tabular", tone ?? "text-ink-950")}>{value}</dd>
    </div>
  );
}
