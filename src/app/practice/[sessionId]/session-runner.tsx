"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { RichContentView } from "@/components/exam/rich-content";
import type { BankAnswer, BankQuestion, BankSessionPayload } from "@/lib/bank-types";
import { modeLabel } from "@/lib/bank-types";
import { cn } from "@/lib/utils";
import { finishPracticeSession, submitPracticeAnswer, toggleBookmark } from "../actions";

type Status = "correct" | "incorrect" | "answered" | "open";

const difficultyTone = {
  easy: { label: "Easy", dot: "bg-success-600" },
  medium: { label: "Medium", dot: "bg-warning-500" },
  hard: { label: "Hard", dot: "bg-danger-600" },
} as const;

const fmtClock = (ms: number) => {
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};

export function SessionRunner({ payload }: { payload: BankSessionPayload }) {
  const router = useRouter();
  const { session, stimuli } = payload;
  const tutor = session.tutor;
  const stimulusById = useMemo(() => new Map(stimuli.map((s) => [s.id, s])), [stimuli]);

  const [questions, setQuestions] = useState<BankQuestion[]>(payload.questions);
  const firstOpen = payload.questions.findIndex((q) => !q.answer);
  const [index, setIndex] = useState(firstOpen < 0 ? payload.questions.length - 1 : firstOpen);
  const q = questions[index];

  // Pending choice before "Check" in tutor mode; in test mode the saved answer is the choice.
  const [choice, setChoice] = useState<Record<string, string>>({});
  const [eliminated, setEliminated] = useState<Record<string, string[]>>({});
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [navOpen, setNavOpen] = useState(false);
  const [confirmFinish, setConfirmFinish] = useState(false);
  const [finishing, startFinishing] = useTransition();

  /* ---------------- Time on question ---------------- */
  // Seconds on each question not yet sent to the server (counted while it is open and unlocked).
  const [unsent, setUnsent] = useState<Record<string, number>>({});
  const locked = Boolean(tutor && q?.answer);
  const qid = q?.id;

  useEffect(() => {
    if (!qid || locked) return;
    const t = window.setInterval(() => setUnsent((u) => ({ ...u, [qid]: (u[qid] ?? 0) + 1000 })), 1000);
    return () => window.clearInterval(t);
  }, [qid, locked]);

  const elapsed = q ? (q.answer?.time_ms ?? 0) + (locked ? 0 : (unsent[q.id] ?? 0)) : 0;

  const takeTime = (id: string) => {
    const ms = unsent[id] ?? 0;
    setUnsent((u) => ({ ...u, [id]: 0 }));
    return Math.min(3_600_000, ms);
  };

  /* ---------------- Status ---------------- */
  const statusOf = useCallback(
    (x: BankQuestion): Status => {
      if (!x.answer) return "open";
      if (x.answer.revealed) return x.answer.is_correct ? "correct" : "incorrect";
      return "answered";
    },
    [],
  );
  const answeredCount = questions.filter((x) => x.answer).length;
  const correctCount = questions.filter((x) => x.answer?.is_correct).length;
  const unanswered = questions.length - answeredCount;

  const flash = (msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast((t) => (t === msg ? null : t)), 3500);
  };

  /* ---------------- Actions ---------------- */
  const applyAnswer = (id: string, answer: BankAnswer) =>
    setQuestions((prev) => prev.map((x) => (x.id === id ? { ...x, answer } : x)));

  const send = async (question: BankQuestion, optionId: string) => {
    setSaving(true);
    const res = await submitPracticeAnswer({ sessionId: session.id, questionId: question.id, optionId, timeMs: takeTime(question.id) });
    setSaving(false);
    if (!res.ok) {
      if (res.finished) router.refresh();
      flash(res.message);
      return false;
    }
    applyAnswer(question.id, res.answer);
    return true;
  };

  const select = (optionId: string) => {
    if (!q || locked || saving) return;
    if ((eliminated[q.id] ?? []).includes(optionId)) {
      setEliminated((e) => ({ ...e, [q.id]: (e[q.id] ?? []).filter((x) => x !== optionId) }));
    }
    if (tutor) {
      setChoice((c) => ({ ...c, [q.id]: optionId }));
    } else {
      const prev = q.answer;
      applyAnswer(q.id, { option_id: optionId, time_ms: prev?.time_ms ?? 0, revealed: false });
      void send(q, optionId).then((ok) => {
        if (!ok) setQuestions((all) => all.map((x) => (x.id === q.id ? { ...x, answer: prev } : x)));
      });
    }
  };

  const check = async () => {
    if (!q || !tutor || locked) return;
    const optionId = choice[q.id];
    if (!optionId) return;
    await send(q, optionId);
  };

  const eliminate = (optionId: string) => {
    if (!q || locked) return;
    setEliminated((e) => {
      const cur = e[q.id] ?? [];
      return { ...e, [q.id]: cur.includes(optionId) ? cur.filter((x) => x !== optionId) : [...cur, optionId] };
    });
    if (tutor && choice[q.id] === optionId) setChoice((c) => ({ ...c, [q.id]: "" }));
  };

  const go = (i: number) => {
    if (i < 0 || i >= questions.length) return;
    setIndex(i);
    setNavOpen(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const finish = () => {
    startFinishing(async () => {
      const res = await finishPracticeSession(session.id);
      if (!res.ok) {
        flash("We couldn't finish the session. Please try again.");
        return;
      }
      router.refresh();
    });
  };
  const requestFinish = () => (unanswered > 0 ? setConfirmFinish(true) : finish());

  const bookmark = async () => {
    if (!q) return;
    const next = !q.bookmarked;
    setQuestions((prev) => prev.map((x) => (x.id === q.id ? { ...x, bookmarked: next } : x)));
    const res = await toggleBookmark(q.id);
    if (!res.ok) {
      setQuestions((prev) => prev.map((x) => (x.id === q.id ? { ...x, bookmarked: !next } : x)));
      flash("Couldn't update the bookmark.");
    } else flash(res.bookmarked ? "Saved to your bookmarks" : "Removed from bookmarks");
  };

  const isLast = index === questions.length - 1;
  const primary = (() => {
    if (!q) return null;
    if (tutor && !q.answer) return { label: "Check answer", run: check, disabled: !choice[q.id] || saving };
    if (isLast) return { label: tutor ? "See results" : "Finish & see results", run: requestFinish, disabled: finishing };
    return { label: "Next question", run: () => go(index + 1), disabled: false };
  })();

  /* ---------------- Keyboard ---------------- */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.target instanceof HTMLElement && ["INPUT", "TEXTAREA", "SELECT"].includes(e.target.tagName)) return;
      if (confirmFinish || !q) return;
      const k = e.key.toLowerCase();
      const byLetter = q.options.findIndex((o) => o.label.toLowerCase() === k);
      const byNumber = /^[1-5]$/.test(k) ? Number(k) - 1 : -1;
      const optIndex = byLetter >= 0 ? byLetter : byNumber;
      if (optIndex >= 0 && q.options[optIndex]) {
        e.preventDefault();
        if (e.shiftKey) eliminate(q.options[optIndex].id);
        else select(q.options[optIndex].id);
      } else if (e.key === "Enter" && primary && !primary.disabled) {
        e.preventDefault();
        void primary.run();
      } else if (e.key === "ArrowRight") go(index + 1);
      else if (e.key === "ArrowLeft") go(index - 1);
      else if (k === "m") void bookmark();
      else if (k === "g") setNavOpen((o) => !o);
      else if (e.key === "Escape") setNavOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  if (!q) return null;
  const stimulus = q.stimulus_id ? stimulusById.get(q.stimulus_id) : undefined;
  const picked = tutor ? (q.answer?.option_id ?? choice[q.id]) : q.answer?.option_id;
  const revealed = q.answer?.revealed ? q.answer : null;
  const diff = difficultyTone[q.difficulty];

  return (
    <div className="flex min-h-screen flex-col bg-paper">
      {/* ---------------- Top bar ---------------- */}
      <header className="sticky top-0 z-30 border-b border-line bg-white/95 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-7xl items-center gap-3 px-3 sm:px-5">
          <Link
            href="/practice"
            className="flex h-9 w-9 items-center justify-center rounded-lg text-ink-500 transition hover:bg-paper-2 hover:text-ink-950"
            aria-label="Save and exit to the question bank"
            title="Save & exit"
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
              <path d="M6 6l12 12M18 6 6 18" />
            </svg>
          </Link>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-ink-950">{session.subject.name}</p>
            <p className="truncate text-xs text-ink-500">
              {modeLabel[session.mode]} · {tutor ? "Tutor" : "Test"} mode
            </p>
          </div>

          <div className="ml-auto flex items-center gap-1.5 sm:gap-2">
            <span className="hidden items-center gap-1.5 rounded-lg bg-paper-2 px-2.5 py-1.5 font-mono text-sm tabular text-ink-700 sm:flex" title="Time on this question">
              <svg viewBox="0 0 24 24" className="h-4 w-4 text-ink-400" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
                <circle cx="12" cy="13" r="8" />
                <path d="M12 9v4l2.5 2.5M9 2h6" />
              </svg>
              {fmtClock(elapsed)}
            </span>
            <IconButton label={q.bookmarked ? "Remove bookmark (M)" : "Bookmark (M)"} onClick={() => void bookmark()} active={q.bookmarked}>
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill={q.bookmarked ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinejoin="round" aria-hidden>
                <path d="M6 3h12v18l-6-4-6 4z" />
              </svg>
            </IconButton>
            <button
              type="button"
              onClick={() => setNavOpen(true)}
              className="flex h-9 cursor-pointer items-center gap-2 rounded-lg px-2.5 text-sm font-semibold text-ink-800 ring-1 ring-inset ring-line transition hover:ring-ink-400"
              aria-label="Open question navigator (G)"
            >
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                <rect x="3" y="3" width="7" height="7" rx="1.5" />
                <rect x="14" y="3" width="7" height="7" rx="1.5" />
                <rect x="3" y="14" width="7" height="7" rx="1.5" />
                <rect x="14" y="14" width="7" height="7" rx="1.5" />
              </svg>
              <span className="tabular">
                {index + 1}
                <span className="text-ink-400">/{questions.length}</span>
              </span>
            </button>
            {!tutor ? (
              <button
                type="button"
                onClick={requestFinish}
                disabled={finishing}
                className="hidden h-9 cursor-pointer rounded-lg bg-ink-950 px-3.5 text-sm font-semibold text-paper transition hover:bg-ink-800 disabled:opacity-60 sm:block"
              >
                Finish
              </button>
            ) : null}
          </div>
        </div>
        {/* Segmented progress */}
        <div className="mx-auto flex max-w-7xl gap-[3px] px-3 pb-2 sm:px-5" aria-hidden>
          {questions.map((x, i) => {
            const s = statusOf(x);
            return (
              <button
                key={x.id}
                type="button"
                tabIndex={-1}
                onClick={() => go(i)}
                className={cn(
                  "h-1.5 flex-1 cursor-pointer rounded-full transition-all",
                  s === "correct" ? "bg-success-600" : s === "incorrect" ? "bg-danger-600" : s === "answered" ? "bg-mark-500" : "bg-paper-3 hover:bg-line-strong",
                  i === index && "outline outline-2 outline-offset-1 outline-ink-950",
                )}
              />
            );
          })}
        </div>
      </header>

      {/* ---------------- Body ---------------- */}
      <main className="flex-1">
        <div className={cn("mx-auto px-4 py-6 sm:px-6 sm:py-8", stimulus ? "max-w-7xl" : "max-w-3xl")}>
          <div className={cn(stimulus && "lg:grid lg:grid-cols-2 lg:gap-8")}>
            {stimulus ? <Passage key={stimulus.id} stimulus={stimulus} marker={q.stimulus_marker} /> : null}

            <article key={q.id} className="animate-[dashRise_.35s_cubic-bezier(.2,.8,.2,1)]">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-display text-2xl tabular text-ink-950">Question {index + 1}</span>
                {q.category ? <span className="rounded-full bg-white px-2.5 py-1 text-xs font-medium text-ink-700 ring-1 ring-line">{q.category}</span> : null}
                <span className="flex items-center gap-1.5 rounded-full bg-white px-2.5 py-1 text-xs font-medium text-ink-700 ring-1 ring-line">
                  <span className={cn("h-1.5 w-1.5 rounded-full", diff.dot)} />
                  {diff.label}
                </span>
              </div>

              <RichContentView content={q.stem} activeMarker={q.stimulus_marker} className="q-stem mt-5 font-reading text-[1.1875rem] leading-relaxed text-ink-950" />

              <ul className="mt-6 grid gap-2.5" role="radiogroup" aria-label="Answer choices">
                {q.options.map((o) => {
                  const isPicked = picked === o.id;
                  const isOut = (eliminated[q.id] ?? []).includes(o.id) && !revealed;
                  const isKey = revealed?.correct_option_id === o.id;
                  const wrongPick = revealed && isPicked && !isKey;
                  return (
                    <li key={o.id} className="group/opt relative">
                      <button
                        type="button"
                        role="radio"
                        aria-checked={isPicked}
                        disabled={locked || saving}
                        onClick={() => select(o.id)}
                        className={cn(
                          "flex w-full cursor-pointer items-start gap-3.5 rounded-2xl bg-white py-3.5 pl-4 pr-12 text-left ring-1 ring-inset transition disabled:cursor-default",
                          isKey
                            ? "bg-success-50 ring-2 ring-success-600"
                            : wrongPick
                              ? "bg-danger-50 ring-2 ring-danger-600"
                              : isPicked
                                ? "bg-mark-50 ring-2 ring-mark-500"
                                : revealed
                                  ? "opacity-60 ring-line"
                                  : "ring-line hover:-translate-y-px hover:shadow-[0_8px_24px_-16px_rgba(10,15,28,.35)] hover:ring-ink-400",
                          isOut && "opacity-45",
                        )}
                      >
                        <span
                          className={cn(
                            "flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold transition",
                            isKey ? "bg-success-600 text-white" : wrongPick ? "bg-danger-600 text-white" : isPicked ? "bg-mark-500 text-white" : "bg-paper-2 text-ink-700 ring-1 ring-inset ring-line",
                          )}
                        >
                          {isKey ? "✓" : wrongPick ? "✕" : o.label}
                        </span>
                        <RichContentView content={o.content} className={cn("flex-1 pt-1 font-reading text-[1.0625rem] [&_p]:my-0", isOut && "line-through decoration-ink-500 decoration-2")} />
                        <span className="sr-only">{`Option ${o.label}`}</span>
                      </button>
                      {!revealed ? (
                        <button
                          type="button"
                          onClick={() => eliminate(o.id)}
                          className={cn(
                            "absolute right-2.5 top-1/2 flex h-8 w-8 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full text-ink-400 transition hover:bg-paper-2 hover:text-ink-950",
                            isOut ? "opacity-100" : "opacity-0 focus-visible:opacity-100 group-hover/opt:opacity-100 max-sm:opacity-100",
                          )}
                          aria-label={isOut ? `Restore option ${o.label}` : `Eliminate option ${o.label} (Shift+${o.label})`}
                          title={isOut ? "Restore" : `Eliminate (Shift+${o.label})`}
                        >
                          {isOut ? (
                            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
                              <path d="M3 12a9 9 0 1 0 3-6.7L3 8M3 3v5h5" />
                            </svg>
                          ) : (
                            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
                              <path d="M5 12h14" />
                            </svg>
                          )}
                        </button>
                      ) : null}
                    </li>
                  );
                })}
              </ul>

              {revealed ? <Feedback answer={revealed} options={q.options} /> : null}
              {!tutor && q.answer ? (
                <p className="mt-4 flex items-center gap-2 text-sm text-ink-500">
                  <span className="h-1.5 w-1.5 rounded-full bg-mark-500" />
                  Answer saved. You&apos;ll see if it&apos;s right when you finish.
                </p>
              ) : null}
            </article>
          </div>
        </div>
      </main>

      {/* ---------------- Bottom bar ---------------- */}
      <footer className="sticky bottom-0 z-20 border-t border-line bg-white/95 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-7xl items-center gap-3 px-3 sm:px-5">
          <button
            type="button"
            onClick={() => go(index - 1)}
            disabled={index === 0}
            className="flex h-11 cursor-pointer items-center gap-1.5 rounded-xl px-3.5 text-sm font-semibold text-ink-700 ring-1 ring-inset ring-line transition hover:ring-ink-400 disabled:cursor-not-allowed disabled:opacity-40"
          >
            ← <span className="hidden sm:inline">Previous</span>
          </button>
          <div className="mx-auto hidden items-center gap-3 text-xs text-ink-400 md:flex">
            <Kbd>A</Kbd>–<Kbd>D</Kbd> choose
            <span className="text-line-strong">·</span>
            <Kbd>Shift</Kbd>+<Kbd>A</Kbd> eliminate
            <span className="text-line-strong">·</span>
            <Kbd>Enter</Kbd> {tutor && !q.answer ? "check" : "next"}
            <span className="text-line-strong">·</span>
            <span className="tabular">
              {tutor ? `${correctCount}/${answeredCount} correct` : `${answeredCount}/${questions.length} answered`}
            </span>
          </div>
          {primary ? (
            <button
              type="button"
              onClick={() => void primary.run()}
              disabled={primary.disabled}
              className={cn(
                "ml-auto flex h-11 min-w-[9rem] cursor-pointer items-center justify-center gap-2 rounded-xl px-5 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 md:ml-0",
                tutor && !q.answer ? "bg-mark-500 text-white hover:bg-mark-600" : "bg-ink-950 text-paper hover:bg-ink-800",
              )}
            >
              {saving || finishing ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" aria-hidden /> : null}
              {primary.label}
              {!saving && !finishing ? <span aria-hidden>→</span> : null}
            </button>
          ) : null}
        </div>
      </footer>

      {/* ---------------- Navigator ---------------- */}
      {navOpen ? (
        <div className="fixed inset-0 z-40" role="dialog" aria-modal="true" aria-label="Question navigator">
          <button type="button" aria-label="Close navigator" className="absolute inset-0 cursor-default bg-ink-950/30 backdrop-blur-[2px] animate-[dashFade_.2s_ease]" onClick={() => setNavOpen(false)} />
          <aside className="absolute inset-y-0 right-0 flex w-full max-w-sm flex-col bg-white shadow-2xl animate-[navIn_.25s_cubic-bezier(.2,.8,.2,1)]">
            <div className="flex items-center justify-between border-b border-line px-5 py-4">
              <div>
                <h2 className="font-semibold text-ink-950">Questions</h2>
                <p className="text-xs text-ink-500">
                  {answeredCount} of {questions.length} answered
                  {tutor && answeredCount ? ` · ${Math.round((100 * correctCount) / answeredCount)}% correct` : ""}
                </p>
              </div>
              <IconButton label="Close" onClick={() => setNavOpen(false)}>
                <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
                  <path d="M6 6l12 12M18 6 6 18" />
                </svg>
              </IconButton>
            </div>
            <div className="flex-1 overflow-y-auto px-5 py-5">
              <div className="grid grid-cols-6 gap-2">
                {questions.map((x, i) => {
                  const s = statusOf(x);
                  return (
                    <button
                      key={x.id}
                      type="button"
                      onClick={() => go(i)}
                      aria-current={i === index}
                      aria-label={`Question ${i + 1}: ${s === "open" ? "not answered" : s}${x.bookmarked ? ", bookmarked" : ""}`}
                      className={cn(
                        "relative aspect-square cursor-pointer rounded-xl text-sm font-semibold tabular ring-1 ring-inset transition hover:-translate-y-0.5",
                        s === "correct"
                          ? "bg-success-50 text-success-700 ring-success-600/40"
                          : s === "incorrect"
                            ? "bg-danger-50 text-danger-600 ring-danger-600/40"
                            : s === "answered"
                              ? "bg-mark-50 text-mark-600 ring-mark-500/40"
                              : "bg-white text-ink-700 ring-line",
                        i === index && "ring-2 ring-ink-950",
                      )}
                    >
                      {i + 1}
                      {x.bookmarked ? <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-warning-500 ring-2 ring-white" /> : null}
                    </button>
                  );
                })}
              </div>
              <div className="mt-5 flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-ink-500">
                {tutor ? (
                  <>
                    <LegendDot className="bg-success-600" label="Correct" />
                    <LegendDot className="bg-danger-600" label="Incorrect" />
                  </>
                ) : (
                  <LegendDot className="bg-mark-500" label="Answered" />
                )}
                <LegendDot className="bg-paper-3 ring-1 ring-line" label="Not answered" />
                <LegendDot className="bg-warning-500" label="Bookmarked" />
              </div>
            </div>
            <div className="border-t border-line p-5">
              <button
                type="button"
                onClick={() => {
                  setNavOpen(false);
                  requestFinish();
                }}
                disabled={finishing}
                className="h-11 w-full cursor-pointer rounded-xl bg-ink-950 text-sm font-semibold text-paper transition hover:bg-ink-800 disabled:opacity-60"
              >
                Finish session &amp; see results
              </button>
              <Link href="/practice" className="mt-2 block py-2 text-center text-sm font-medium text-ink-500 hover:text-ink-950">
                Save &amp; exit. Continue later.
              </Link>
            </div>
          </aside>
        </div>
      ) : null}

      {/* ---------------- Finish confirmation ---------------- */}
      {confirmFinish ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center p-4 sm:items-center" role="alertdialog" aria-modal="true" aria-labelledby="finish-h">
          <button type="button" aria-label="Cancel" className="absolute inset-0 cursor-default bg-ink-950/40 backdrop-blur-[2px]" onClick={() => setConfirmFinish(false)} />
          <div className="relative w-full max-w-md rounded-[24px] bg-white p-6 shadow-2xl animate-[dashRise_.3s_cubic-bezier(.2,.8,.2,1)]">
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-warning-50 text-warning-700">
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
                <path d="M12 8v5M12 16.5v.5M10.3 3.9 2.4 17.5A2 2 0 0 0 4.1 20.5h15.8a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" />
              </svg>
            </span>
            <h2 id="finish-h" className="mt-4 font-display text-2xl text-ink-950">
              Finish with {unanswered} unanswered?
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-ink-600">
              Unanswered questions count as skipped. You&apos;ll still see their correct answers and explanations in the review.
            </p>
            <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => {
                  setConfirmFinish(false);
                  const next = questions.findIndex((x) => !x.answer);
                  if (next >= 0) go(next);
                }}
                className="h-11 cursor-pointer rounded-xl px-4 text-sm font-semibold text-ink-800 ring-1 ring-inset ring-line hover:ring-ink-400"
              >
                Go to first unanswered
              </button>
              <button
                type="button"
                autoFocus
                onClick={() => {
                  setConfirmFinish(false);
                  finish();
                }}
                className="h-11 cursor-pointer rounded-xl bg-ink-950 px-4 text-sm font-semibold text-paper hover:bg-ink-800"
              >
                Finish anyway
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* ---------------- Toast ---------------- */}
      <div aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-20 z-50 flex justify-center px-4">
        {toast ? (
          <p className="pointer-events-auto rounded-full bg-ink-950 px-4 py-2.5 text-sm font-medium text-paper shadow-lg animate-[dashRise_.25s_ease]">{toast}</p>
        ) : null}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */

function Feedback({ answer, options }: { answer: BankAnswer; options: BankQuestion["options"] }) {
  const right = Boolean(answer.is_correct);
  const key = options.find((o) => o.id === answer.correct_option_id);
  return (
    <section
      aria-live="polite"
      className={cn(
        "mt-6 overflow-hidden rounded-2xl ring-1 ring-inset animate-[dashRise_.35s_cubic-bezier(.2,.8,.2,1)]",
        right ? "bg-success-50/60 ring-success-600/30" : "bg-danger-50/60 ring-danger-600/30",
      )}
    >
      <div className="flex flex-wrap items-center gap-3 px-5 py-4">
        <span className={cn("flex h-10 w-10 items-center justify-center rounded-full text-lg font-bold text-white", right ? "bg-success-600" : "bg-danger-600")}>
          {right ? "✓" : "✕"}
        </span>
        <div className="min-w-0 flex-1">
          <p className={cn("font-semibold", right ? "text-success-700" : "text-danger-600")}>{right ? "Correct!" : "Not quite."}</p>
          <p className="text-sm text-ink-600">{right ? "Nicely done." : key ? `The correct answer is ${key.label}.` : "Review the explanation below."}</p>
        </div>
        <div className="flex gap-2 text-xs">
          {answer.time_ms != null ? <Pill>⏱ {fmtClock(answer.time_ms)}</Pill> : null}
          {answer.peer_correct != null ? <Pill>{answer.peer_correct}% of students got this right</Pill> : null}
        </div>
      </div>
      {answer.explanation?.blocks?.length ? (
        <div className="border-t border-black/5 bg-white px-5 py-4">
          <h3 className="text-xs font-semibold uppercase tracking-[0.1em] text-mark-500">Explanation</h3>
          <RichContentView content={answer.explanation} className="mt-2 leading-relaxed text-ink-800" />
        </div>
      ) : null}
    </section>
  );
}

function Passage({ stimulus, marker }: { stimulus: NonNullable<BankSessionPayload["stimuli"][number]>; marker: number | null }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (marker == null) return;
    const el = ref.current?.querySelector<HTMLElement>(`[data-marker="${marker}"]`);
    el?.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [marker]);
  return (
    <>
      {/* Mobile: collapsible */}
      <details className="group/p mb-6 overflow-hidden rounded-2xl bg-white ring-1 ring-line lg:hidden">
        <summary className="flex cursor-pointer list-none items-center gap-3 px-4 py-3.5 [&::-webkit-details-marker]:hidden">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-mark-50 text-mark-500">
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M2 4h7a3 3 0 0 1 3 3v13a2 2 0 0 0-2-2H2zM22 4h-7a3 3 0 0 0-3 3v13a2 2 0 0 1 2-2h8z" />
            </svg>
          </span>
          <span className="min-w-0 flex-1 truncate text-sm font-semibold text-ink-950">{stimulus.title ?? "Read the passage"}</span>
          <span className="text-ink-400 transition-transform group-open/p:rotate-180">⌄</span>
        </summary>
        <div className="max-h-[60vh] overflow-y-auto border-t border-line px-4 py-4">
          <PassageBody stimulus={stimulus} marker={marker} />
        </div>
      </details>
      {/* Desktop: sticky column */}
      <section aria-label="Passage" className="hidden lg:block">
        <div ref={ref} className="sticky top-[5.5rem] max-h-[calc(100vh-11rem)] overflow-y-auto rounded-2xl bg-white px-7 py-6 ring-1 ring-line">
          <PassageBody stimulus={stimulus} marker={marker} />
        </div>
      </section>
    </>
  );
}

function PassageBody({ stimulus, marker }: { stimulus: BankSessionPayload["stimuli"][number]; marker: number | null }) {
  return (
    <>
      {stimulus.title ? <h2 className="p-title mb-4 font-reading text-xl font-semibold text-ink-950">{stimulus.title}</h2> : null}
      <RichContentView content={stimulus.content} activeMarker={marker} className="font-reading text-[1.0625rem] leading-relaxed text-ink-800" />
      {stimulus.attribution ? <p className="p-attr mt-4 text-sm italic text-ink-500">{stimulus.attribution}</p> : null}
    </>
  );
}

function IconButton({ label, onClick, active, children }: { label: string; onClick: () => void; active?: boolean; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      aria-pressed={active}
      title={label}
      className={cn(
        "flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg transition",
        active ? "bg-warning-50 text-warning-500" : "text-ink-500 hover:bg-paper-2 hover:text-ink-950",
      )}
    >
      {children}
    </button>
  );
}

function Kbd({ children }: { children: React.ReactNode }) {
  return <kbd className="rounded-md bg-paper-2 px-1.5 py-0.5 font-mono text-[0.6875rem] font-semibold text-ink-600 ring-1 ring-inset ring-line">{children}</kbd>;
}

function Pill({ children }: { children: React.ReactNode }) {
  return <span className="rounded-full bg-white px-2.5 py-1 font-medium text-ink-600 ring-1 ring-inset ring-line">{children}</span>;
}

function LegendDot({ className, label }: { className: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className={cn("h-2.5 w-2.5 rounded-full", className)} />
      {label}
    </span>
  );
}
