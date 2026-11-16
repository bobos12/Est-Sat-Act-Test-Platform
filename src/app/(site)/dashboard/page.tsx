import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { CountUp } from "@/components/dashboard/count-up";
import { TimeLeft } from "@/components/dashboard/time-left";
import { requireViewer } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { requestTime } from "@/lib/time";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "My dashboard", robots: { index: false } };

export default function DashboardPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 pb-24 pt-6 sm:px-6 sm:pt-10">
      <Suspense fallback={<DashboardSkeleton />}>
        <Dashboard />
      </Suspense>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */
const TZ = "Africa/Cairo";
const dateFmt = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", timeZone: TZ });
const dayKey = (d: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(d); // YYYY-MM-DD
const scaled = (pct: number) => Math.round((400 + (400 * Math.min(100, Math.max(0, pct))) / 100) / 10) * 10;
const css = (vars: Record<string, string | number>) => vars as React.CSSProperties;
const band = (s: number) => (s >= 700 ? "text-success-600" : s >= 550 ? "text-mark-500" : "text-warning-700");
const bandBg = (s: number) => (s >= 700 ? "bg-success-600" : s >= 550 ? "bg-mark-500" : "bg-warning-500");

type Attempt = {
  id: string;
  status: string;
  started_at: string;
  submitted_at: string | null;
  deadline_at: string;
  percent: number | null;
  correct_count: number | null;
  question_count: number | null;
  result_summary: { by_topic?: { topic: string; correct: number; total: number }[] } | null;
  exams: { title: string; slug: string; subjects: { name: string; code: string } | { name: string; code: string }[] | null } | { title: string; slug: string }[] | null;
};

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */
async function Dashboard() {
  const viewer = await requireViewer("/dashboard");
  const supabase = await createClient();
  const [{ data }, { data: subs }] = await Promise.all([
    supabase
      .from("exam_attempts")
      .select("id, status, started_at, submitted_at, deadline_at, percent, correct_count, question_count, result_summary, exams(title, slug, subjects(name, code))")
      .order("started_at", { ascending: false })
      .limit(100),
    supabase.from("subscriptions").select("id, current_period_end").eq("status", "active").order("current_period_end", { ascending: false }).limit(1),
  ]);
  const now = requestTime();
  const attempts = ((data ?? []) as unknown as Attempt[]).map((a) => {
    const exam = Array.isArray(a.exams) ? a.exams[0] : a.exams;
    const subject = exam && "subjects" in exam ? (Array.isArray(exam.subjects) ? exam.subjects[0] : exam.subjects) : null;
    return { ...a, exam, subject };
  });
  const open = attempts.filter((a) => a.status === "in_progress" && Date.parse(a.deadline_at) > now);
  const done = attempts.filter((a) => a.status !== "in_progress" && a.percent != null);
  const scores = done.map((a) => scaled(Number(a.percent)));
  const latest = scores[0] ?? null;
  const previous = scores[1] ?? null;
  const best = scores.length ? Math.max(...scores) : null;
  const avg = scores.length ? Math.round(scores.reduce((t, s) => t + s, 0) / scores.length / 10) * 10 : null;
  const minutes = Math.round(
    done.reduce((t, a) => t + Math.min(240, Math.max(0, (Date.parse(a.submitted_at ?? a.started_at) - Date.parse(a.started_at)) / 60000)), 0),
  );

  // Streak: consecutive days (Cairo time) with at least one attempt, ending today or yesterday.
  const days = new Set(attempts.map((a) => dayKey(new Date(a.started_at))));
  let streak = 0;
  for (let i = 0; i < 400; i++) {
    const key = dayKey(new Date(now - i * 86400000));
    if (days.has(key)) streak++;
    else if (i > 0 || streak > 0) break;
  }

  // Topic mastery across every finished attempt.
  const topicMap = new Map<string, { correct: number; total: number }>();
  for (const a of done) for (const t of (a.result_summary?.by_topic ?? []).filter((x) => x.topic && !/^uncategori[sz]ed$/i.test(x.topic))) {
    const cur = topicMap.get(t.topic) ?? { correct: 0, total: 0 };
    topicMap.set(t.topic, { correct: cur.correct + t.correct, total: cur.total + t.total });
  }
  const topics = [...topicMap.entries()]
    .map(([topic, v]) => ({ topic, ...v, pct: v.total ? Math.round((100 * v.correct) / v.total) : 0 }))
    .sort((x, y) => x.pct - y.pct);
  const weakest = topics[0];

  // Trend: last 10 finished attempts, oldest first.
  const trend = done.slice(0, 10).reverse().map((a) => ({ s: scaled(Number(a.percent)), d: dateFmt.format(new Date(a.started_at)), t: a.exam?.title ?? "Exam" }));

  // Activity: last 26 weeks.
  const counts = new Map<string, number>();
  for (const a of attempts) counts.set(dayKey(new Date(a.started_at)), (counts.get(dayKey(new Date(a.started_at))) ?? 0) + 1);
  const today = new Date(now);
  const dow = (today.getUTCDay() + 6) % 7; // Monday = 0
  const startMs = now - (dow + 7 * 25) * 86400000;
  const grid = Array.from({ length: 182 }, (_, i) => {
    const d = new Date(startMs + i * 86400000);
    return { key: dayKey(d), n: counts.get(dayKey(d)) ?? 0, future: d.getTime() > now, label: dateFmt.format(d) };
  });
  const activeDays = grid.filter((g) => g.n > 0).length;

  const hour = Number(new Intl.DateTimeFormat("en-GB", { hour: "numeric", hour12: false, timeZone: TZ }).format(now));
  const greeting = hour < 5 ? "Burning the midnight oil" : hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  const firstName = viewer.fullName.split(" ")[0] || viewer.email.split("@")[0].split(/[._-]/)[0].replace(/^\w/, (c) => c.toUpperCase()) || "there";
  const activeSub = subs?.[0];
  const motivation =
    latest == null
      ? "Your first mock is the hardest step. Take it today and we'll map out the rest."
      : best != null && best >= 750
        ? "You're in elite territory. Keep sharpening the last few topics."
        : previous != null && latest > previous
          ? `Up ${latest - previous} points since last time. That's real progress.`
          : "Every attempt shows you exactly where the next points are hiding.";

  return (
    <div className="space-y-5 sm:space-y-6">
      {/* ---------------- Hero ---------------- */}
      <section className="dash-rise relative overflow-hidden rounded-[28px] bg-ink-950 text-paper" style={css({ "--d": "0s" })}>
        <div aria-hidden className="pointer-events-none absolute inset-0">
          <div className="dash-float absolute -left-20 -top-24 h-72 w-72 rounded-full bg-mark-500/35 blur-3xl" />
          <div className="dash-float absolute -bottom-28 right-10 h-80 w-80 rounded-full bg-sky/25 blur-3xl [animation-delay:-6s]" />
          <div
            className="absolute inset-0 opacity-[0.06]"
            style={{ backgroundImage: "linear-gradient(#fff 1px,transparent 1px),linear-gradient(90deg,#fff 1px,transparent 1px)", backgroundSize: "32px 32px" }}
          />
        </div>
        <div className="relative grid gap-8 p-6 sm:p-10 md:grid-cols-[1.25fr_1fr] md:items-center">
          <div>
            <p className="text-sm font-medium text-ink-300">{greeting},</p>
            <h1 className="mt-1 font-display text-4xl leading-[1.05] sm:text-5xl">
              {firstName} <span className="inline-block origin-[70%_70%] motion-safe:animate-[wave_2.2s_ease-in-out_1]">👋</span>
            </h1>
            <p className="mt-4 max-w-md text-[0.9375rem] leading-relaxed text-ink-300">{motivation}</p>
            <div className="mt-6 flex flex-wrap gap-2.5">
              {open[0] ? (
                <Link href={`/exam/${open[0].id}`} className="dash-glow inline-flex h-12 items-center gap-2 rounded-xl bg-mark-500 px-5 font-semibold text-white transition hover:bg-mark-600">
                  Resume exam →
                </Link>
              ) : (
                <Link href={latest == null ? "/exams?access=free" : "/exams"} className="inline-flex h-12 items-center gap-2 rounded-xl bg-mark-500 px-5 font-semibold text-white transition hover:bg-mark-600">
                  {latest == null ? "Take your first exam →" : "Start a new exam →"}
                </Link>
              )}
              {weakest ? (
                <Link href="/exams" className="inline-flex h-12 items-center rounded-xl bg-white/10 px-5 font-semibold text-white ring-1 ring-inset ring-white/15 transition hover:bg-white/15">
                  Practise {weakest.topic.length > 26 ? "your weakest topic" : weakest.topic}
                </Link>
              ) : null}
            </div>
            <p className="mt-5 text-xs text-ink-400">
              {viewer.hasPremium && activeSub?.current_period_end ? (
                <>★ Premium until {dateFmt.format(new Date(activeSub.current_period_end))}</>
              ) : (
                <>
                  Free plan ·{" "}
                  <Link href="/pricing" className="font-semibold text-sky hover:underline">
                    Unlock every exam
                  </Link>
                </>
              )}
            </p>
          </div>
          <ScoreRing score={latest} delta={latest != null && previous != null ? latest - previous : null} best={best} />
        </div>
      </section>

      {/* ---------------- Resume cards ---------------- */}
      {open.length ? (
        <section className="grid gap-3 sm:grid-cols-2">
          {open.map((a, i) => (
            <Link
              key={a.id}
              href={`/exam/${a.id}`}
              className="dash-rise dash-lift group flex items-center gap-4 rounded-2xl bg-white p-4 ring-2 ring-mark-500/60 sm:p-5"
              style={css({ "--d": `${0.1 + i * 0.06}s` })}
            >
              <span className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-mark-50 text-mark-500">
                <span className="absolute inset-0 rounded-xl motion-safe:animate-ping bg-mark-500/10" />
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden>
                  <circle cx="12" cy="13" r="8" />
                  <path d="M12 9v4l2.5 2.5M9 2h6" />
                </svg>
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-xs font-semibold uppercase tracking-[0.1em] text-mark-500">In progress</span>
                <span className="block truncate font-semibold text-ink-950">{a.exam?.title ?? "Exam"}</span>
                <span className="block text-sm text-ink-500">
                  <TimeLeft deadline={a.deadline_at} serverNow={now} />
                </span>
              </span>
              <span className="rounded-full bg-ink-950 px-3.5 py-1.5 text-sm font-semibold text-paper transition group-hover:bg-mark-500">Resume</span>
            </Link>
          ))}
        </section>
      ) : null}

      {/* ---------------- Stats ---------------- */}
      <section className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-5">
        {[
          { label: "Exams done", value: done.length, icon: "📝" },
          { label: "Average score", value: avg ?? 0, icon: "📈", empty: avg == null },
          { label: "Best score", value: best ?? 0, icon: "🏆", empty: best == null },
          { label: "Day streak", value: streak, icon: streak ? "🔥" : "✨", suffix: streak === 1 ? " day" : " days" },
          { label: "Time practised", value: minutes >= 60 ? Math.round(minutes / 6) / 10 : minutes, icon: "⏱️", suffix: minutes >= 60 ? " h" : " min", raw: minutes >= 60 },
        ].map((s, i) => (
          <div
            key={s.label}
            className={cn("dash-rise dash-lift rounded-2xl bg-white p-4 ring-1 ring-line sm:p-5", i === 4 && "col-span-2 lg:col-span-1")}
            style={css({ "--d": `${0.12 + i * 0.06}s` })}
          >
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-[0.1em] text-ink-500">{s.label}</p>
              <span aria-hidden className="text-lg">{s.icon}</span>
            </div>
            <p className="mt-3 font-display text-3xl text-ink-950 sm:text-4xl">
              {s.empty ? (
                <span className="text-ink-300">—</span>
              ) : s.raw ? (
                <span className="tabular">
                  {s.value}
                  {s.suffix}
                </span>
              ) : (
                <CountUp value={s.value} suffix={s.suffix} delay={150 + i * 60} />
              )}
            </p>
          </div>
        ))}
      </section>

      {/* ---------------- Trend + topics ---------------- */}
      <section className="grid gap-5 lg:grid-cols-[1.5fr_1fr]">
        <div className="dash-rise rounded-[24px] bg-white p-5 ring-1 ring-line sm:p-6" style={css({ "--d": ".25s" })}>
          <div className="flex flex-wrap items-end justify-between gap-2">
            <div>
              <h2 className="text-lg font-semibold text-ink-950">Score trend</h2>
              <p className="text-sm text-ink-500">Your scaled score (out of 800) over your recent exams</p>
            </div>
            {trend.length > 1 ? (
              <span className={cn("rounded-full px-3 py-1 text-xs font-bold", trend.at(-1)!.s >= trend[0].s ? "bg-success-50 text-success-700" : "bg-warning-50 text-warning-700")}>
                {trend.at(-1)!.s >= trend[0].s ? "▲" : "▼"} {Math.abs(trend.at(-1)!.s - trend[0].s)} pts
              </span>
            ) : null}
          </div>
          {trend.length ? <TrendChart points={trend} /> : <EmptyBlock text="Finish an exam to start your trend line." />}
        </div>

        <div className="dash-rise rounded-[24px] bg-white p-5 ring-1 ring-line sm:p-6" style={css({ "--d": ".32s" })}>
          <h2 className="text-lg font-semibold text-ink-950">Topic mastery</h2>
          <p className="text-sm text-ink-500">Across every exam you&apos;ve finished</p>
          {topics.length ? (
            <>
              {weakest ? (
                <div className="mt-4 flex items-center gap-3 rounded-2xl bg-mark-50 p-3.5">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-mark-500 text-lg text-white">🎯</span>
                  <span className="min-w-0 text-sm">
                    <span className="block text-xs font-semibold uppercase tracking-[0.1em] text-mark-500">Focus next</span>
                    <span className="block truncate font-semibold text-ink-950">{weakest.topic}</span>
                  </span>
                  <span className="ml-auto font-display text-xl tabular text-mark-500">{weakest.pct}%</span>
                </div>
              ) : null}
              <ul className="mt-4 space-y-3.5">
                {topics.slice(0, 6).map((t, i) => (
                  <li key={t.topic}>
                    <div className="flex items-baseline justify-between gap-3 text-sm">
                      <span className="truncate text-ink-800">{t.topic}</span>
                      <span className="shrink-0 tabular font-semibold text-ink-950">{t.pct}%</span>
                    </div>
                    <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-paper-3">
                      <div
                        className={cn("dash-grow h-full rounded-full", t.pct >= 75 ? "bg-success-600" : t.pct >= 50 ? "bg-mark-500" : "bg-warning-500")}
                        style={css({ width: `${Math.max(t.pct, 3)}%`, "--d": `${0.45 + i * 0.08}s` })}
                      />
                    </div>
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <EmptyBlock text="Your strongest and weakest topics will appear here." />
          )}
        </div>
      </section>

      {/* ---------------- Activity + plan ---------------- */}
      <section className="grid gap-5 lg:grid-cols-[1.5fr_1fr]">
        <div className="dash-rise rounded-[24px] bg-white p-5 ring-1 ring-line sm:p-6" style={css({ "--d": ".38s" })}>
          <div className="flex flex-wrap items-end justify-between gap-2">
            <div>
              <h2 className="text-lg font-semibold text-ink-950">Study activity</h2>
              <p className="text-sm text-ink-500">Last 6 months · {activeDays} active {activeDays === 1 ? "day" : "days"}</p>
            </div>
            <div className="flex items-center gap-1 text-xs text-ink-500">
              Less
              {[0, 1, 2, 3].map((n) => (
                <span key={n} className={cn("h-3 w-3 rounded-[3px]", heat(n))} />
              ))}
              More
            </div>
          </div>
          <div className="mt-5">
            <div className="grid w-full auto-cols-fr grid-flow-col grid-rows-7 gap-[3px] sm:gap-1">
              {grid.map((g, i) => (
                <span
                  key={g.key}
                  title={g.future ? "" : `${g.label}: ${g.n} ${g.n === 1 ? "exam" : "exams"}`}
                  className={cn("dash-fade aspect-square w-full rounded-[3px]", g.future ? "bg-transparent" : heat(g.n), g.key === dayKey(today) && "ring-2 ring-mark-500 ring-offset-1")}
                  style={css({ "--d": `${0.4 + i * 0.003}s` })}
                />
              ))}
            </div>
          </div>
        </div>

        <PlanCard premium={viewer.hasPremium} until={activeSub?.current_period_end ?? null} />
      </section>

      {/* ---------------- Timeline ---------------- */}
      <section className="dash-rise rounded-[24px] bg-white p-5 ring-1 ring-line sm:p-6" style={css({ "--d": ".45s" })}>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-ink-950">Your journey</h2>
            <p className="text-sm text-ink-500">Every exam you&apos;ve taken. Tap one to review it.</p>
          </div>
          <Link href="/exams" className="text-sm font-semibold text-mark-500 hover:underline">
            Browse exams →
          </Link>
        </div>
        {attempts.length ? (
          <>
          <ol className="relative mt-6 space-y-2 before:absolute before:bottom-3 before:left-[19px] before:top-3 before:w-0.5 before:bg-line">
            {attempts.slice(0, 6).map((a, i) => {
              const isOpen = a.status === "in_progress";
              const s = a.percent != null ? scaled(Number(a.percent)) : null;
              return (
                <li key={a.id} className="dash-rise relative" style={css({ "--d": `${0.5 + Math.min(i, 10) * 0.05}s` })}>
                  <Link href={isOpen ? `/exam/${a.id}` : `/results/${a.id}`} className="group flex items-center gap-4 rounded-2xl p-2 pr-3 transition hover:bg-paper">
                    <span
                      className={cn(
                        "relative z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white ring-4 ring-white",
                        isOpen ? "dash-glow bg-mark-500" : s != null ? bandBg(s) : "bg-ink-300",
                      )}
                    >
                      {isOpen ? "▶" : s != null ? (s >= 550 ? "✓" : "↗") : "–"}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium text-ink-950">{a.exam?.title ?? "Exam"}</span>
                      <span className="block text-xs text-ink-500">
                        {dateFmt.format(new Date(a.started_at))}
                        {a.subject ? ` · ${a.subject.name}` : ""}
                        {!isOpen && a.correct_count != null ? ` · ${a.correct_count}/${a.question_count} correct` : ""}
                      </span>
                    </span>
                    {isOpen ? (
                      <span className="rounded-full bg-mark-50 px-3 py-1 text-xs font-semibold text-mark-600">Resume</span>
                    ) : s != null ? (
                      <span className="text-right">
                        <span className={cn("block font-display text-2xl leading-none tabular", band(s))}>{s}</span>
                        <span className="text-[0.6875rem] text-ink-400">/ 800</span>
                      </span>
                    ) : null}
                    <span className="hidden text-ink-300 transition group-hover:translate-x-0.5 group-hover:text-ink-600 sm:inline">→</span>
                  </Link>
                </li>
              );
            })}
          </ol>
          {attempts.length > 6 ? (
            <details className="group mt-2">
              <summary className="flex cursor-pointer list-none items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-semibold text-mark-500 hover:bg-paper [&::-webkit-details-marker]:hidden">
                <span className="group-open:hidden">Show all {attempts.length} attempts ↓</span>
                <span className="hidden group-open:inline">Show less ↑</span>
              </summary>
              <ol className="relative mt-2 space-y-2 before:absolute before:bottom-3 before:left-[19px] before:top-3 before:w-0.5 before:bg-line">
                {attempts.slice(6, 60).map((a) => {
              const isOpen = a.status === "in_progress";
              const s = a.percent != null ? scaled(Number(a.percent)) : null;
              return (
                <li key={a.id} className="relative">
                  <Link href={isOpen ? `/exam/${a.id}` : `/results/${a.id}`} className="group flex items-center gap-4 rounded-2xl p-2 pr-3 transition hover:bg-paper">
                    <span
                      className={cn(
                        "relative z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white ring-4 ring-white",
                        isOpen ? "dash-glow bg-mark-500" : s != null ? bandBg(s) : "bg-ink-300",
                      )}
                    >
                      {isOpen ? "▶" : s != null ? (s >= 550 ? "✓" : "↗") : "–"}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium text-ink-950">{a.exam?.title ?? "Exam"}</span>
                      <span className="block text-xs text-ink-500">
                        {dateFmt.format(new Date(a.started_at))}
                        {a.subject ? ` · ${a.subject.name}` : ""}
                        {!isOpen && a.correct_count != null ? ` · ${a.correct_count}/${a.question_count} correct` : ""}
                      </span>
                    </span>
                    {isOpen ? (
                      <span className="rounded-full bg-mark-50 px-3 py-1 text-xs font-semibold text-mark-600">Resume</span>
                    ) : s != null ? (
                      <span className="text-right">
                        <span className={cn("block font-display text-2xl leading-none tabular", band(s))}>{s}</span>
                        <span className="text-[0.6875rem] text-ink-400">/ 800</span>
                      </span>
                    ) : null}
                    <span className="hidden text-ink-300 transition group-hover:translate-x-0.5 group-hover:text-ink-600 sm:inline">→</span>
                  </Link>
                </li>
              );
            })}
              </ol>
            </details>
          ) : null}
          </>
        ) : (
          <div className="mt-6 flex flex-col items-center rounded-2xl bg-paper px-6 py-12 text-center">
            <span className="text-5xl" aria-hidden>
              🚀
            </span>
            <p className="mt-4 font-display text-2xl text-ink-950">Your journey starts here</p>
            <p className="mt-2 max-w-sm text-sm text-ink-600">Take a free full-length exam. In about an hour you&apos;ll know your score out of 800 and exactly what to work on.</p>
            <Link href="/exams?access=free" className="mt-6 inline-flex h-12 items-center rounded-xl bg-mark-500 px-6 font-semibold text-white hover:bg-mark-600">
              Start a free exam →
            </Link>
          </div>
        )}
      </section>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Pieces                                                              */
/* ------------------------------------------------------------------ */
function heat(n: number) {
  return n >= 3 ? "bg-mark-600" : n === 2 ? "bg-mark-500" : n === 1 ? "bg-mark-100" : "bg-paper-3";
}

function ScoreRing({ score, delta, best }: { score: number | null; delta: number | null; best: number | null }) {
  const R = 78;
  const f = score == null ? 0 : (score - 400) / 400;
  return (
    <div className="flex items-center justify-center gap-6 md:justify-end">
      <div className="relative h-48 w-48 sm:h-52 sm:w-52">
        <svg viewBox="0 0 180 180" className="h-full w-full -rotate-90" aria-hidden>
          <defs>
            <linearGradient id="ringGrad" x1="0" x2="1" y1="0" y2="1">
              <stop offset="0%" stopColor="#7AA7FF" />
              <stop offset="100%" stopColor="#1559ED" />
            </linearGradient>
          </defs>
          <circle cx="90" cy="90" r={R} fill="none" stroke="rgba(255,255,255,.1)" strokeWidth="14" />
          {score != null ? (
            <circle
              cx="90"
              cy="90"
              r={R}
              fill="none"
              stroke="url(#ringGrad)"
              strokeWidth="14"
              strokeLinecap="round"
              pathLength={1}
              className="dash-draw"
              style={css({ strokeDasharray: `${f} 1`, "--d": ".35s" })}
            />
          ) : null}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
          <span className="text-[0.6875rem] font-semibold uppercase tracking-[0.14em] text-ink-400">Latest score</span>
          <span className="mt-1 font-display text-5xl leading-none">{score == null ? "—" : <CountUp value={score} delay={350} />}</span>
          <span className="mt-1 text-xs text-ink-400">out of 800</span>
          {delta != null ? (
            <span className={cn("mt-2 rounded-full px-2.5 py-0.5 text-xs font-bold", delta >= 0 ? "bg-success-600/20 text-[#7BE3A6]" : "bg-warning-500/20 text-[#F6C877]")}>
              {delta >= 0 ? "▲" : "▼"} {Math.abs(delta)}
            </span>
          ) : null}
        </div>
      </div>
      {best != null ? (
        <div className="hidden space-y-3 sm:block">
          <div>
            <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.12em] text-ink-400">Personal best</p>
            <p className="font-display text-3xl">{best}</p>
          </div>
          <div>
            <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.12em] text-ink-400">To 800</p>
            <p className="font-display text-3xl text-sky">{Math.max(0, 800 - best)}</p>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function TrendChart({ points }: { points: { s: number; d: string; t: string }[] }) {
  const W = 600;
  const H = 210;
  const pad = { l: 34, r: 14, t: 16, b: 28 };
  const x = (i: number) => (points.length === 1 ? (W - pad.l - pad.r) / 2 + pad.l : pad.l + (i * (W - pad.l - pad.r)) / (points.length - 1));
  const y = (s: number) => pad.t + ((800 - s) / 400) * (H - pad.t - pad.b);
  const line = points.map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(p.s).toFixed(1)}`).join(" ");
  const area = `${line} L${x(points.length - 1).toFixed(1)},${H - pad.b} L${x(0).toFixed(1)},${H - pad.b} Z`;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="mt-4 w-full overflow-visible" role="img" aria-label="Score trend chart">
      <defs>
        <linearGradient id="trendFill" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="#1559ED" stopOpacity=".22" />
          <stop offset="100%" stopColor="#1559ED" stopOpacity="0" />
        </linearGradient>
      </defs>
      {[400, 500, 600, 700, 800].map((v) => (
        <g key={v}>
          <line x1={pad.l} x2={W - pad.r} y1={y(v)} y2={y(v)} stroke={v === 700 ? "#12A150" : "#E2E7F1"} strokeDasharray={v === 700 ? "5 5" : undefined} strokeWidth="1" />
          <text x={pad.l - 8} y={y(v) + 4} textAnchor="end" fontSize="11" fill="#7A8499">
            {v}
          </text>
        </g>
      ))}
      <text x={W - pad.r} y={y(700) - 6} textAnchor="end" fontSize="11" fontWeight="600" fill="#12A150">
        Goal 700
      </text>
      <path d={area} fill="url(#trendFill)" className="dash-fade" style={css({ "--d": "1s" })} />
      <path d={line} fill="none" stroke="#1559ED" strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" pathLength={1} className="dash-draw" style={css({ "--d": ".4s" })} />
      {points.map((p, i) => (
        <g key={i} className="group">
          <circle cx={x(i)} cy={y(p.s)} r="16" fill="transparent" />
          <circle cx={x(i)} cy={y(p.s)} r="5.5" fill="#fff" stroke="#1559ED" strokeWidth="3" className="dash-pop transition-all group-hover:[r:8]" style={css({ "--d": `${0.9 + i * 0.07}s` })} />
          <g className="pointer-events-none opacity-0 transition-opacity group-hover:opacity-100">
            <rect x={x(i) - 46} y={y(p.s) - 46} width="92" height="32" rx="8" fill="#0A0F1C" />
            <text x={x(i)} y={y(p.s) - 31} textAnchor="middle" fontSize="12" fontWeight="700" fill="#fff">
              {p.s} / 800
            </text>
            <text x={x(i)} y={y(p.s) - 19} textAnchor="middle" fontSize="9.5" fill="#9AA5BE">
              {p.d}
            </text>
          </g>
          {points.length <= 8 || i % 2 === 0 ? (
            <text x={x(i)} y={H - 8} textAnchor="middle" fontSize="10.5" fill="#7A8499">
              {p.d}
            </text>
          ) : null}
        </g>
      ))}
    </svg>
  );
}

function PlanCard({ premium, until }: { premium: boolean; until: string | null }) {
  return premium ? (
    <div className="dash-rise relative overflow-hidden rounded-[24px] bg-gradient-to-br from-mark-500 to-mark-600 p-6 text-white" style={css({ "--d": ".42s" })}>
      <div aria-hidden className="dash-float absolute -right-10 -top-10 h-40 w-40 rounded-full bg-white/15 blur-2xl" />
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-white/70">Your plan</p>
      <p className="mt-2 font-display text-3xl">Premium ★</p>
      <p className="mt-1 text-sm text-white/80">{until ? `Every exam unlocked until ${dateFmt.format(new Date(until))}.` : "Every exam unlocked."}</p>
      <Link href="/exams" className="mt-6 inline-flex h-11 items-center rounded-xl bg-white px-5 text-sm font-semibold text-mark-600 hover:bg-paper">
        Pick your next exam →
      </Link>
    </div>
  ) : (
    <div className="dash-rise relative overflow-hidden rounded-[24px] bg-ink-950 p-6 text-paper" style={css({ "--d": ".42s" })}>
      <div aria-hidden className="dash-float absolute -right-12 -top-12 h-44 w-44 rounded-full bg-mark-500/40 blur-3xl" />
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-ink-400">Free plan</p>
      <p className="mt-2 font-display text-3xl leading-tight">Unlock every full mock</p>
      <ul className="mt-4 space-y-1.5 text-sm text-ink-300">
        <li>✓ Every EST, SAT and ACT exam</li>
        <li>✓ Explanations and topic scores</li>
        <li>✓ From 192 EGP a month</li>
      </ul>
      <Link href="/pricing" className="mt-6 inline-flex h-11 items-center rounded-xl bg-mark-500 px-5 text-sm font-semibold text-white hover:bg-mark-600">
        See plans →
      </Link>
    </div>
  );
}

function EmptyBlock({ text }: { text: string }) {
  return <div className="mt-5 flex h-40 items-center justify-center rounded-2xl border border-dashed border-line-strong text-sm text-ink-500">{text}</div>;
}

function DashboardSkeleton() {
  return (
    <div className="space-y-5">
      <div className="h-72 animate-pulse rounded-[28px] bg-ink-950/90" />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        {Array.from({ length: 5 }, (_, i) => (
          <div key={i} className="h-28 animate-pulse rounded-2xl bg-paper-2" />
        ))}
      </div>
      <div className="h-80 animate-pulse rounded-[24px] bg-paper-2" />
    </div>
  );
}
