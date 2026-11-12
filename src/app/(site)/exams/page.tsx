import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Badge } from "@/components/ui/badge";
import {
  difficultyLabel,
  getPublishedExams,
  getSubjects,
  getTopics,
  type CatalogExam,
  type Difficulty,
} from "@/lib/catalog";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Exam library",
  description: "Browse EST, SAT and ACT mock exams by subject, topic, difficulty and access.",
};

type Filters = { track?: string; subject?: string; topic?: string; difficulty?: string; access?: string };

const TRACK_LABEL: Record<string, string> = { est: "EST", sat: "SAT", act: "ACT" };
const trackOf = (family: string) => (family === "SAT" ? "sat" : family === "ACT" ? "act" : "est");

export default function ExamLibraryPage({ searchParams }: PageProps<"/exams">) {
  return (
    <div className="mx-auto max-w-6xl px-5 pb-24 pt-12 sm:px-6 sm:pt-16">
      <header className="max-w-2xl">
        <h1 className="font-display text-4xl font-medium text-ink-950 sm:text-5xl">Exam library</h1>
        <p className="mt-4 text-lg text-ink-600">
          Full-length mocks and focused practice sets for EST, SAT and ACT. Filter by track, subject and difficulty,
          then start whenever you&apos;re ready.
        </p>
      </header>
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
  const filters: Filters = {
    track: one(sp.track),
    subject: one(sp.subject),
    topic: one(sp.topic),
    difficulty: one(sp.difficulty),
    access: one(sp.access),
  };

  const [subjects, topics, exams] = await Promise.all([getSubjects(), getTopics(), getPublishedExams()]);
  const subject = subjects.find((s) => s.code === filters.subject);
  const track = filters.track ?? (subject ? trackOf(subject.test_family) : undefined);
  const activeSubjects = track ? subjects.filter((s) => trackOf(s.test_family) === track) : subjects;
  const trackSubjectIds = new Set(activeSubjects.map((s) => s.id));
  const examCount = new Map<string, number>();
  for (const e of exams) examCount.set(e.subject_id, (examCount.get(e.subject_id) ?? 0) + 1);
  const subjectTopics = topics.filter((t) => subject && t.subject_id === subject.id && t.kind !== "domain");

  const visible = exams.filter((e) => {
    if (subject && e.subject_id !== subject.id) return false;
    if (track && !trackSubjectIds.has(e.subject_id)) return false;
    if (filters.topic && e.focus_topic_id !== filters.topic) return false;
    if (filters.difficulty && e.difficulty !== filters.difficulty) return false;
    if (filters.access && e.access !== filters.access) return false;
    return true;
  });

  const subjectName = new Map(subjects.map((s) => [s.id, s.name]));
  const topicName = new Map(topics.map((t) => [t.id, t.name]));

  const href = (patch: Partial<Filters>) => {
    const next = { ...filters, ...patch };
    if (patch.subject !== undefined) next.topic = undefined; // topics belong to a subject
    if (patch.track !== undefined) next.subject = next.topic = undefined;
    const qs = new URLSearchParams(Object.entries(next).filter(([, v]) => v) as [string, string][]).toString();
    return qs ? `/exams?${qs}` : "/exams";
  };

  return (
    <div className="mt-12 grid gap-10 lg:grid-cols-[220px_1fr]">
      <aside aria-label="Filters" className="space-y-8">
        <FilterGroup title="Track">
          <FilterLink href={href({ track: "" })} active={!track}>All tracks</FilterLink>
          {Object.entries(TRACK_LABEL).map(([k, label]) => (
            <FilterLink key={k} href={href({ track: k })} active={track === k}>
              {label}
            </FilterLink>
          ))}
        </FilterGroup>

        <FilterGroup title="Subject">
          <FilterLink href={href({ subject: "" })} active={!filters.subject}>All subjects</FilterLink>
          {activeSubjects.map((s) => (
            <FilterLink key={s.id} href={href({ subject: s.code })} active={filters.subject === s.code}>
              {s.name}
              {examCount.get(s.id) ? null : <span className="ml-1.5 rounded-full bg-paper-3 px-1.5 py-0.5 text-[0.6875rem] font-semibold text-ink-500">Soon</span>}
            </FilterLink>
          ))}
        </FilterGroup>

        {subject && subjectTopics.length ? (
          <FilterGroup title={subject.code === "est1-literacy" ? "Skill" : "Topic"}>
            <FilterLink href={href({ topic: "" })} active={!filters.topic}>All</FilterLink>
            {subjectTopics.map((t) => (
              <FilterLink key={t.id} href={href({ topic: t.id })} active={filters.topic === t.id}>
                {t.name}
              </FilterLink>
            ))}
          </FilterGroup>
        ) : null}

        <FilterGroup title="Difficulty">
          <FilterLink href={href({ difficulty: "" })} active={!filters.difficulty}>Any</FilterLink>
          {(Object.keys(difficultyLabel) as Difficulty[]).map((d) => (
            <FilterLink key={d} href={href({ difficulty: d })} active={filters.difficulty === d}>
              {difficultyLabel[d]}
            </FilterLink>
          ))}
        </FilterGroup>

        <FilterGroup title="Access">
          <FilterLink href={href({ access: "" })} active={!filters.access}>All exams</FilterLink>
          <FilterLink href={href({ access: "free" })} active={filters.access === "free"}>Free</FilterLink>
          <FilterLink href={href({ access: "premium" })} active={filters.access === "premium"}>Premium</FilterLink>
        </FilterGroup>
      </aside>

      <section aria-live="polite">
        <p className="mb-4 text-sm text-ink-500">
          {visible.length} {visible.length === 1 ? "exam" : "exams"}
        </p>
        {visible.length ? (
          <ul className="divide-y divide-line overflow-hidden rounded-[var(--radius-lg)] bg-white ring-1 ring-line">
            {visible.map((exam) => (
              <ExamRow
                key={exam.id}
                exam={exam}
                subject={subjectName.get(exam.subject_id) ?? ""}
                topic={exam.focus_topic_id ? topicName.get(exam.focus_topic_id) : undefined}
              />
            ))}
          </ul>
        ) : (
          <EmptyState
            hasAny={exams.length > 0}
            soon={subject && !examCount.get(subject.id) ? `${subject.name} exams` : track && !visible.length && !filters.subject ? `${TRACK_LABEL[track]} exams` : undefined}
          />
        )}
      </section>
    </div>
  );
}

function ExamRow({ exam, subject, topic }: { exam: CatalogExam; subject: string; topic?: string }) {
  return (
    <li>
      <Link
        href={`/exams/${exam.slug}`}
        className="group flex flex-col gap-3 px-5 py-5 transition-colors hover:bg-paper sm:flex-row sm:items-center sm:gap-6 sm:px-6"
      >
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="font-medium text-ink-950">{exam.title}</h2>
            {exam.kind === "full_mock" ? <Badge>Full mock</Badge> : null}
          </div>
          <p className="mt-1 truncate text-sm text-ink-500">
            {subject}
            {topic ? ` · ${topic}` : ""}
          </p>
        </div>
        <dl className="flex shrink-0 items-center gap-5 text-sm text-ink-600">
          <div className="tabular">
            <dt className="sr-only">Questions</dt>
            <dd>{exam.question_count} Q</dd>
          </div>
          <div className="tabular">
            <dt className="sr-only">Duration</dt>
            <dd>{exam.duration_minutes} min</dd>
          </div>
          <div className="hidden w-24 sm:block">
            <dt className="sr-only">Difficulty</dt>
            <dd>{exam.difficulty ? difficultyLabel[exam.difficulty] : "Mixed"}</dd>
          </div>
          <div className="w-20 text-right">
            <dt className="sr-only">Access</dt>
            <dd>{exam.access === "free" ? <Badge tone="free">Free</Badge> : <Badge tone="premium">Premium</Badge>}</dd>
          </div>
        </dl>
      </Link>
    </li>
  );
}

function FilterGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h2 className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-ink-500">{title}</h2>
      <ul className="flex flex-wrap gap-1.5 lg:flex-col lg:gap-0.5">{children}</ul>
    </div>
  );
}

function FilterLink({ href, active, children }: { href: string; active: boolean; children: React.ReactNode }) {
  return (
    <li>
      <Link
        href={href}
        scroll={false}
        aria-current={active ? "true" : undefined}
        className={cn(
          "block rounded-[var(--radius-sm)] px-3 py-1.5 text-sm transition-colors lg:-mx-3",
          active ? "bg-ink-950 text-paper lg:bg-paper-2 lg:font-medium lg:text-ink-950" : "text-ink-600 hover:bg-paper-2 hover:text-ink-950",
        )}
      >
        {children}
      </Link>
    </li>
  );
}

function EmptyState({ hasAny, soon }: { hasAny: boolean; soon?: string }) {
  if (soon) {
    return (
      <div className="rounded-[var(--radius-lg)] bg-white px-6 py-16 text-center ring-1 ring-line">
        <span className="rounded-full bg-mark-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.12em] text-mark-500">Coming soon</span>
        <p className="mt-4 font-display text-2xl text-ink-950">{soon} are on the way</p>
        <p className="mx-auto mt-2 max-w-md text-sm text-ink-600">
          We&apos;re preparing full, timed mocks for this track. Meanwhile, every EST exam is open in the library.
        </p>
        <Link href="/exams?track=est" className="mt-5 inline-block text-sm font-medium text-ink-950 underline underline-offset-4">
          Browse EST exams
        </Link>
      </div>
    );
  }
  return (
    <div className="rounded-[var(--radius-lg)] border border-dashed border-line-strong px-6 py-16 text-center">
      <p className="font-medium text-ink-950">{hasAny ? "No exams match these filters." : "New exams are being prepared."}</p>
      <p className="mx-auto mt-2 max-w-md text-sm text-ink-600">
        {hasAny
          ? "Try a different topic or difficulty, or clear the filters to see everything."
          : "The first EST I mock exams are in review and will appear here as soon as they're published."}
      </p>
      {hasAny ? (
        <Link href="/exams" className="mt-5 inline-block text-sm font-medium text-ink-950 underline underline-offset-4">
          Clear filters
        </Link>
      ) : null}
    </div>
  );
}

function LibrarySkeleton() {
  return (
    <div className="mt-12 grid gap-10 lg:grid-cols-[220px_1fr]">
      <div className="h-80 animate-pulse rounded-[var(--radius-md)] bg-paper-2" />
      <div className="h-96 animate-pulse rounded-[var(--radius-lg)] bg-paper-2" />
    </div>
  );
}
