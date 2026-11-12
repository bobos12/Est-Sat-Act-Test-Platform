"use client";

import { useEffect, useMemo, useState } from "react";
import { RichContentView } from "@/components/exam/rich-content";
import type { RichContent } from "@/lib/content";
import { cn } from "@/lib/utils";

export type ReviewQuestion = {
  id: string;
  position: number;
  stem: RichContent;
  explanation: RichContent;
  topic: string | null;
  skill: string | null;
  selected_option_id: string | null;
  is_correct: boolean;
  options: { id: string; label: string; content: RichContent; is_correct: boolean }[];
  stimulus: { title: string | null; content: RichContent } | null;
};

type Status = "correct" | "incorrect" | "unanswered";
type Filter = "all" | Status;

const statusOf = (q: ReviewQuestion): Status =>
  q.selected_option_id == null ? "unanswered" : q.is_correct ? "correct" : "incorrect";

const tone: Record<Status, string> = {
  correct: "bg-success-50 text-success-700 ring-success-600/30",
  incorrect: "bg-danger-50 text-danger-600 ring-danger-600/30",
  unanswered: "bg-paper-2 text-ink-500 ring-line",
};

const statusText: Record<Status, string> = {
  correct: "Correct",
  incorrect: "Incorrect",
  unanswered: "Not answered",
};

export function QuestionReviewer({ questions }: { questions: ReviewQuestion[] }) {
  const counts = useMemo(() => {
    const c = { all: questions.length, correct: 0, incorrect: 0, unanswered: 0 };
    for (const q of questions) c[statusOf(q)]++;
    return c;
  }, [questions]);

  const [filter, setFilter] = useState<Filter>(counts.incorrect ? "incorrect" : "all");
  const visible = useMemo(
    () => (filter === "all" ? questions : questions.filter((q) => statusOf(q) === filter)),
    [questions, filter],
  );
  const [currentId, setCurrentId] = useState<string | undefined>(visible[0]?.id);
  const index = Math.max(0, visible.findIndex((q) => q.id === currentId));
  const q = visible[index];

  const go = (i: number) => {
    const next = visible[i];
    if (next) setCurrentId(next.id);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLElement && ["INPUT", "TEXTAREA"].includes(e.target.tagName)) return;
      if (e.key === "ArrowRight") go(index + 1);
      if (e.key === "ArrowLeft") go(index - 1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const pickFilter = (f: Filter) => {
    setFilter(f);
    const list = f === "all" ? questions : questions.filter((x) => statusOf(x) === f);
    setCurrentId(list.find((x) => x.id === currentId)?.id ?? list[0]?.id);
  };

  const tabs: { id: Filter; label: string }[] = [
    { id: "all", label: "All" },
    { id: "incorrect", label: "Incorrect" },
    { id: "unanswered", label: "Skipped" },
    { id: "correct", label: "Correct" },
  ];

  return (
    <div className="mt-6 grid gap-6 lg:grid-cols-[300px_1fr] lg:items-start">
      {/* Navigator */}
      <aside className="rounded-[var(--radius-lg)] bg-white p-5 ring-1 ring-line lg:sticky lg:top-24">
        <div className="grid grid-cols-2 gap-2">
          {tabs.map((t) => {
            const active = filter === t.id;
            const color = {
              all: active ? "bg-ink-950 text-paper ring-ink-950" : "text-ink-800 ring-line hover:ring-ink-400",
              incorrect: active ? "bg-danger-600 text-white ring-danger-600" : "bg-danger-50 text-danger-600 ring-danger-600/30 hover:ring-danger-600",
              unanswered: active ? "bg-ink-500 text-white ring-ink-500" : "bg-paper-2 text-ink-600 ring-line hover:ring-ink-400",
              correct: active ? "bg-success-600 text-white ring-success-600" : "bg-success-50 text-success-700 ring-success-600/30 hover:ring-success-600",
            }[t.id];
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => pickFilter(t.id)}
                disabled={counts[t.id] === 0}
                aria-pressed={active}
                className={cn(
                  "flex cursor-pointer items-center justify-between rounded-lg px-3 py-2.5 text-sm font-semibold ring-1 ring-inset transition hover:-translate-y-0.5 hover:shadow-sm disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:translate-y-0",
                  color,
                  active && "shadow-md",
                )}
              >
                <span className="flex items-center gap-1.5">
                  {active ? <span aria-hidden>✓</span> : null}
                  {t.label}
                </span>
                <span className={cn("rounded-full px-1.5 text-xs tabular", active ? "bg-white/20" : "bg-white/70")}>{counts[t.id]}</span>
              </button>
            );
          })}
        </div>

        <div className="mt-5 grid grid-cols-8 gap-1.5 lg:grid-cols-6">
          {questions.map((x) => {
            const s = statusOf(x);
            const inFilter = filter === "all" || s === filter;
            return (
              <button
                key={x.id}
                type="button"
                onClick={() => {
                  if (!inFilter) setFilter("all");
                  setCurrentId(x.id);
                }}
                aria-label={`Question ${x.position}, ${statusText[s]}`}
                aria-current={x.id === q?.id}
                className={cn(
                  "aspect-square cursor-pointer rounded-lg text-xs font-semibold tabular ring-1 ring-inset transition hover:-translate-y-0.5 hover:shadow-md",
                  tone[s],
                  !inFilter && "opacity-40 hover:opacity-100",
                  x.id === q?.id && "scale-110 ring-2 ring-ink-950 shadow-md",
                )}
              >
                {x.position}
              </button>
            );
          })}
        </div>

        <div className="mt-5 flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-500">
          <Legend className="bg-success-600" label="Correct" />
          <Legend className="bg-danger-600" label="Incorrect" />
          <Legend className="bg-ink-300" label="Skipped" />
        </div>
      </aside>

      {/* Question */}
      {q ? (
        <article className="rounded-[var(--radius-lg)] bg-white ring-1 ring-line">
          <header className="flex flex-wrap items-center gap-3 border-b border-line px-6 py-4 sm:px-8">
            <span className="font-display text-2xl tabular text-ink-950">Q{q.position}</span>
            <span className={cn("rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset", tone[statusOf(q)])}>
              {statusText[statusOf(q)]}
            </span>
            {q.skill || q.topic ? <span className="text-sm text-ink-500">{q.skill ?? q.topic}</span> : null}
            <span className="ml-auto text-xs tabular text-ink-400">
              {index + 1} of {visible.length}
            </span>
          </header>

          <div className="px-6 py-7 sm:px-8">
            {q.stimulus ? (
              <details key={q.id} className="group/p mb-6 overflow-hidden rounded-[var(--radius-md)] bg-mark-50 ring-1 ring-mark-100 open:bg-paper open:ring-line">
                <summary className="flex cursor-pointer list-none items-center gap-3 px-5 py-4 transition hover:bg-mark-100/60 [&::-webkit-details-marker]:hidden">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-mark-500 text-white">
                    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                      <path d="M2 4h7a3 3 0 0 1 3 3v13a2 2 0 0 0-2-2H2zM22 4h-7a3 3 0 0 0-3 3v13a2 2 0 0 1 2-2h8z" />
                    </svg>
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold text-ink-950">
                      <span className="group-open/p:hidden">Read the passage</span>
                      <span className="hidden group-open/p:inline">Hide the passage</span>
                    </span>
                    <span className="block truncate text-xs text-ink-500">
                      {q.stimulus.title ?? "This question is based on a passage or figure"}
                    </span>
                  </span>
                  <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-mark-500 ring-1 ring-mark-100 group-open/p:hidden">
                    Open
                  </span>
                  <span className="text-ink-400 transition-transform group-open/p:rotate-180">⌄</span>
                </summary>
                <RichContentView content={q.stimulus.content} className="border-t border-line px-5 py-5 font-reading leading-relaxed text-ink-800" />
              </details>
            ) : null}

            <RichContentView content={q.stem} className="font-reading text-lg leading-relaxed text-ink-950" />

            <ul className="mt-6 grid gap-2.5">
              {q.options.map((o) => {
                const chosen = o.id === q.selected_option_id;
                return (
                  <li
                    key={o.id}
                    className={cn(
                      "flex items-start gap-3 rounded-[var(--radius-md)] px-4 py-3.5 ring-1 ring-inset",
                      o.is_correct ? "bg-success-50 ring-success-600" : chosen ? "bg-danger-50 ring-danger-600" : "ring-line",
                    )}
                  >
                    <span
                      className={cn(
                        "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm font-semibold",
                        o.is_correct
                          ? "bg-success-600 text-white"
                          : chosen
                            ? "bg-danger-600 text-white"
                            : "bg-paper-2 text-ink-600",
                      )}
                    >
                      {o.label}
                    </span>
                    <RichContentView content={o.content} className="flex-1 pt-0.5 font-reading [&_p]:my-0" />
                    {o.is_correct ? (
                      <span className="shrink-0 pt-1 text-xs font-semibold text-success-700">
                        {chosen ? "Your answer ✓" : "Correct answer"}
                      </span>
                    ) : chosen ? (
                      <span className="shrink-0 pt-1 text-xs font-semibold text-danger-600">Your answer</span>
                    ) : null}
                  </li>
                );
              })}
            </ul>

            {q.explanation?.blocks?.length ? (
              <div className="mt-7 rounded-[var(--radius-md)] bg-mark-50 px-5 py-4">
                <h3 className="text-sm font-semibold text-mark-500">Explanation</h3>
                <RichContentView content={q.explanation} className="mt-2 leading-relaxed text-ink-800" />
              </div>
            ) : null}
          </div>

          <footer className="flex items-center justify-between gap-3 border-t border-line px-6 py-4 sm:px-8">
            <button
              type="button"
              onClick={() => go(index - 1)}
              disabled={index === 0}
              className="rounded-full px-4 py-2 text-sm font-medium text-ink-700 ring-1 ring-line transition hover:ring-ink-300 disabled:opacity-40"
            >
              ← Previous
            </button>
            <span className="hidden text-xs text-ink-400 sm:block">Use ← → keys</span>
            <button
              type="button"
              onClick={() => go(index + 1)}
              disabled={index >= visible.length - 1}
              className="rounded-full bg-ink-950 px-4 py-2 text-sm font-medium text-paper transition hover:bg-ink-800 disabled:opacity-40"
            >
              Next →
            </button>
          </footer>
        </article>
      ) : (
        <p className="rounded-[var(--radius-lg)] bg-white p-10 text-center text-sm text-ink-500 ring-1 ring-line">
          Nothing to show here.
        </p>
      )}
    </div>
  );
}

function Legend({ className, label }: { className: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className={cn("h-2 w-2 rounded-full", className)} />
      {label}
    </span>
  );
}
