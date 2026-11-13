"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, useTransition } from "react";
import { RichContentView } from "@/components/exam/rich-content";
import { LogoMark } from "@/components/brand/logo";
import type { AttemptPayload } from "@/lib/exam-types";
import { cn } from "@/lib/utils";
import { saveAnswer, submitAttempt } from "../actions";
import { SelectionToolbar, SplitHandle, ToolsMenu, useHighlights, useStored } from "./tools";

type QState = { option: string | null; flagged: boolean };
type SyncStatus = "saved" | "saving" | "retrying";

const storageKey = (attemptId: string) => `northmark:attempt:${attemptId}`;

function readLocal(attemptId: string): Record<string, QState> {
  try {
    return JSON.parse(localStorage.getItem(storageKey(attemptId)) ?? "{}");
  } catch {
    return {};
  }
}
function writeLocal(attemptId: string, dirty: Record<string, QState>) {
  try {
    if (Object.keys(dirty).length) localStorage.setItem(storageKey(attemptId), JSON.stringify(dirty));
    else localStorage.removeItem(storageKey(attemptId));
  } catch {
    /* storage unavailable (private mode): the in-memory queue still retries */
  }
}

function formatClock(ms: number) {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const mm = String(m).padStart(h ? 2 : 1, "0");
  return h ? `${h}:${mm}:${String(s).padStart(2, "0")}` : `${mm}:${String(s).padStart(2, "0")}`;
}

export function ExamRunner({ payload }: { payload: AttemptPayload }) {
  const router = useRouter();
  const attemptId = payload.attempt.id;
  const questions = payload.questions;
  const total = questions.length;

  const sectionsById = useMemo(() => new Map(payload.sections.map((s) => [s.id, s])), [payload.sections]);
  const stimuliById = useMemo(() => new Map(payload.stimuli.map((s) => [s.id, s])), [payload.stimuli]);

  // ---------- answer state (server answers, overlaid with unsynced local changes) ----------
  const [state, setState] = useState<Record<string, QState>>(() => {
    const initial: Record<string, QState> = {};
    for (const a of payload.answers) initial[a.question_id] = { option: a.option_id, flagged: a.flagged };
    return initial;
  });
  const dirty = useRef<Record<string, QState>>({});
  const [syncStatus, setSyncStatus] = useState<SyncStatus>("saved");
  const [closed, setClosed] = useState(false);
  const flushing = useRef(false);
  const backoff = useRef(0);
  const retryTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [index, setIndex] = useState(() => {
    const firstUnanswered = questions.findIndex((q) => !payload.answers.some((a) => a.question_id === q.id && a.option_id));
    return firstUnanswered === -1 ? 0 : firstUnanswered;
  });
  const current = questions[index];
  const currentState = state[current.id] ?? { option: null, flagged: false };

  const goToResults = useCallback(() => {
    writeLocal(attemptId, {});
    router.replace(`/results/${attemptId}`);
  }, [attemptId, router]);

  const flush = useCallback(async () => {
    if (flushing.current || closed) return;
    flushing.current = true;
    try {
      while (Object.keys(dirty.current).length) {
        const [qid, desired] = Object.entries(dirty.current)[0];
        setSyncStatus((s) => (s === "retrying" ? s : "saving"));
        const res = await saveAnswer({
          attemptId,
          questionId: qid,
          optionId: desired.option,
          setOption: true,
          flagged: desired.flagged,
        });
        if (res.ok) {
          backoff.current = 0;
          if (res.result.closed) {
            setClosed(true);
            goToResults();
            return;
          }
          // Only clear if nothing changed for this question while the request was in flight.
          if (dirty.current[qid] === desired) delete dirty.current[qid];
          writeLocal(attemptId, dirty.current);
        } else if (res.retry) {
          setSyncStatus("retrying");
          backoff.current = Math.min(backoff.current ? backoff.current * 2 : 1000, 15000);
          retryTimer.current = setTimeout(() => void flush(), backoff.current);
          return;
        } else {
          // Permanent rejection (e.g. invalid option): drop the change and resync from the server.
          delete dirty.current[qid];
          writeLocal(attemptId, dirty.current);
          router.refresh();
        }
      }
      setSyncStatus("saved");
    } finally {
      flushing.current = false;
    }
  }, [attemptId, closed, goToResults, router]);

  // Replay unsynced changes from a previous page load.
  useEffect(() => {
    const local = readLocal(attemptId);
    const validIds = new Set(questions.map((q) => q.id));
    const replay = Object.fromEntries(Object.entries(local).filter(([qid]) => validIds.has(qid)));
    if (Object.keys(replay).length) {
      dirty.current = replay;
      // eslint-disable-next-line react-hooks/set-state-in-effect -- restoring unsynced answers from localStorage after hydration
      setState((s) => ({ ...s, ...replay }));
      void flush();
    }
    const online = () => {
      if (retryTimer.current) clearTimeout(retryTimer.current);
      backoff.current = 0;
      void flush();
    };
    window.addEventListener("online", online);
    return () => {
      window.removeEventListener("online", online);
      if (retryTimer.current) clearTimeout(retryTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run once on mount
  }, []);

  const update = useCallback(
    (qid: string, patch: Partial<QState>) => {
      if (closed) return;
      setState((s) => {
        const next = { ...(s[qid] ?? { option: null, flagged: false }), ...patch };
        dirty.current = { ...dirty.current, [qid]: next };
        writeLocal(attemptId, dirty.current);
        return { ...s, [qid]: next };
      });
      queueMicrotask(() => void flush());
    },
    [attemptId, closed, flush],
  );

  // ---------- timer (server deadline, corrected for clock skew) ----------
  // The first render uses the server's own timestamps (identical on server and client);
  // after mount the clock ticks locally, corrected by the server/client offset.
  const deadline = useMemo(() => Date.parse(payload.attempt.deadline_at), [payload.attempt.deadline_at]);
  const serverNow = useMemo(() => Date.parse(payload.attempt.server_now), [payload.attempt.server_now]);
  const skew = useRef(0);
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    skew.current = serverNow - Date.now();
    const tick = () => setNow(Date.now() + skew.current);
    const first = setTimeout(tick, 0);
    const t = setInterval(tick, 1000);
    return () => {
      clearTimeout(first);
      clearInterval(t);
    };
  }, [serverNow]);
  const remaining = deadline - (now ?? serverNow);
  const timeUp = now !== null && remaining <= 0;

  // ---------- submission ----------
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, startSubmit] = useTransition();

  const doSubmit = useCallback(() => {
    startSubmit(async () => {
      setSubmitError(null);
      if (retryTimer.current) clearTimeout(retryTimer.current);
      backoff.current = 0;
      await flush();
      if (Object.keys(dirty.current).length && !timeUp) {
        setSubmitError("Some answers haven't reached our server yet. Check your connection and try again.");
        return;
      }
      const res = await submitAttempt(attemptId);
      if (!res.ok) {
        setSubmitError(res.message ?? "Submission failed. Please try again.");
        return;
      }
      setClosed(true);
      goToResults();
    });
  }, [attemptId, flush, goToResults, timeUp]);

  const autoSubmitted = useRef(false);
  useEffect(() => {
    if (timeUp && !autoSubmitted.current) {
      autoSubmitted.current = true;
      doSubmit();
    }
  }, [timeUp, doSubmit]);

  // Warn before leaving with unsynced answers.
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (Object.keys(dirty.current).length) e.preventDefault();
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, []);

  // ---------- navigation ----------
  const [navOpen, setNavOpen] = useState(false);
  const go = useCallback((i: number) => setIndex(Math.max(0, Math.min(total - 1, i))), [total]);

  // Multi-module exams (Literacy) show a module page at the start and between modules.
  const multiModule = payload.sections.length > 1;
  const [intro, setIntro] = useState<string | null>(() =>
    multiModule && payload.answers.every((a) => !a.option_id) ? questions[0].section_id : null,
  );
  const next = useCallback(() => {
    const upcoming = questions[index + 1];
    if (!upcoming) return;
    if (multiModule && upcoming.section_id !== questions[index].section_id) setIntro(upcoming.section_id);
    go(index + 1);
  }, [questions, index, multiModule, go]);
  const lastInModule = multiModule && index < total - 1 && questions[index + 1].section_id !== current.section_id;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (intro) {
        if (e.key === "Enter") setIntro(null);
        return;
      }
      if (confirmOpen || navOpen || e.metaKey || e.ctrlKey || e.altKey) return;
      const target = e.target as HTMLElement | null;
      if (target && /input|textarea|select/i.test(target.tagName)) return;
      if (e.key === "ArrowRight") next();
      else if (e.key === "ArrowLeft") go(index - 1);
      else if (e.key.toLowerCase() === "f") update(current.id, { flagged: !currentState.flagged });
      else {
        const opt = current.options.find((o) => o.label.toLowerCase() === e.key.toLowerCase());
        if (opt) update(current.id, { option: opt.id });
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [intro, confirmOpen, navOpen, go, next, index, current, currentState.flagged, update]);

  const answeredCount = questions.filter((q) => state[q.id]?.option).length;
  const flaggedCount = questions.filter((q) => state[q.id]?.flagged).length;
  const section = sectionsById.get(current.section_id);
  const stimulus = current.stimulus_id ? stimuliById.get(current.stimulus_id) : undefined;
  const lowTime = remaining < 5 * 60 * 1000;
  const criticalTime = remaining < 60 * 1000;

  // Questions sharing this stimulus (e.g. "Questions 25–27 refer to…").
  const groupRange = useMemo(() => {
    if (!current.stimulus_id) return null;
    const group = questions.filter((q) => q.stimulus_id === current.stimulus_id);
    return group.length > 1 ? [group[0].position, group[group.length - 1].position] : null;
  }, [current.stimulus_id, questions]);

  // ---------- paper tools ----------
  const [ratio, setRatio] = useStored("16h:split", 0.5);
  const [fontScale, setFontScale] = useStored("16h:fs", 1);
  const [crossed, setCrossed] = useStored<Record<string, string[]>>(`16h:x:${attemptId}`, {});
  const [notes, setNotes] = useStored<Record<string, string>>(`16h:notes:${attemptId}`, {});
  const [passageTall, setPassageTall] = useState(false);
  const hl = useHighlights(attemptId, [current.id, stimulus?.id, intro, fontScale]);
  const toggleCross = (optionId: string) =>
    setCrossed((all) => {
      const list = all[current.id] ?? [];
      return { ...all, [current.id]: list.includes(optionId) ? list.filter((x) => x !== optionId) : [...list, optionId] };
    });

  // Keep each passage's scroll position while moving between its questions; new questions start at the top.
  const passageRef = useRef<HTMLElement>(null);
  const questionRef = useRef<HTMLDivElement>(null);
  const scrollMemory = useRef<Record<string, number>>({});
  const stimulusId = stimulus?.id;
  useLayoutEffect(() => {
    if (passageRef.current && stimulusId) passageRef.current.scrollTop = scrollMemory.current[stimulusId] ?? 0;
  }, [stimulusId, intro]);
  useEffect(() => {
    questionRef.current?.scrollTo({ top: 0 });
  }, [current.id]);

  return (
    <div className="flex h-dvh flex-col bg-paper">
      <SelectionToolbar onApply={hl.apply} />
      {/* Top bar */}
      <header className="flex h-14 shrink-0 items-center gap-3 border-b border-line bg-white px-3 sm:px-5">
        <LogoMark className="h-7 w-7 shrink-0" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-ink-950">{payload.exam.title}</p>
          <p className="truncate text-xs text-ink-500">
            {payload.exam.subject.name}
            {payload.sections.length > 1 && section ? ` · ${section.title}` : ""}
          </p>
        </div>
        <ToolsMenu
          fontScale={fontScale}
          setFontScale={setFontScale}
          highlightCount={hl.count}
          onClearHighlights={hl.clearAll}
          highlightSupported={hl.supported}
          hasPassage={!!stimulus}
          onLayout={setRatio}
        />
        <SyncIndicator status={syncStatus} />
        <div
          role="timer"
          aria-live={criticalTime ? "assertive" : "off"}
          aria-label={`Time remaining ${formatClock(remaining)}`}
          className={cn(
            "tabular rounded-[var(--radius-sm)] px-3 py-1.5 text-[0.9375rem] font-semibold",
            criticalTime ? "bg-mark-500 text-white" : lowTime ? "bg-warning-50 text-warning-700" : "bg-paper-2 text-ink-950",
          )}
        >
          {formatClock(remaining)}
        </div>
        <button
          type="button"
          onClick={() => setConfirmOpen(true)}
          className="hidden h-9 rounded-[var(--radius-md)] bg-ink-950 px-4 text-sm font-medium text-paper hover:bg-ink-800 sm:block"
        >
          Submit
        </button>
      </header>

      {/* Content */}
      <main className="min-h-0 flex-1">
        {intro ? (
          <ModuleIntro
            sections={payload.sections}
            questions={questions}
            state={state}
            sectionId={intro}
            remaining={formatClock(remaining)}
            onStart={() => setIntro(null)}
            onReviewPrevious={(i) => {
              setIntro(null);
              go(i);
            }}
          />
        ) : stimulus ? (
          <div
            className="flex h-full flex-col md:grid md:grid-cols-[var(--pa)_14px_minmax(0,1fr)]"
            style={{ "--pa": `${ratio * 100}%` } as React.CSSProperties}
          >
            <section
              ref={passageRef}
              aria-label="Passage"
              onScroll={(e) => (scrollMemory.current[stimulus.id] = e.currentTarget.scrollTop)}
              className={cn(
                "relative shrink-0 overflow-y-auto border-b border-line bg-white px-5 py-6 sm:px-8 md:max-h-none md:border-b-0 md:py-10",
                passageTall ? "max-h-[68vh]" : "max-h-[40vh]",
              )}
            >
              <div style={{ zoom: fontScale }}>
                {groupRange ? (
                  <p className="mb-4 text-xs font-semibold uppercase tracking-[0.12em] text-ink-500">
                    Questions {groupRange[0]}–{groupRange[1]} refer to the following
                  </p>
                ) : null}
                {stimulus.title ? <h2 className="font-display text-xl font-medium text-ink-950">{stimulus.title}</h2> : null}
                {stimulus.attribution ? <p className="mt-1 text-sm italic text-ink-500">{stimulus.attribution}</p> : null}
                <PassageBody content={stimulus.content} marker={current.stimulus_marker} scope={`p:${stimulus.id}`} container={passageRef} />
              </div>
            </section>
            <button
              type="button"
              onClick={() => setPassageTall((t) => !t)}
              className="flex shrink-0 items-center justify-center gap-1.5 border-b border-line bg-paper-2 py-1.5 text-xs font-semibold text-ink-600 md:hidden"
            >
              {passageTall ? "▲ Show more question" : "▼ Show more passage"}
            </button>
            <SplitHandle onChange={setRatio} onReset={() => setRatio(0.5)} />
            <div ref={questionRef} className="min-h-0 flex-1 overflow-y-auto">
              <div style={{ zoom: fontScale }}>
                <QuestionPane
                  key={current.id}
                  question={current}
                  total={total}
                  state={currentState}
                  onSelect={(optionId) => update(current.id, { option: optionId })}
                  disabled={closed || timeUp}
                  crossed={crossed[current.id] ?? []}
                  onCross={toggleCross}
                  note={notes[current.id] ?? ""}
                  onNote={(v) => setNotes((all) => ({ ...all, [current.id]: v }))}
                />
              </div>
            </div>
          </div>
        ) : (
          <div ref={questionRef} className="h-full overflow-y-auto">
            <div className="mx-auto max-w-3xl" style={{ zoom: fontScale }}>
              <QuestionPane
                key={current.id}
                question={current}
                total={total}
                state={currentState}
                onSelect={(optionId) => update(current.id, { option: optionId })}
                disabled={closed || timeUp}
                  crossed={crossed[current.id] ?? []}
                  onCross={toggleCross}
                  note={notes[current.id] ?? ""}
                  onNote={(v) => setNotes((all) => ({ ...all, [current.id]: v }))}
              />
            </div>
          </div>
        )}
      </main>

      {/* Bottom bar */}
      <footer className={cn("shrink-0 border-t border-line bg-white", intro && "hidden")}>
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-2 px-3 sm:px-5">
          <button
            type="button"
            onClick={() => go(index - 1)}
            disabled={index === 0}
            className="h-10 rounded-[var(--radius-md)] px-3 text-sm font-medium text-ink-700 ring-1 ring-inset ring-line-strong hover:bg-paper-2 disabled:opacity-40 sm:px-4"
          >
            ← <span className="hidden sm:inline">Previous</span>
          </button>
          <button
            type="button"
            onClick={() => setNavOpen(true)}
            className="flex h-10 flex-1 items-center justify-center gap-2 rounded-[var(--radius-md)] text-sm font-medium text-ink-800 hover:bg-paper-2"
            aria-haspopup="dialog"
          >
            <span className="tabular">
              Question {current.position} of {total}
            </span>
            <svg viewBox="0 0 16 16" className="h-4 w-4 text-ink-500" fill="none" stroke="currentColor" strokeWidth="1.6">
              <path d="m4 10 4-4 4 4" />
            </svg>
          </button>
          <button
            type="button"
            onClick={() => update(current.id, { flagged: !currentState.flagged })}
            aria-pressed={currentState.flagged}
            className={cn(
              "flex h-10 items-center gap-1.5 rounded-[var(--radius-md)] px-3 text-sm font-medium ring-1 ring-inset sm:px-4",
              currentState.flagged
                ? "bg-warning-50 text-warning-700 ring-warning-500"
                : "text-ink-700 ring-line-strong hover:bg-paper-2",
            )}
          >
            <FlagIcon />
            <span className="hidden sm:inline">{currentState.flagged ? "Flagged" : "Flag"}</span>
          </button>
          {index < total - 1 ? (
            <button
              type="button"
              onClick={next}
              className={cn(
                "h-10 rounded-[var(--radius-md)] px-4 text-sm font-medium text-paper sm:px-5",
                lastInModule ? "bg-mark-500 hover:bg-mark-600" : "bg-ink-950 hover:bg-ink-800",
              )}
            >
              <span className="hidden sm:inline">{lastInModule ? "Finish module" : "Next"}</span> →
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmOpen(true)}
              className="h-10 rounded-[var(--radius-md)] bg-ink-950 px-4 text-sm font-medium text-paper hover:bg-ink-800 sm:px-5"
            >
              Review & submit
            </button>
          )}
        </div>
      </footer>

      {navOpen ? (
        <Navigator
          questions={questions}
          sections={payload.sections}
          state={state}
          currentId={current.id}
          answered={answeredCount}
          flagged={flaggedCount}
          onPick={(i) => {
            go(i);
            setNavOpen(false);
          }}
          onClose={() => setNavOpen(false)}
          onSubmit={() => {
            setNavOpen(false);
            setConfirmOpen(true);
          }}
        />
      ) : null}

      {confirmOpen || timeUp ? (
        <SubmitDialog
          timeUp={timeUp}
          total={total}
          answered={answeredCount}
          flagged={flaggedCount}
          unanswered={questions.filter((q) => !state[q.id]?.option).map((q) => q.position)}
          submitting={submitting}
          error={submitError}
          onCancel={() => setConfirmOpen(false)}
          onSubmit={doSubmit}
          onJump={(position) => {
            go(position - 1);
            setConfirmOpen(false);
          }}
        />
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------------------

function QuestionPane({
  question,
  total,
  state,
  onSelect,
  disabled,
  crossed,
  onCross,
  note,
  onNote,
}: {
  question: AttemptPayload["questions"][number];
  total: number;
  state: QState;
  onSelect: (optionId: string | null) => void;
  disabled: boolean;
  crossed: string[];
  onCross: (optionId: string) => void;
  note: string;
  onNote: (v: string) => void;
}) {
  const [notesOpen, setNotesOpen] = useState(Boolean(note));
  return (
    <section aria-labelledby="question-heading" className="px-5 py-7 sm:px-10 sm:py-10">
      <div className="flex items-center justify-between">
        <h1 id="question-heading" className="text-sm font-medium text-ink-500">
          Question {question.position} <span className="sr-only">of {total}</span>
        </h1>
        {state.flagged ? (
          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-warning-700">
            <FlagIcon className="h-3.5 w-3.5" /> Flagged for review
          </span>
        ) : null}
      </div>
      <div data-hl-scope={`q:${question.id}`}>
        <RichContentView content={question.stem} className="mt-4 font-reading text-[1.1875rem] leading-relaxed text-ink-950" />
      </div>

      <fieldset className="mt-7" disabled={disabled}>
        <legend className="sr-only">Answer choices</legend>
        <div className="grid gap-2.5" data-hl-scope={`qo:${question.id}`}>
          {question.options.map((o) => {
            const selected = state.option === o.id;
            const out = crossed.includes(o.id) && !selected;
            return (
              <div key={o.id} className="flex items-stretch gap-2">
                <label
                  className={cn(
                    "group flex min-w-0 flex-1 cursor-pointer items-start gap-4 rounded-[var(--radius-md)] px-4 py-3.5 ring-1 ring-inset transition",
                    selected ? "bg-ink-950 text-paper ring-ink-950" : "bg-white ring-line-strong hover:ring-ink-700",
                    out && "opacity-45",
                    disabled && "cursor-not-allowed opacity-60",
                  )}
                >
                  <input
                    type="radio"
                    name={`q-${question.id}`}
                    value={o.id}
                    checked={selected}
                    onChange={() => {
                      if (crossed.includes(o.id)) onCross(o.id);
                      onSelect(o.id);
                    }}
                    className="sr-only"
                  />
                  <span
                    aria-hidden="true"
                    className={cn(
                      "mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm font-semibold",
                      selected ? "bg-paper text-ink-950" : "bg-paper-2 text-ink-700 group-hover:bg-paper-3",
                    )}
                  >
                    {o.label}
                  </span>
                  <RichContentView
                    content={o.content}
                    className={cn("min-w-0 flex-1 font-reading text-[1.0625rem] leading-relaxed [&_p]:my-0", out && "line-through decoration-danger-600 decoration-2")}
                  />
                </label>
                <button
                  type="button"
                  onClick={() => onCross(o.id)}
                  disabled={disabled}
                  aria-pressed={out}
                  aria-label={out ? `Bring back choice ${o.label}` : `Cross out choice ${o.label}`}
                  title={out ? "Bring back" : "Cross out"}
                  className={cn(
                    "flex w-10 shrink-0 items-center justify-center rounded-[var(--radius-md)] text-sm font-bold ring-1 ring-inset transition",
                    out ? "bg-danger-50 text-danger-600 ring-danger-600/40" : "text-ink-400 ring-line hover:text-danger-600 hover:ring-danger-600/40",
                  )}
                >
                  {out ? "↺" : "✕"}
                </button>
              </div>
            );
          })}
        </div>
      </fieldset>

      <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2">
        {state.option && !disabled ? (
          <button type="button" onClick={() => onSelect(null)} className="text-sm text-ink-500 underline-offset-4 hover:text-ink-950 hover:underline">
            Clear answer
          </button>
        ) : null}
        <button type="button" onClick={() => setNotesOpen((o) => !o)} className="text-sm font-medium text-mark-500 hover:underline">
          {notesOpen ? "Hide my notes" : note ? "📝 Show my notes" : "📝 Add a note"}
        </button>
      </div>
      {notesOpen ? (
        <textarea
          value={note}
          onChange={(e) => onNote(e.target.value)}
          rows={4}
          placeholder="Scratch work, reminders, why you picked an answer… (saved on this device)"
          className="mt-3 w-full resize-y rounded-[var(--radius-md)] bg-[#FFFBEA] px-4 py-3 leading-relaxed ring-1 ring-inset ring-[#F2E2A0] outline-none focus:ring-2 focus:ring-warning-500"
          style={{ fontFamily: "var(--f-hand), cursive", fontSize: "1.25rem" }}
        />
      ) : null}
    </section>
  );
}

function ModuleIntro({
  sections,
  questions,
  state,
  sectionId,
  remaining,
  onStart,
  onReviewPrevious,
}: {
  sections: AttemptPayload["sections"];
  questions: AttemptPayload["questions"];
  state: Record<string, QState>;
  sectionId: string;
  remaining: string;
  onStart: () => void;
  onReviewPrevious: (index: number) => void;
}) {
  const i = sections.findIndex((s) => s.id === sectionId);
  const section = sections[i];
  const prev = i > 0 ? sections[i - 1] : null;
  const inModule = questions.filter((q) => q.section_id === sectionId);
  const prevQs = prev ? questions.filter((q) => q.section_id === prev.id) : [];
  const prevAnswered = prevQs.filter((q) => state[q.id]?.option).length;
  const label = `Module ${i + 1}`;

  return (
    <div className="flex h-full items-center justify-center overflow-y-auto px-5 py-10">
      <div className="w-full max-w-lg text-center">
        {/* Module progress */}
        <div className="flex items-center justify-center gap-2" aria-hidden="true">
          {sections.map((s, j) => (
            <span
              key={s.id}
              className={cn(
                "h-2 rounded-full transition-all",
                j < i ? "w-8 bg-success-600" : j === i ? "w-12 bg-mark-500" : "w-8 bg-paper-3",
              )}
            />
          ))}
        </div>

        {prev ? (
          <div
            className={cn(
              "mt-8 inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-sm font-medium",
              prevAnswered === prevQs.length ? "bg-success-50 text-success-700" : "bg-warning-50 text-warning-700",
            )}
          >
            <span aria-hidden>{prevAnswered === prevQs.length ? "✓" : "!"}</span> Module {i} finished · {prevAnswered} of {prevQs.length} answered
          </div>
        ) : null}

        <p className="mt-8 text-sm font-semibold uppercase tracking-[0.14em] text-mark-500">
          {label} of {sections.length}
        </p>
        <h2 className="mt-3 font-display text-5xl leading-tight text-ink-950">
          {section.title && section.title !== label ? section.title : prev ? "Next module" : "Let's begin"}
        </h2>

        <dl className="mx-auto mt-8 grid max-w-sm grid-cols-2 gap-px overflow-hidden rounded-[var(--radius-lg)] bg-line ring-1 ring-line">
          <div className="bg-white px-4 py-4">
            <dd className="font-display text-3xl tabular text-ink-950">{inModule.length}</dd>
            <dt className="mt-1 text-xs text-ink-500">Questions</dt>
          </div>
          <div className="bg-white px-4 py-4">
            <dd className="font-display text-3xl tabular text-ink-950">
              {inModule[0]?.position}–{inModule[inModule.length - 1]?.position}
            </dd>
            <dt className="mt-1 text-xs text-ink-500">Question numbers</dt>
          </div>
        </dl>

        <p className="mt-6 text-sm leading-relaxed text-ink-600">
          The timer keeps running ({remaining} left). You can come back to earlier modules at any time from the question list.
        </p>

        <button
          type="button"
          onClick={onStart}
          autoFocus
          className="mt-8 h-12 w-full max-w-sm rounded-[var(--radius-md)] bg-mark-500 text-base font-semibold text-white shadow-md transition hover:bg-mark-600"
        >
          Start {label} →
        </button>
        {prev && prevAnswered < prevQs.length ? (
          <button
            type="button"
            onClick={() => onReviewPrevious(questions.findIndex((q) => q.section_id === prev.id && !state[q.id]?.option))}
            className="mt-3 block w-full text-sm font-medium text-ink-600 underline-offset-4 hover:text-ink-950 hover:underline"
          >
            Go back to the {prevQs.length - prevAnswered} unanswered in Module {i}
          </button>
        ) : null}
      </div>
    </div>
  );
}

function PassageBody({
  content,
  marker,
  scope,
  container,
}: {
  content: AttemptPayload["stimuli"][number]["content"];
  marker: number | null;
  scope: string;
  container: React.RefObject<HTMLElement | null>;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (marker == null) return;
    const el = ref.current?.querySelector<HTMLElement>(`[data-marker="${marker}"]`);
    const box = container.current;
    if (!el || !box) return;
    const a = el.getBoundingClientRect();
    const b = box.getBoundingClientRect();
    // Only move the passage when the tested words are out of view, so the reader keeps their place.
    if (a.top < b.top + 24 || a.bottom > b.bottom - 24) el.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [marker, container]);
  return (
    <div ref={ref} data-hl-scope={scope}>
      <RichContentView content={content} activeMarker={marker} className="mt-5 font-reading text-[1.0625rem] leading-[1.8] text-ink-900" />
    </div>
  );
}

function SyncIndicator({ status }: { status: SyncStatus }) {
  const label = status === "saved" ? "All answers saved" : status === "saving" ? "Saving…" : "Reconnecting — answers kept on this device";
  return (
    <span className="inline-flex items-center gap-2 text-xs text-ink-500" aria-live="polite" title={label}>
      <span
        className={cn(
          "h-2 w-2 rounded-full",
          status === "saved" ? "bg-success-600" : status === "saving" ? "bg-ink-400" : "animate-pulse bg-warning-500",
        )}
      />
      <span className="hidden md:inline">{label}</span>
    </span>
  );
}

function Navigator({
  questions,
  sections,
  state,
  currentId,
  answered,
  flagged,
  onPick,
  onClose,
  onSubmit,
}: {
  questions: AttemptPayload["questions"];
  sections: AttemptPayload["sections"];
  state: Record<string, QState>;
  currentId: string;
  answered: number;
  flagged: number;
  onPick: (index: number) => void;
  onClose: () => void;
  onSubmit: () => void;
}) {
  useEscape(onClose);
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink-950/40 sm:items-center" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Question navigator"
        className="max-h-[85dvh] w-full overflow-y-auto rounded-t-[var(--radius-xl)] bg-white p-6 shadow-[var(--shadow-pop)] sm:max-w-2xl sm:rounded-[var(--radius-xl)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="font-display text-2xl font-medium text-ink-950">Questions</h2>
            <p className="mt-1 text-sm text-ink-500 tabular">
              {answered} answered · {questions.length - answered} unanswered · {flagged} flagged
            </p>
          </div>
          <button type="button" onClick={onClose} className="rounded-[var(--radius-sm)] p-1.5 text-ink-500 hover:bg-paper-2" aria-label="Close">
            <svg viewBox="0 0 16 16" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.6">
              <path d="m4 4 8 8M12 4l-8 8" />
            </svg>
          </button>
        </div>

        <Legend />

        {sections.map((section) => {
          const qs = questions.filter((q) => q.section_id === section.id);
          if (!qs.length) return null;
          return (
            <div key={section.id} className="mt-6">
              {sections.length > 1 ? <h3 className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-ink-500">{section.title}</h3> : null}
              <div className="grid grid-cols-8 gap-1.5 sm:grid-cols-10">
                {qs.map((q) => {
                  const s = state[q.id];
                  const isCurrent = q.id === currentId;
                  return (
                    <button
                      key={q.id}
                      type="button"
                      onClick={() => onPick(questions.indexOf(q))}
                      aria-current={isCurrent ? "step" : undefined}
                      aria-label={`Question ${q.position}${s?.option ? ", answered" : ", unanswered"}${s?.flagged ? ", flagged" : ""}`}
                      className={cn(
                        "relative flex h-10 items-center justify-center rounded-[var(--radius-sm)] text-sm font-medium tabular transition-colors",
                        isCurrent
                          ? "bg-ink-950 text-paper"
                          : s?.option
                            ? "bg-ink-700/10 text-ink-900 hover:bg-ink-700/20"
                            : "text-ink-500 ring-1 ring-inset ring-line-strong hover:bg-paper-2",
                      )}
                    >
                      {q.position}
                      {s?.flagged ? <span className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-warning-500" /> : null}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}

        <div className="mt-8 flex justify-end">
          <button
            type="button"
            onClick={onSubmit}
            className="h-10 rounded-[var(--radius-md)] bg-ink-950 px-5 text-sm font-medium text-paper hover:bg-ink-800"
          >
            Review & submit
          </button>
        </div>
      </div>
    </div>
  );
}

function Legend() {
  return (
    <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-xs text-ink-600">
      <span className="inline-flex items-center gap-1.5">
        <span className="h-3 w-3 rounded-[3px] bg-ink-700/15" /> Answered
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span className="h-3 w-3 rounded-[3px] ring-1 ring-inset ring-line-strong" /> Unanswered
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span className="h-1.5 w-1.5 rounded-full bg-warning-500" /> Flagged
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span className="h-3 w-3 rounded-[3px] bg-ink-950" /> Current
      </span>
    </div>
  );
}

function SubmitDialog({
  timeUp,
  total,
  answered,
  flagged,
  unanswered,
  submitting,
  error,
  onCancel,
  onSubmit,
  onJump,
}: {
  timeUp: boolean;
  total: number;
  answered: number;
  flagged: number;
  unanswered: number[];
  submitting: boolean;
  error: string | null;
  onCancel: () => void;
  onSubmit: () => void;
  onJump: (position: number) => void;
}) {
  useEscape(timeUp ? () => {} : onCancel);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink-950/50 p-4">
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="submit-title"
        className="w-full max-w-md rounded-[var(--radius-xl)] bg-white p-7 shadow-[var(--shadow-pop)]"
      >
        {timeUp ? (
          <>
            <h2 id="submit-title" className="font-display text-2xl font-medium text-ink-950">
              Time&apos;s up
            </h2>
            <p className="mt-2 text-ink-600">
              {submitting ? "Submitting your answers…" : "Your exam has ended. We're scoring your answers now."}
            </p>
            {error ? (
              <>
                <p className="mt-4 rounded-[var(--radius-md)] bg-danger-50 px-3.5 py-2.5 text-sm text-danger-600">{error}</p>
                <button
                  type="button"
                  onClick={onSubmit}
                  disabled={submitting}
                  className="mt-5 h-11 w-full rounded-[var(--radius-md)] bg-ink-950 text-sm font-medium text-paper hover:bg-ink-800 disabled:opacity-50"
                >
                  Try again
                </button>
              </>
            ) : null}
          </>
        ) : (
          <>
            <h2 id="submit-title" className="font-display text-2xl font-medium text-ink-950">
              Submit your exam?
            </h2>
            <dl className="mt-5 grid grid-cols-3 gap-px overflow-hidden rounded-[var(--radius-md)] bg-line ring-1 ring-line text-center">
              {[
                ["Answered", answered],
                ["Unanswered", total - answered],
                ["Flagged", flagged],
              ].map(([label, value]) => (
                <div key={label} className="bg-white px-2 py-3">
                  <dd className="font-display text-2xl font-medium tabular text-ink-950">{value}</dd>
                  <dt className="text-xs text-ink-500">{label}</dt>
                </div>
              ))}
            </dl>
            {unanswered.length ? (
              <div className="mt-5">
                <p className="text-sm text-ink-600">Unanswered questions:</p>
                <div className="mt-2 flex max-h-28 flex-wrap gap-1.5 overflow-y-auto">
                  {unanswered.map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => onJump(p)}
                      className="h-8 min-w-8 rounded-[var(--radius-sm)] px-2 text-sm font-medium tabular text-ink-700 ring-1 ring-inset ring-line-strong hover:bg-paper-2"
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <p className="mt-5 text-sm text-ink-600">You&apos;ve answered every question.</p>
            )}
            <p className="mt-5 text-sm text-ink-600">Once submitted, you can&apos;t change your answers.</p>
            {error ? <p className="mt-4 rounded-[var(--radius-md)] bg-danger-50 px-3.5 py-2.5 text-sm text-danger-600">{error}</p> : null}
            <div className="mt-6 flex gap-3">
              <button
                type="button"
                onClick={onCancel}
                className="h-11 flex-1 rounded-[var(--radius-md)] text-sm font-medium text-ink-800 ring-1 ring-inset ring-line-strong hover:bg-paper-2"
              >
                Keep working
              </button>
              <button
                type="button"
                onClick={onSubmit}
                disabled={submitting}
                className="h-11 flex-1 rounded-[var(--radius-md)] bg-ink-950 text-sm font-medium text-paper hover:bg-ink-800 disabled:opacity-50"
              >
                {submitting ? "Submitting…" : "Submit exam"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function useEscape(handler: () => void) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && handler();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [handler]);
}

function FlagIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" className={className} fill="currentColor" aria-hidden="true">
      <path d="M3 1.5a.75.75 0 0 1 .75.75V3h8.69a.5.5 0 0 1 .4.8L11 6.25l1.84 2.45a.5.5 0 0 1-.4.8H3.75v5.25a.75.75 0 0 1-1.5 0V2.25A.75.75 0 0 1 3 1.5Z" />
    </svg>
  );
}

