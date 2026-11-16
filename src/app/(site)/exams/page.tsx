import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Suspense } from "react";
import { getViewer } from "@/lib/auth/session";
import { difficultyLabel, getPublishedExams, getSubjects, getTopics, type CatalogExam, type Difficulty } from "@/lib/catalog";
import { TRACKS } from "@/lib/exam-catalog";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Exam library",
  description: "Browse EST, SAT and ACT mock exams by subject, topic, difficulty and access.",
};

type Filters = { track?: string; subject?: string; topic?: string; difficulty?: string; access?: string; q?: string; sort?: string };

const trackOf = (family: string) => (family === "SAT" ? "sat" : family === "ACT" ? "act" : "est");
const scaled = (pct: number) => Math.round((400 + (400 * Math.min(100, Math.max(0, pct))) / 100) / 10) * 10;
const css = (vars: Record<string, string | number>) => vars as React.CSSProperties;
const SUBJECT_TINT: Record<string, string> = {
  "est1-math": "#1559ED",
  "est1-literacy": "#0A1A3A",
  "est2-math1": "#6AA4FF",
  "est2-math2": "#3B7BFF",
  "est2-biology": "#14A6B8",
  "est2-chemistry": "#7C8BFF",
  "sat-math": "#0B3FC2",
  "sat-english": "#3B4458",
  "act-math": "#1559ED",
  "act-english": "#0A0F1C",
  "act-biology": "#14A6B8",
};

export default function ExamLibraryPage({ searchParams }: PageProps<"/exams">) {
  return (
    <div className="mx-auto max-w-6xl px-4 pb-24 pt-6 sm:px-6 sm:pt-10">
      <Suspense fallback={<LibrarySkeleton />}>
        <Library searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

function one(v: string | string[] | undefined) {
  return typeof v === "string" && v ? v : undefined;
}

async function Library({ searchParams }: { searchParams: PageProps<"/exams">["searchParams"] }) {
  const sp = await searchParams;
  const f: Filters = {
    track: one(sp.track),
    subject: one(sp.subject),
    topic: one(sp.topic),
    difficulty: one(sp.difficulty),
    access: one(sp.access),
    q: one(sp.q)?.trim().slice(0, 80),
    sort: one(sp.sort),
  };

  const [subjects, topics, exams, viewer] = await Promise.all([getSubjects(), getTopics(), getPublishedExams(), getViewer()]);

  // Personal status per exam (best score, open attempt) for signed-in students.
  const mine = new Map<string, { best: number | null; openId: string | null; tries: number }>();
  if (viewer) {
    const supabase = await createClient();
    const { data } = await supabase.from("exam_attempts").select("id, exam_id, status, percent").order("started_at", { ascending: false }).limit(300);
    for (const a of data ?? []) {
      const cur = mine.get(a.exam_id) ?? { best: null, openId: null, tries: 0 };
      if (a.status === "in_progress") cur.openId ??= a.id;
      else if (a.percent != null) {
        cur.tries++;
        cur.best = Math.max(cur.best ?? 0, scaled(Number(a.percent)));
      }
      mine.set(a.exam_id, cur);
    }
  }

  const subject = subjects.find((s) => s.code === f.subject);
  const track = f.track ?? (subject ? trackOf(subject.test_family) : undefined);
  const subjectById = new Map(subjects.map((s) => [s.id, s]));
  const trackOfExam = (e: CatalogExam) => trackOf(subjectById.get(e.subject_id)?.test_family ?? "");
  const activeSubjects = track ? subjects.filter((s) => trackOf(s.test_family) === track) : subjects;
  const examCount = new Map<string, number>();
  for (const e of exams) examCount.set(e.subject_id, (examCount.get(e.subject_id) ?? 0) + 1);
  const subjectTopics = topics.filter((t) => subject && t.subject_id === subject.id && t.kind !== "domain");
  const topicName = new Map(topics.map((t) => [t.id, t.name]));

  let visible = exams.filter((e) => {
    if (subject && e.subject_id !== subject.id) return false;
    if (track && trackOfExam(e) !== track) return false;
    if (f.topic && e.focus_topic_id !== f.topic) return false;
    if (f.difficulty && e.difficulty !== f.difficulty) return false;
    if (f.access && e.access !== f.access) return false;
    if (f.q && !e.title.toLowerCase().includes(f.q.toLowerCase())) return false;
    return true;
  });
  if (f.sort === "short") visible = [...visible].sort((a, b) => a.duration_minutes - b.duration_minutes);
  else if (f.sort === "long") visible = [...visible].sort((a, b) => b.question_count - a.question_count);
  else visible = [...visible].sort((a, b) => Number(b.access === "free") - Number(a.access === "free") || a.sort_order - b.sort_order);

  const href = (patch: Partial<Filters>) => {
    const next = { ...f, ...patch };
    if (patch.subject !== undefined) next.topic = undefined;
    if (patch.track !== undefined) next.subject = next.topic = undefined;
    const qs = new URLSearchParams(Object.entries(next).filter(([, v]) => v) as [string, string][]).toString();
    return qs ? `/exams?${qs}` : "/exams";
  };
  const filtered = Boolean(f.subject || f.topic || f.difficulty || f.access || f.q);
  const free = exams.filter((e) => e.access === "free").length;
  const questions = exams.reduce((n, e) => n + e.question_count, 0);
  const locked = viewer?.hasPremium ? 0 : visible.filter((e) => e.access === "premium").length;
  const soonName = subject && !examCount.get(subject.id) ? `${subject.name} exams` : track && !exams.some((e) => trackOfExam(e) === track) ? `${track.toUpperCase()} exams` : undefined;

  return (
    <div className="space-y-5 sm:space-y-6">
      {/* ---------------- Header ---------------- */}
      <section className="dash-rise relative overflow-hidden rounded-[28px] bg-ink-950 px-6 py-8 text-paper sm:px-10 sm:py-10">
        <div aria-hidden className="pointer-events-none absolute inset-0">
          <div className="dash-float absolute -right-16 -top-24 h-72 w-72 rounded-full bg-mark-500/35 blur-3xl" />
          <div className="dash-float absolute -bottom-32 left-1/4 h-72 w-72 rounded-full bg-sky/20 blur-3xl [animation-delay:-5s]" />
          <div className="absolute inset-0 opacity-[0.06]" style={{ backgroundImage: "linear-gradient(#fff 1px,transparent 1px),linear-gradient(90deg,#fff 1px,transparent 1px)", backgroundSize: "32px 32px" }} />
        </div>
        <div className="relative grid gap-6 md:grid-cols-[1.2fr_1fr] md:items-end">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-sky">Exam library</p>
            <h1 className="mt-2 font-display text-4xl leading-[1.05] sm:text-5xl">Pick your next exam.</h1>
            <p className="mt-3 max-w-md text-[0.9375rem] text-ink-300">Real timed mocks for EST, SAT and ACT, scored out of 800 with an explanation for every answer.</p>
            <dl className="mt-6 flex flex-wrap gap-x-7 gap-y-2 text-sm">
              <div><dt className="sr-only">Exams</dt><dd><b className="font-display text-2xl text-paper">{exams.length}</b> <span className="text-ink-400">exams</span></dd></div>
              <div><dt className="sr-only">Free</dt><dd><b className="font-display text-2xl text-paper">{free}</b> <span className="text-ink-400">free</span></dd></div>
              <div><dt className="sr-only">Questions</dt><dd><b className="font-display text-2xl text-paper">{questions.toLocaleString("en")}</b> <span className="text-ink-400">questions</span></dd></div>
            </dl>
          </div>
          <form action="/exams" className="relative">
            {Object.entries(f).map(([k, v]) => (k !== "q" && v ? <input key={k} type="hidden" name={k} value={v} /> : null))}
            <svg className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-ink-400" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden>
              <circle cx="11" cy="11" r="7" />
              <path d="M20 20l-3.5-3.5" />
            </svg>
            <input
              name="q"
              defaultValue={f.q}
              placeholder="Search exams, e.g. Math May 2026"
              aria-label="Search exams"
              className="h-14 w-full rounded-2xl bg-white pl-11 pr-28 text-[0.9375rem] text-ink-950 shadow-xl outline-none ring-2 ring-transparent placeholder:text-ink-400 focus:ring-mark-500"
            />
            <button className="absolute right-2 top-2 h-10 rounded-xl bg-mark-500 px-4 text-sm font-semibold text-white hover:bg-mark-600">Search</button>
          </form>
        </div>
      </section>

      {/* ---------------- Track picker ---------------- */}
      <nav aria-label="Track" className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Link
          href={href({ track: "" })}
          scroll={false}
          className={cn("dash-rise dash-lift flex flex-col justify-between rounded-2xl p-4 ring-1 transition", !track ? "bg-mark-500 text-white ring-mark-500" : "bg-white ring-line hover:ring-ink-300")}
          style={css({ "--d": ".05s" })}
        >
          <span className={cn("text-xs font-semibold uppercase tracking-[0.12em]", !track ? "text-white/70" : "text-ink-500")}>Everything</span>
          <span className="mt-6 flex items-baseline justify-between">
            <span className="font-display text-2xl">All tracks</span>
            <span className={cn("text-sm tabular", !track ? "text-white/80" : "text-ink-500")}>{exams.length}</span>
          </span>
        </Link>
        {TRACKS.map((t, i) => {
          const n = exams.filter((e) => trackOfExam(e) === t.key).length;
          const on = track === t.key;
          return (
            <Link
              key={t.key}
              href={href({ track: t.key })}
              scroll={false}
              className={cn("dash-rise dash-lift flex flex-col justify-between rounded-2xl bg-white p-4 ring-1 transition", on ? "ring-2 ring-mark-500 shadow-lg" : "ring-line hover:ring-ink-300")}
              style={css({ "--d": `${0.1 + i * 0.05}s` })}
            >
              <span className="flex items-start justify-between">
                <Image src={t.logo.src} alt={`${t.name} logo`} width={t.logo.w} height={t.logo.h} className="h-9 w-auto mix-blend-multiply" loading="eager" />
                {n ? (
                  <span className="rounded-full bg-success-50 px-2 py-0.5 text-[0.6875rem] font-bold text-success-700">{n} live</span>
                ) : (
                  <span className="rounded-full bg-paper-2 px-2 py-0.5 text-[0.6875rem] font-semibold text-ink-500">Soon</span>
                )}
              </span>
              <span className="mt-4 text-sm text-ink-600">{t.format}</span>
            </Link>
          );
        })}
      </nav>

      {/* ---------------- Filter bar ---------------- */}
      <section className="dash-rise space-y-3 rounded-2xl bg-white p-3 ring-1 ring-line sm:p-4" style={css({ "--d": ".25s" })}>
        <Row>
          <Pill href={href({ subject: "" })} on={!f.subject}>All subjects</Pill>
          {activeSubjects.map((s) => (
            <Pill key={s.id} href={href({ subject: s.code })} on={f.subject === s.code} dot={SUBJECT_TINT[s.code]}>
              {s.name}
              {examCount.get(s.id) ? <span className="tabular opacity-50">{examCount.get(s.id)}</span> : <span className="text-[0.6875rem] font-semibold opacity-60">soon</span>}
            </Pill>
          ))}
        </Row>
        {subject && subjectTopics.length ? (
          <Row>
            <span className="shrink-0 text-xs font-semibold uppercase tracking-[0.1em] text-ink-400">{subject.code === "est1-literacy" ? "Skill" : "Topic"}</span>
            <Pill href={href({ topic: "" })} on={!f.topic} small>All</Pill>
            {subjectTopics.map((t) => (
              <Pill key={t.id} href={href({ topic: t.id })} on={f.topic === t.id} small>
                {t.name}
              </Pill>
            ))}
          </Row>
        ) : null}
        <div className="flex min-w-0 flex-wrap items-center gap-2 border-t border-line pt-3">
          <Segmented
            items={[
              { label: "All", href: href({ access: "" }), on: !f.access },
              { label: "Free", href: href({ access: "free" }), on: f.access === "free" },
              { label: "🔒 Premium", href: href({ access: "premium" }), on: f.access === "premium" },
            ]}
          />
          <Segmented
            items={[
              { label: "Any level", href: href({ difficulty: "" }), on: !f.difficulty },
              ...(Object.keys(difficultyLabel) as Difficulty[]).map((d) => ({ label: difficultyLabel[d], href: href({ difficulty: d }), on: f.difficulty === d })),
            ]}
          />
          <div className="flex min-w-0 max-w-full items-center gap-2 text-sm sm:ml-auto">
            <span className="text-ink-500">Sort</span>
            <Segmented
              items={[
                { label: "Recommended", href: href({ sort: "" }), on: !f.sort },
                { label: "Shortest", href: href({ sort: "short" }), on: f.sort === "short" },
                { label: "Most questions", href: href({ sort: "long" }), on: f.sort === "long" },
              ]}
            />
          </div>
        </div>
      </section>

      {/* ---------------- Results ---------------- */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-1">
        <p className="text-sm text-ink-600" aria-live="polite">
          <b className="text-ink-950">{visible.length}</b> {visible.length === 1 ? "exam" : "exams"}
          {f.q ? <> matching “{f.q}”</> : null}
        </p>
        {filtered ? (
          <Link href={track ? `/exams?track=${track}` : "/exams"} className="text-sm font-semibold text-mark-500 hover:underline">
            Clear filters
          </Link>
        ) : null}
      </div>

      {visible.length ? (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {visible.map((e, i) => (
            <li key={e.id} className="dash-rise" style={css({ "--d": `${0.3 + Math.min(i, 9) * 0.05}s` })}>
              <ExamCard
                exam={e}
                subject={subjectById.get(e.subject_id)}
                topic={e.focus_topic_id ? topicName.get(e.focus_topic_id) : undefined}
                me={mine.get(e.id)}
                premium={Boolean(viewer?.hasPremium)}
              />
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState hasAny={exams.length > 0} soon={soonName} />
      )}

      {locked > 0 ? (
        <Link href="/pricing" className="dash-lift flex flex-col items-center gap-4 rounded-[24px] bg-ink-950 p-6 text-center text-paper sm:flex-row sm:text-left">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-mark-500 text-xl">🔓</span>
          <span className="flex-1">
            <b className="block text-lg">{locked} premium {locked === 1 ? "exam is" : "exams are"} waiting for you</b>
            <span className="text-sm text-ink-300">One membership unlocks every EST, SAT and ACT mock, from 192 EGP a month.</span>
          </span>
          <span className="rounded-xl bg-white px-5 py-2.5 text-sm font-semibold text-ink-950">See plans →</span>
        </Link>
      ) : null}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Exam card                                                           */
/* ------------------------------------------------------------------ */
function ExamCard({
  exam,
  subject,
  topic,
  me,
  premium,
}: {
  exam: CatalogExam;
  subject?: { name: string; code: string; test_family: string };
  topic?: string;
  me?: { best: number | null; openId: string | null; tries: number };
  premium: boolean;
}) {
  const tint = SUBJECT_TINT[subject?.code ?? ""] ?? "#1559ED";
  const free = exam.access === "free";
  const locked = !free && !premium;
  const href = me?.openId ? `/exam/${me.openId}` : `/exams/${exam.slug}`;
  const cta = me?.openId ? "Resume" : locked ? "Unlock" : me?.best != null ? "Retake" : free ? "Start free" : "Start";
  return (
    <Link
      href={href}
      className={cn(
        "group relative flex h-full flex-col overflow-hidden rounded-[22px] bg-white ring-1 transition duration-300 hover:-translate-y-1 hover:shadow-[0_24px_48px_-24px_rgba(10,26,58,.45)]",
        me?.openId ? "ring-2 ring-mark-500" : "ring-line hover:ring-ink-300",
      )}
    >
      {/* Colour band */}
      <div className="relative h-20 overflow-hidden" style={{ background: `linear-gradient(135deg, ${tint}, color-mix(in srgb, ${tint} 55%, #000))` }}>
        <div aria-hidden className="absolute -right-6 -top-10 h-32 w-32 rounded-full bg-white/15 transition-transform duration-500 group-hover:scale-125" />
        <div aria-hidden className="absolute -bottom-12 left-10 h-24 w-24 rounded-full bg-white/10" />
        <div className="relative flex items-start justify-between p-4">
          <span className="rounded-full bg-white/15 px-2.5 py-1 text-[0.6875rem] font-semibold uppercase tracking-[0.1em] text-white backdrop-blur">
            {subject?.test_family ?? "EST"} · {subject?.name.replace(/^(EST II?|SAT|ACT)\s*/, "") ?? ""}
          </span>
          {free ? (
            <span className="rounded-full bg-white px-2.5 py-1 text-[0.6875rem] font-bold text-mark-600">FREE</span>
          ) : locked ? (
            <span className="flex items-center gap-1 rounded-full bg-ink-950/60 px-2.5 py-1 text-[0.6875rem] font-bold text-white backdrop-blur">🔒 PRO</span>
          ) : (
            <span className="rounded-full bg-white/20 px-2.5 py-1 text-[0.6875rem] font-bold text-white">INCLUDED</span>
          )}
        </div>
      </div>

      <div className="flex flex-1 flex-col p-5">
        <h2 className="font-display text-[1.375rem] leading-snug text-ink-950">{exam.title}</h2>
        {topic ? <p className="mt-1 text-sm text-ink-500">{topic}</p> : null}
        <div className="mt-4 flex flex-wrap gap-1.5 text-xs font-medium text-ink-600">
          <Meta icon="◷">{exam.duration_minutes} min</Meta>
          <Meta icon="≡">{exam.question_count} questions</Meta>
          <Meta icon="◆">{exam.kind === "full_mock" ? "Full mock" : "Practice set"}</Meta>
          {exam.difficulty ? <Meta icon="▲">{difficultyLabel[exam.difficulty]}</Meta> : null}
        </div>

        {me?.openId ? (
          <p className="mt-4 flex items-center gap-2 rounded-xl bg-mark-50 px-3 py-2 text-sm font-semibold text-mark-600">
            <span className="h-2 w-2 rounded-full bg-mark-500 motion-safe:animate-pulse" /> In progress: pick up where you left off
          </p>
        ) : me?.best != null ? (
          <p className="mt-4 flex items-center justify-between rounded-xl bg-paper px-3 py-2 text-sm">
            <span className="text-ink-600">Your best · {me.tries} {me.tries === 1 ? "try" : "tries"}</span>
            <b className={cn("font-display text-lg", me.best >= 700 ? "text-success-600" : me.best >= 550 ? "text-mark-500" : "text-warning-700")}>{me.best}/800</b>
          </p>
        ) : null}

        <div className="mt-auto flex items-center justify-between pt-5">
          <span className="text-xs text-ink-500">{locked ? "Members only" : free ? "Free account" : "With your plan"}</span>
          <span
            className={cn(
              "inline-flex h-10 items-center gap-1.5 rounded-xl px-4 text-sm font-semibold transition",
              me?.openId ? "bg-mark-500 text-white" : locked ? "bg-ink-950 text-white group-hover:bg-mark-500" : "bg-mark-500 text-white group-hover:bg-mark-600",
            )}
          >
            {locked ? "🔒 " : ""}
            {cta}
            <span className="transition-transform group-hover:translate-x-0.5">→</span>
          </span>
        </div>
      </div>
    </Link>
  );
}

function Meta({ icon, children }: { icon: string; children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-lg bg-paper px-2 py-1">
      <span aria-hidden className="text-ink-400">{icon}</span>
      {children}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* Filter bits                                                         */
/* ------------------------------------------------------------------ */
function Row({ children }: { children: React.ReactNode }) {
  return <div className="-mx-1 flex items-center gap-1.5 overflow-x-auto px-1 pb-0.5 [scrollbar-width:none]">{children}</div>;
}

function Pill({ href, on, dot, small, children }: { href: string; on: boolean; dot?: string; small?: boolean; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      scroll={false}
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full font-medium transition",
        small ? "px-3 py-1 text-xs" : "px-3.5 py-2 text-sm",
        on ? "bg-ink-950 text-paper" : "bg-paper text-ink-700 hover:bg-paper-3",
      )}
    >
      {dot ? <span className="h-2 w-2 rounded-full" style={{ background: dot }} /> : null}
      {children}
    </Link>
  );
}

function Segmented({ items }: { items: { label: string; href: string; on: boolean }[] }) {
  return (
    <div className="flex min-w-0 max-w-full overflow-x-auto rounded-xl bg-paper p-1 [scrollbar-width:none]">
      {items.map((it) => (
        <Link
          key={it.label}
          href={it.href}
          scroll={false}
          className={cn("whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-medium transition", it.on ? "bg-white text-ink-950 shadow-sm" : "text-ink-500 hover:text-ink-950")}
        >
          {it.label}
        </Link>
      ))}
    </div>
  );
}

function EmptyState({ hasAny, soon }: { hasAny: boolean; soon?: string }) {
  if (soon) {
    return (
      <div className="flex flex-col items-center rounded-[24px] bg-white px-6 py-16 text-center ring-1 ring-line">
        <span className="text-5xl" aria-hidden>🛠️</span>
        <span className="mt-4 rounded-full bg-mark-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.12em] text-mark-500">Coming soon</span>
        <p className="mt-3 font-display text-2xl text-ink-950">{soon} are on the way</p>
        <p className="mx-auto mt-2 max-w-md text-sm text-ink-600">We&apos;re preparing full, timed mocks for this track. Meanwhile, every EST exam is open.</p>
        <Link href="/exams?track=est" className="mt-6 inline-flex h-11 items-center rounded-xl bg-mark-500 px-5 text-sm font-semibold text-white hover:bg-mark-600">
          Browse EST exams →
        </Link>
      </div>
    );
  }
  return (
    <div className="flex flex-col items-center rounded-[24px] border border-dashed border-line-strong px-6 py-16 text-center">
      <span className="text-5xl" aria-hidden>🔍</span>
      <p className="mt-4 font-display text-2xl text-ink-950">{hasAny ? "Nothing matches those filters" : "New exams are on the way"}</p>
      <p className="mx-auto mt-2 max-w-md text-sm text-ink-600">
        {hasAny ? "Try another subject or level, or clear the filters to see everything." : "The first mocks will appear here as soon as they're published."}
      </p>
      {hasAny ? (
        <Link href="/exams" className="mt-6 inline-flex h-11 items-center rounded-xl bg-ink-950 px-5 text-sm font-semibold text-paper hover:bg-ink-800">
          Clear filters
        </Link>
      ) : null}
    </div>
  );
}

function LibrarySkeleton() {
  return (
    <div className="space-y-5">
      <div className="h-64 animate-pulse rounded-[28px] bg-ink-950/90" />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="h-28 animate-pulse rounded-2xl bg-paper-2" />
        ))}
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="h-72 animate-pulse rounded-[22px] bg-paper-2" />
        ))}
      </div>
    </div>
  );
}
