"use client";

import Link from "next/link";
import { useActionState, useMemo, useState } from "react";
import { useFormStatus } from "react-dom";
import type { BankCategory, BankMode, BankOverview, BankSubject } from "@/lib/bank-types";
import { modeLabel } from "@/lib/bank-types";
import { cn } from "@/lib/utils";
import { createPracticeSession, type CreateState } from "./actions";

const FAMILY_ORDER = ["EST I", "EST II", "SAT", "ACT"];
const COUNTS = [5, 10, 20, 30, 50];
const dateFmt = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", timeZone: "Africa/Cairo" });
const pct = (a: number, b: number) => (b ? Math.round((100 * a) / b) : 0);

export function BankHome({
  overview,
  initialSubject,
  initialTopic,
  flash,
}: {
  overview: BankOverview;
  initialSubject?: string;
  initialTopic?: string;
  flash?: string;
}) {
  const subjects = useMemo(
    () => [...overview.subjects].sort((a, b) => FAMILY_ORDER.indexOf(a.family) - FAMILY_ORDER.indexOf(b.family)),
    [overview.subjects],
  );
  const [subjectId, setSubjectId] = useState(
    () => subjects.find((s) => s.code === initialSubject || s.id === initialSubject)?.id ?? subjects[0]?.id ?? "",
  );
  const subject = subjects.find((s) => s.id === subjectId);
  const categories = useMemo(() => overview.categories.filter((c) => c.subject_id === subjectId && c.total > 0), [overview.categories, subjectId]);
  const [selected, setSelected] = useState<Set<string>>(() => new Set(initialTopic ? [initialTopic] : []));

  const pickSubject = (id: string) => {
    setSubjectId(id);
    setSelected(new Set());
    const code = subjects.find((s) => s.id === id)?.code;
    if (code) window.history.replaceState(null, "", `/practice?subject=${code}`);
  };
  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const t = overview.totals;
  const accuracy = t.answers ? pct(t.correct, t.answers) : null;

  return (
    <div className="space-y-6">
      {/* ---------------- Hero ---------------- */}
      <section className="dash-rise relative overflow-hidden rounded-[28px] bg-ink-950 text-paper">
        <div aria-hidden className="pointer-events-none absolute inset-0">
          <div className="dash-float absolute -right-24 -top-28 h-80 w-80 rounded-full bg-mark-500/30 blur-3xl" />
          <div
            className="absolute inset-0 opacity-[0.06]"
            style={{ backgroundImage: "linear-gradient(#fff 1px,transparent 1px),linear-gradient(90deg,#fff 1px,transparent 1px)", backgroundSize: "32px 32px" }}
          />
        </div>
        <div className="relative grid gap-8 p-6 sm:p-10 lg:grid-cols-[1.2fr_1fr] lg:items-end">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-sky">Question bank</p>
            <h1 className="mt-2 font-display text-4xl leading-[1.05] sm:text-5xl">Practise exactly what you need.</h1>
            <p className="mt-4 max-w-md text-[0.9375rem] leading-relaxed text-ink-300">
              Pick a topic, choose your difficulty and get the answer and explanation the moment you commit. Every
              question you miss comes back for review.
            </p>
          </div>
          <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl bg-white/10 ring-1 ring-white/10">
            <HeroStat label="Answered" value={t.answers.toLocaleString("en")} />
            <HeroStat label="Accuracy" value={accuracy == null ? "—" : `${accuracy}%`} tone={accuracy == null ? undefined : accuracy >= 75 ? "text-[#7BE3A6]" : accuracy >= 50 ? "text-sky" : "text-[#F6C877]"} />
            <HeroStat label="Practice time" value={t.minutes >= 60 ? `${Math.round(t.minutes / 6) / 10} h` : `${t.minutes} min`} />
            <HeroStat label="Sessions done" value={String(t.sessions)} />
          </dl>
        </div>
      </section>

      {overview.open_session ? <ContinueCard s={overview.open_session} /> : null}

      {flash ? (
        <p role="alert" className="rounded-2xl bg-warning-50 px-4 py-3 text-sm text-warning-700 ring-1 ring-inset ring-warning-500/30">
          {flash}
        </p>
      ) : null}

      {subjects.length === 0 ? (
        <div className="flex flex-col items-center rounded-[24px] bg-white px-6 py-16 text-center ring-1 ring-line">
          <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-mark-50 text-mark-500">
            <BookIcon className="h-7 w-7" />
          </span>
          <p className="mt-4 font-display text-2xl text-ink-950">The bank is being stocked</p>
          <p className="mt-2 max-w-sm text-sm text-ink-600">Questions appear here as soon as their exams are published. Check back soon, or take a full exam meanwhile.</p>
          <Link href="/exams" className="mt-6 inline-flex h-11 items-center rounded-xl bg-mark-500 px-5 text-sm font-semibold text-white hover:bg-mark-600">
            Browse exams →
          </Link>
        </div>
      ) : (
        <>
          <SubjectBar subjects={subjects} active={subjectId} onPick={pickSubject} />

          <div className="grid gap-5 lg:grid-cols-[1fr_380px] lg:items-start">
            <TopicList
              subject={subject}
              categories={categories}
              selected={selected}
              onToggle={toggle}
              onClear={() => setSelected(new Set())}
              premium={overview.premium}
            />
            {subject ? <Builder key={subject.id} subject={subject} categories={categories} selected={selected} /> : null}
          </div>
        </>
      )}

      {overview.recent.length ? <RecentSessions sessions={overview.recent} /> : null}
    </div>
  );
}

/* ------------------------------------------------------------------ */

function HeroStat({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className="bg-ink-950/60 px-5 py-4">
      <dt className="text-[0.6875rem] font-semibold uppercase tracking-[0.12em] text-ink-400">{label}</dt>
      <dd className={cn("mt-1 font-display text-3xl tabular", tone)}>{value}</dd>
    </div>
  );
}

function ContinueCard({ s }: { s: NonNullable<BankOverview["open_session"]> }) {
  const progress = pct(s.answered, s.total);
  return (
    <Link
      href={`/practice/${s.id}`}
      className="dash-rise dash-lift group flex items-center gap-4 rounded-2xl bg-white p-4 ring-2 ring-mark-500/60 sm:p-5"
    >
      <span className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-mark-50 text-mark-500">
        <PlayIcon className="h-5 w-5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-xs font-semibold uppercase tracking-[0.1em] text-mark-500">Continue where you left off</span>
        <span className="block truncate font-semibold text-ink-950">
          {s.subject} · {modeLabel[s.mode]}
        </span>
        <span className="mt-2 flex items-center gap-3">
          <span className="h-1.5 max-w-56 flex-1 overflow-hidden rounded-full bg-paper-3">
            <span className="block h-full rounded-full bg-mark-500" style={{ width: `${Math.max(progress, 3)}%` }} />
          </span>
          <span className="text-xs tabular text-ink-500">
            {s.answered}/{s.total}
          </span>
        </span>
      </span>
      <span className="rounded-full bg-ink-950 px-3.5 py-1.5 text-sm font-semibold text-paper transition group-hover:bg-mark-500">Resume</span>
    </Link>
  );
}

function SubjectBar({ subjects, active, onPick }: { subjects: BankSubject[]; active: string; onPick: (id: string) => void }) {
  return (
    <nav aria-label="Subjects" className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:px-0">
      {subjects.map((s) => {
        const on = s.id === active;
        const done = pct(s.answered, s.available);
        return (
          <button
            key={s.id}
            type="button"
            onClick={() => onPick(s.id)}
            aria-pressed={on}
            className={cn(
              "group flex shrink-0 cursor-pointer items-center gap-3 rounded-2xl py-2.5 pl-3 pr-4 text-left ring-1 ring-inset transition",
              on ? "bg-ink-950 text-paper ring-ink-950 shadow-[0_10px_30px_-14px_rgba(10,15,28,.6)]" : "bg-white text-ink-950 ring-line hover:ring-ink-400",
            )}
          >
            <ProgressDot value={done} on={on} />
            <span>
              <span className={cn("block text-[0.625rem] font-semibold uppercase tracking-[0.12em]", on ? "text-ink-400" : "text-ink-500")}>{s.family}</span>
              <span className="block text-sm font-semibold leading-tight">{s.short_name}</span>
            </span>
            <span className={cn("ml-1 rounded-full px-2 py-0.5 text-xs tabular", on ? "bg-white/10 text-ink-300" : "bg-paper-2 text-ink-500")}>{s.available}</span>
          </button>
        );
      })}
    </nav>
  );
}

function ProgressDot({ value, on }: { value: number; on: boolean }) {
  const r = 13;
  const c = 2 * Math.PI * r;
  return (
    <svg viewBox="0 0 32 32" className="h-8 w-8 -rotate-90" aria-hidden>
      <circle cx="16" cy="16" r={r} fill="none" strokeWidth="3.5" className={on ? "stroke-white/15" : "stroke-paper-3"} />
      <circle cx="16" cy="16" r={r} fill="none" strokeWidth="3.5" strokeLinecap="round" className={on ? "stroke-sky" : "stroke-mark-500"} strokeDasharray={`${(value / 100) * c} ${c}`} />
    </svg>
  );
}

function TopicList({
  subject,
  categories,
  selected,
  onToggle,
  onClear,
  premium,
}: {
  subject: BankSubject | undefined;
  categories: BankCategory[];
  selected: Set<string>;
  onToggle: (id: string) => void;
  onClear: () => void;
  premium: boolean;
}) {
  const locked = subject ? subject.total - subject.available : 0;
  const kindLabel = categories.some((c) => c.kind === "skill") ? "skills" : "topics";
  return (
    <section aria-labelledby="topics-h" className="rounded-[24px] bg-white p-5 ring-1 ring-line sm:p-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 id="topics-h" className="text-lg font-semibold text-ink-950">
            {subject?.name} {kindLabel}
          </h2>
          <p className="text-sm text-ink-500">
            {selected.size ? `${selected.size} selected` : `Tap ${kindLabel} to focus on them, or practise across all of them`}
          </p>
        </div>
        {selected.size ? (
          <button type="button" onClick={onClear} className="cursor-pointer text-sm font-semibold text-mark-500 hover:underline">
            Clear selection
          </button>
        ) : null}
      </div>

      <ul className="mt-5 grid gap-2.5">
        {categories.map((c) => {
          const id = c.id ?? "";
          const on = Boolean(c.id) && selected.has(id);
          const acc = c.answered ? pct(c.correct, c.answered) : null;
          const disabled = !c.id || c.available === 0;
          return (
            <li key={id || c.name}>
              <button
                type="button"
                disabled={disabled}
                onClick={() => c.id && onToggle(c.id)}
                aria-pressed={on}
                className={cn(
                  "group w-full cursor-pointer rounded-2xl p-4 text-left ring-1 ring-inset transition disabled:cursor-not-allowed disabled:opacity-60",
                  on ? "bg-mark-50 ring-2 ring-mark-500" : "bg-white ring-line hover:bg-paper hover:ring-ink-300",
                )}
              >
                <div className="flex items-start gap-3">
                  <span
                    className={cn(
                      "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md ring-1 ring-inset transition",
                      on ? "bg-mark-500 text-white ring-mark-500" : "bg-white ring-line-strong group-hover:ring-ink-400",
                    )}
                    aria-hidden
                  >
                    {on ? <CheckIcon className="h-3.5 w-3.5" /> : null}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                      <span className="font-semibold text-ink-950">{c.name}</span>
                      <span className="text-sm tabular text-ink-500">
                        {acc == null ? (
                          <span className="text-ink-400">Not started</span>
                        ) : (
                          <>
                            <b className={cn("font-semibold", acc >= 75 ? "text-success-700" : acc >= 50 ? "text-mark-600" : "text-warning-700")}>{acc}%</b> accuracy
                          </>
                        )}
                      </span>
                    </span>
                    <MasteryBar correct={c.correct} wrong={c.answered - c.correct} total={c.available} />
                    <span className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-ink-500">
                      <span className="tabular">
                        {c.answered}/{c.available} done
                      </span>
                      <DifficultyMix easy={c.easy} medium={c.medium} hard={c.hard} />
                      {c.mistakes ? (
                        <span className="rounded-full bg-danger-50 px-2 py-0.5 font-semibold text-danger-600">{c.mistakes} to review</span>
                      ) : null}
                      {!premium && c.total > c.available ? <span className="text-ink-400">+{c.total - c.available} with Premium</span> : null}
                    </span>
                  </span>
                </div>
              </button>
            </li>
          );
        })}
      </ul>

      {!premium && locked > 0 ? (
        <div className="mt-5 flex flex-wrap items-center gap-4 rounded-2xl bg-ink-950 p-4 text-paper sm:p-5">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-mark-500">
            <LockIcon className="h-5 w-5" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block font-semibold">{locked.toLocaleString("en")} more {subject?.short_name} questions with Premium</span>
            <span className="block text-sm text-ink-400">Every question from every exam, with full explanations.</span>
          </span>
          <Link href="/pricing" className="inline-flex h-10 items-center rounded-xl bg-mark-500 px-4 text-sm font-semibold text-white hover:bg-mark-600">
            See plans →
          </Link>
        </div>
      ) : null}
    </section>
  );
}

function MasteryBar({ correct, wrong, total }: { correct: number; wrong: number; total: number }) {
  const c = total ? (100 * correct) / total : 0;
  const w = total ? (100 * wrong) / total : 0;
  return (
    <span className="mt-2.5 flex h-2 overflow-hidden rounded-full bg-paper-3" role="img" aria-label={`${correct} correct, ${wrong} incorrect, ${Math.max(0, total - correct - wrong)} not tried`}>
      <span className="h-full bg-success-600 transition-[width] duration-700" style={{ width: `${c}%` }} />
      <span className="h-full bg-danger-600/80 transition-[width] duration-700" style={{ width: `${w}%` }} />
    </span>
  );
}

function DifficultyMix({ easy, medium, hard }: { easy: number; medium: number; hard: number }) {
  return (
    <span className="flex items-center gap-2.5" aria-label={`${easy} easy, ${medium} medium, ${hard} hard`}>
      <span className="flex items-center gap-1">
        <span className="h-1.5 w-1.5 rounded-full bg-success-600" />
        {easy}
      </span>
      <span className="flex items-center gap-1">
        <span className="h-1.5 w-1.5 rounded-full bg-warning-500" />
        {medium}
      </span>
      <span className="flex items-center gap-1">
        <span className="h-1.5 w-1.5 rounded-full bg-danger-600" />
        {hard}
      </span>
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* Session builder                                                     */
/* ------------------------------------------------------------------ */

function Builder({ subject, categories, selected }: { subject: BankSubject; categories: BankCategory[]; selected: Set<string> }) {
  const [state, action] = useActionState<CreateState, FormData>(createPracticeSession, undefined);
  const scope = selected.size ? categories.filter((c) => c.id && selected.has(c.id)) : categories;
  const sum = (k: keyof Pick<BankCategory, "available" | "answered" | "mistakes">) => scope.reduce((n, c) => n + c[k], 0);
  const counts: { new: number; mistakes: number; bookmarked: number | null; all: number } = {
    new: sum("available") - sum("answered"),
    mistakes: sum("mistakes"),
    bookmarked: selected.size ? null : subject.bookmarked,
    all: sum("available"),
  };
  const [pickedMode, setMode] = useState<BankMode>(counts.new > 0 ? "new" : "all");
  const [difficulties, setDifficulties] = useState<Set<string>>(new Set());
  const [count, setCount] = useState(10);
  const [tutor, setTutor] = useState(true);

  // If the picked mode runs dry after a topic change, fall back to mixed practice.
  const mode: BankMode = counts[pickedMode] === 0 && pickedMode !== "all" ? "all" : pickedMode;
  const modeCount = counts[mode];

  const max = modeCount ?? 100;
  const effective = Math.min(count, Math.max(max, 1));

  const modes: { id: BankMode; hint: string; icon: React.ReactNode }[] = [
    { id: "new", hint: "Questions you haven't tried", icon: <SparkIcon className="h-4 w-4" /> },
    { id: "mistakes", hint: "Ones you got wrong", icon: <RetryIcon className="h-4 w-4" /> },
    { id: "bookmarked", hint: "Saved for later", icon: <BookmarkIcon className="h-4 w-4" /> },
    { id: "all", hint: "Everything, shuffled", icon: <ShuffleIcon className="h-4 w-4" /> },
  ];

  return (
    <aside className="rounded-[24px] bg-white ring-1 ring-line lg:sticky lg:top-24">
      <form action={action}>
        <input type="hidden" name="subject" value={subject.id} />
        <input type="hidden" name="mode" value={mode} />
        <input type="hidden" name="count" value={effective} />
        <input type="hidden" name="tutor" value={tutor ? "tutor" : "test"} />
        {[...selected].map((id) => (
          <input key={id} type="hidden" name="category" value={id} />
        ))}
        {[...difficulties].map((d) => (
          <input key={d} type="hidden" name="difficulty" value={d} />
        ))}

        <div className="border-b border-line px-5 py-4 sm:px-6">
          <h2 className="text-lg font-semibold text-ink-950">Build a session</h2>
          <p className="text-sm text-ink-500">
            {subject.name} · {selected.size ? `${selected.size} ${selected.size === 1 ? "topic" : "topics"}` : "all topics"}
          </p>
        </div>

        <div className="space-y-6 px-5 py-5 sm:px-6">
          <fieldset>
            <legend className="text-xs font-semibold uppercase tracking-[0.1em] text-ink-500">Questions</legend>
            <div className="mt-2.5 grid grid-cols-2 gap-2">
              {modes.map((m) => {
                const n = counts[m.id];
                const on = mode === m.id;
                const empty = n === 0;
                return (
                  <button
                    key={m.id}
                    type="button"
                    disabled={empty}
                    onClick={() => setMode(m.id)}
                    aria-pressed={on}
                    className={cn(
                      "cursor-pointer rounded-xl p-3 text-left ring-1 ring-inset transition disabled:cursor-not-allowed disabled:opacity-45",
                      on ? "bg-ink-950 text-paper ring-ink-950" : "bg-white text-ink-950 ring-line hover:ring-ink-400",
                    )}
                  >
                    <span className="flex items-center justify-between">
                      <span className={cn("flex h-7 w-7 items-center justify-center rounded-lg", on ? "bg-white/10 text-sky" : "bg-paper-2 text-ink-600")}>{m.icon}</span>
                      {n != null ? <span className={cn("text-xs font-semibold tabular", on ? "text-ink-300" : "text-ink-500")}>{n}</span> : null}
                    </span>
                    <span className="mt-2 block text-sm font-semibold leading-tight">{modeLabel[m.id]}</span>
                    <span className={cn("block text-[0.75rem] leading-snug", on ? "text-ink-400" : "text-ink-500")}>{m.hint}</span>
                  </button>
                );
              })}
            </div>
          </fieldset>

          <fieldset>
            <legend className="text-xs font-semibold uppercase tracking-[0.1em] text-ink-500">Difficulty</legend>
            <div className="mt-2.5 grid grid-cols-4 gap-1 rounded-xl bg-paper-2 p-1">
              <Seg on={difficulties.size === 0} onClick={() => setDifficulties(new Set())}>
                Any
              </Seg>
              {(
                [
                  ["easy", "Easy", "bg-success-600"],
                  ["medium", "Medium", "bg-warning-500"],
                  ["hard", "Hard", "bg-danger-600"],
                ] as const
              ).map(([id, label, dot]) => (
                <Seg
                  key={id}
                  on={difficulties.has(id)}
                  onClick={() =>
                    setDifficulties((prev) => {
                      const next = new Set(prev);
                      if (next.has(id)) next.delete(id);
                      else next.add(id);
                      return next.size === 3 ? new Set() : next;
                    })
                  }
                >
                  <span className={cn("h-1.5 w-1.5 rounded-full", dot)} />
                  {label}
                </Seg>
              ))}
            </div>
          </fieldset>

          <fieldset>
            <legend className="text-xs font-semibold uppercase tracking-[0.1em] text-ink-500">How many</legend>
            <div className="mt-2.5 grid grid-cols-5 gap-1 rounded-xl bg-paper-2 p-1">
              {COUNTS.map((n) => (
                // Sizes above what's available are disabled, except the first one, which means "all of them".
                <Seg key={n} on={count === n} onClick={() => setCount(n)} disabled={n > max && COUNTS.find((x) => x >= max) !== n}>
                  {n}
                </Seg>
              ))}
            </div>
            {effective < count ? <p className="mt-2 text-xs text-ink-500">Only {effective} match right now, so you&apos;ll get all of them.</p> : null}
          </fieldset>

          <fieldset>
            <legend className="text-xs font-semibold uppercase tracking-[0.1em] text-ink-500">Feedback</legend>
            <div className="mt-2.5 grid gap-2">
              <FeedbackOption on={tutor} onClick={() => setTutor(true)} title="Tutor mode" text="See the answer and explanation after each question." />
              <FeedbackOption on={!tutor} onClick={() => setTutor(false)} title="Test mode" text="Answer everything first, then review your results." />
            </div>
          </fieldset>
        </div>

        <div className="border-t border-line px-5 py-4 sm:px-6">
          {state?.error ? (
            <p role="alert" className="mb-3 rounded-xl bg-warning-50 px-3.5 py-2.5 text-sm text-warning-700">
              {state.error}
            </p>
          ) : null}
          <StartButton count={effective} disabled={modeCount === 0} />
          <p className="mt-2.5 text-center text-xs text-ink-400">Untimed · your progress saves as you go</p>
        </div>
      </form>
    </aside>
  );
}

function Seg({ on, onClick, disabled, children }: { on: boolean; onClick: () => void; disabled?: boolean; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={on}
      className={cn(
        "flex h-9 cursor-pointer items-center justify-center gap-1.5 rounded-lg text-sm font-semibold tabular transition disabled:cursor-not-allowed disabled:opacity-35",
        on ? "bg-white text-ink-950 shadow-sm ring-1 ring-line" : "text-ink-600 hover:text-ink-950",
      )}
    >
      {children}
    </button>
  );
}

function FeedbackOption({ on, onClick, title, text }: { on: boolean; onClick: () => void; title: string; text: string }) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={on}
      onClick={onClick}
      className={cn(
        "flex cursor-pointer items-start gap-3 rounded-xl p-3 text-left ring-1 ring-inset transition",
        on ? "bg-mark-50 ring-2 ring-mark-500" : "ring-line hover:ring-ink-400",
      )}
    >
      <span className={cn("mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full ring-1 ring-inset", on ? "ring-mark-500" : "ring-line-strong")}>
        {on ? <span className="h-2 w-2 rounded-full bg-mark-500" /> : null}
      </span>
      <span>
        <span className="block text-sm font-semibold text-ink-950">{title}</span>
        <span className="block text-[0.8125rem] leading-snug text-ink-500">{text}</span>
      </span>
    </button>
  );
}

function StartButton({ count, disabled }: { count: number; disabled: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending || disabled}
      className="group flex h-12 w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-mark-500 font-semibold text-white transition hover:bg-mark-600 disabled:cursor-not-allowed disabled:opacity-60"
    >
      {pending ? (
        <>
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" aria-hidden />
          Preparing your questions…
        </>
      ) : (
        <>
          Start {count} {count === 1 ? "question" : "questions"}
          <span className="transition group-hover:translate-x-0.5">→</span>
        </>
      )}
    </button>
  );
}

/* ------------------------------------------------------------------ */

function RecentSessions({ sessions }: { sessions: BankOverview["recent"] }) {
  return (
    <section className="rounded-[24px] bg-white p-5 ring-1 ring-line sm:p-6">
      <h2 className="text-lg font-semibold text-ink-950">Recent sessions</h2>
      <p className="text-sm text-ink-500">Open one to review every answer and explanation.</p>
      <ul className="mt-4 divide-y divide-line">
        {sessions.map((s) => {
          const score = pct(s.correct ?? 0, s.total);
          return (
            <li key={s.id}>
              <Link href={`/practice/${s.id}`} className="group -mx-2 flex items-center gap-4 rounded-xl px-2 py-3 transition hover:bg-paper">
                <span
                  className={cn(
                    "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl font-display text-base tabular text-white",
                    score >= 75 ? "bg-success-600" : score >= 50 ? "bg-mark-500" : "bg-warning-500",
                  )}
                >
                  {score}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium text-ink-950">
                    {s.subject} · {modeLabel[s.mode]}
                  </span>
                  <span className="block text-xs text-ink-500">
                    {dateFmt.format(new Date(s.created_at))} · {s.correct ?? 0}/{s.total} correct · {s.tutor ? "Tutor" : "Test"} mode
                  </span>
                </span>
                <span className="text-sm font-semibold text-mark-500 opacity-0 transition group-hover:opacity-100">Review →</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Icons                                                               */
/* ------------------------------------------------------------------ */
type IconProps = { className?: string };
const svg = { fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round", viewBox: "0 0 24 24", "aria-hidden": true } as const;
function BookIcon({ className }: IconProps) {
  return <svg {...svg} className={className}><path d="M4 19.5V5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2zM8 7h7M8 11h5" /></svg>;
}
function PlayIcon({ className }: IconProps) {
  return <svg {...svg} className={className}><path d="M7 4.5v15l12-7.5z" /></svg>;
}
function CheckIcon({ className }: IconProps) {
  return <svg {...svg} strokeWidth={3} className={className}><path d="m5 12 5 5 9-10" /></svg>;
}
function LockIcon({ className }: IconProps) {
  return <svg {...svg} className={className}><rect x="4" y="10" width="16" height="11" rx="2" /><path d="M8 10V7a4 4 0 0 1 8 0v3" /></svg>;
}
function SparkIcon({ className }: IconProps) {
  return <svg {...svg} className={className}><path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M6 18l2.5-2.5M15.5 8.5 18 6" /></svg>;
}
function RetryIcon({ className }: IconProps) {
  return <svg {...svg} className={className}><path d="M3 12a9 9 0 1 0 3-6.7L3 8M3 3v5h5" /></svg>;
}
function BookmarkIcon({ className }: IconProps) {
  return <svg {...svg} className={className}><path d="M6 3h12v18l-6-4-6 4z" /></svg>;
}
function ShuffleIcon({ className }: IconProps) {
  return <svg {...svg} className={className}><path d="M16 3h5v5M4 20 21 3M21 16v5h-5M15 15l6 6M4 4l5 5" /></svg>;
}
