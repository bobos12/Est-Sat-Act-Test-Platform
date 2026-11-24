import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { getViewer } from "@/lib/auth/session";
import { difficultyLabel, getExamBySlug, getPublishedExams, getSubjects, getTopics, type CatalogExam, type Subject } from "@/lib/catalog";
import { absoluteUrl, breadcrumbs, isoDuration, JsonLd, ORG_ID, pageMetadata } from "@/lib/seo";
import { TRACK_CONTENT, trackOfFamily } from "@/lib/tracks";
import { createClient } from "@/lib/supabase/server";
import { startExam } from "../actions";
import { StartExamButton } from "../start-button";

/** A search-friendly description: the admin's own text when present, otherwise built from the facts. */
function examDescription(exam: CatalogExam, subject?: Subject) {
  const family = subject ? TRACK_CONTENT[trackOfFamily(subject.test_family)].name : "exam";
  const access = exam.access === "free" ? "Free with a TargetScore account." : "Included with TargetScore membership.";
  const own = exam.description?.trim();
  if (own) return `${own.replace(/\.?$/, ".")} Timed online with instant scoring and an explanation for every question.`;
  return `Take ${exam.title} online: ${exam.question_count} questions in ${exam.duration_minutes} minutes, timed like the real ${family}, with instant scoring and an explanation for every question. ${access}`;
}

export async function generateMetadata({ params }: PageProps<"/exams/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const exam = await getExamBySlug(slug);
  if (!exam) return { title: "Exam not found", robots: { index: false } };
  const subject = (await getSubjects()).find((s) => s.id === exam.subject_id);
  const title = /practice|mock|test/i.test(exam.title) ? `${exam.title} (Timed Online Practice)` : `${exam.title} Practice Test Online`;
  return pageMetadata({ title, description: examDescription(exam, subject).slice(0, 300), path: `/exams/${exam.slug}` });
}

export default function ExamDetailPage({ params, searchParams }: PageProps<"/exams/[slug]">) {
  return (
    <div className="mx-auto max-w-4xl px-5 pb-24 pt-10 sm:px-6 sm:pt-14">
      <Suspense fallback={<div className="mt-8 h-96 animate-pulse rounded-[var(--radius-lg)] bg-paper-2" />}>
        <ExamDetail params={params} searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function ExamDetail({ params, searchParams }: Pick<PageProps<"/exams/[slug]">, "params" | "searchParams">) {
  const { slug } = await params;
  const exam = await getExamBySlug(slug);
  if (!exam) notFound();

  const [subjects, topics] = await Promise.all([getSubjects(), getTopics()]);
  const subject = subjects.find((s) => s.id === exam.subject_id);
  const topic = topics.find((t) => t.id === exam.focus_topic_id);
  const isMath = subject?.code.includes("math");
  const track = TRACK_CONTENT[trackOfFamily(subject?.test_family ?? "")];
  const crumbs = [
    { name: "Home", path: "/" },
    { name: `${track.name} practice tests`, path: track.path },
    { name: exam.title, path: `/exams/${exam.slug}` },
  ];

  const facts = [
    { label: "Questions", value: String(exam.question_count) },
    { label: "Time", value: `${exam.duration_minutes} minutes` },
    { label: "Difficulty", value: exam.difficulty ? difficultyLabel[exam.difficulty] : "Mixed" },
    { label: "Format", value: exam.kind === "full_mock" ? "Full-length mock" : "Practice set" },
  ];

  const expectations = [
    "One question at a time, with a question map to jump anywhere.",
    "The countdown runs on our server and doesn't pause. When it reaches zero, your exam is submitted automatically.",
    "Every answer is saved as soon as you choose it — a refresh or lost connection won't lose your work.",
    "Flag questions you want to revisit before you submit.",
    isMath ? "A calculator is allowed, as on the real test." : "Passages stay on screen while you answer their questions.",
  ];

  return (
    <article>
      <nav aria-label="Breadcrumb" className="text-sm text-ink-500">
        <ol className="flex flex-wrap items-center gap-1.5">
          <li><Link href="/" className="hover:text-ink-950">Home</Link></li>
          <li aria-hidden="true">/</li>
          <li><Link href={track.path} className="hover:text-ink-950">{track.name} practice tests</Link></li>
          <li aria-hidden="true">/</li>
          <li aria-current="page" className="truncate text-ink-700">{exam.title}</li>
        </ol>
      </nav>
      <div className="mt-8 flex flex-wrap items-center gap-2">
        <span className="text-sm font-medium text-mark-500">{subject?.name}</span>
        {topic ? <span className="text-sm text-ink-500">· {topic.name}</span> : null}
      </div>
      <h1 className="mt-3 font-display text-4xl font-medium text-ink-950 sm:text-5xl">{exam.title}</h1>
      <div className="mt-4">{exam.access === "free" ? <Badge tone="free">Free</Badge> : <Badge tone="premium">Premium</Badge>}</div>
      {exam.description ? <p className="mt-6 max-w-2xl text-lg leading-relaxed text-ink-600">{exam.description}</p> : null}

      <dl className="mt-10 grid grid-cols-2 gap-px overflow-hidden rounded-[var(--radius-lg)] bg-line ring-1 ring-line sm:grid-cols-4">
        {facts.map((f) => (
          <div key={f.label} className="bg-white px-5 py-4">
            <dt className="text-xs font-medium uppercase tracking-[0.12em] text-ink-500">{f.label}</dt>
            <dd className="mt-1.5 font-medium text-ink-950">{f.value}</dd>
          </div>
        ))}
      </dl>

      <div className="mt-12 grid gap-10 md:grid-cols-[1.4fr_1fr]">
        <section>
          <h2 className="text-lg font-semibold text-ink-950">Before you begin</h2>
          <ul className="mt-4 space-y-3">
            {expectations.map((e) => (
              <li key={e} className="flex gap-3 leading-relaxed text-ink-700">
                <span className="mt-[0.6em] h-1.5 w-1.5 shrink-0 rounded-full bg-mark-500" />
                {e}
              </li>
            ))}
          </ul>
        </section>
        <aside className="self-start rounded-[var(--radius-lg)] bg-white p-6 ring-1 ring-line">
          <Suspense fallback={<div className="h-28" />}>
            <StartPanel exam={exam} searchParams={searchParams} />
          </Suspense>
        </aside>
      </div>

      <Suspense fallback={null}>
        <RelatedExams exam={exam} trackName={track.name} trackPath={track.path} />
      </Suspense>

      <JsonLd
        data={[
          {
            "@type": "LearningResource",
            "@id": `${absoluteUrl(`/exams/${exam.slug}`)}#resource`,
            name: exam.title,
            description: examDescription(exam, subject),
            url: absoluteUrl(`/exams/${exam.slug}`),
            learningResourceType: exam.kind === "full_mock" ? "Practice test" : "Practice questions",
            educationalLevel: "High school",
            inLanguage: "en",
            timeRequired: isoDuration(exam.duration_minutes),
            isAccessibleForFree: exam.access === "free",
            ...(subject ? { about: { "@type": "Thing", name: subject.name } } : {}),
            ...(topic ? { teaches: topic.name } : {}),
            audience: { "@type": "EducationalAudience", educationalRole: "student", audienceType: "American Diploma students" },
            provider: { "@id": ORG_ID },
          },
          breadcrumbs(crumbs),
        ]}
      />
    </article>
  );
}

/** Other published exams in the same subject, then the same track: internal links between related tests. */
async function RelatedExams({ exam, trackName, trackPath }: { exam: CatalogExam; trackName: string; trackPath: string }) {
  const [all, subjects] = await Promise.all([getPublishedExams(), getSubjects()]);
  const family = new Map(subjects.map((s) => [s.id, s.test_family]));
  const myTrack = trackOfFamily(family.get(exam.subject_id) ?? "");
  const others = all.filter((e) => e.id !== exam.id && trackOfFamily(family.get(e.subject_id) ?? "") === myTrack);
  const related = [...others.filter((e) => e.subject_id === exam.subject_id), ...others.filter((e) => e.subject_id !== exam.subject_id)].slice(0, 6);
  if (!related.length) return null;
  return (
    <section aria-labelledby="related" className="mt-16 border-t border-line pt-10">
      <h2 id="related" className="text-lg font-semibold text-ink-950">More {trackName} practice tests</h2>
      <ul className="mt-4 grid gap-2 sm:grid-cols-2">
        {related.map((e) => (
          <li key={e.id}>
            <Link href={`/exams/${e.slug}`} className="flex items-center justify-between gap-3 rounded-[var(--radius-md)] bg-white px-4 py-3 text-sm ring-1 ring-line hover:ring-ink-300">
              <span className="font-medium text-ink-900">{e.title}</span>
              <span className="shrink-0 text-ink-500">{e.question_count} Q · {e.duration_minutes} min</span>
            </Link>
          </li>
        ))}
      </ul>
      <Link href={trackPath} className="mt-5 inline-block text-sm font-medium text-mark-600 hover:text-mark-700">
        All {trackName} practice tests →
      </Link>
    </section>
  );
}

async function StartPanel({ exam, searchParams }: { exam: CatalogExam; searchParams: PageProps<"/exams/[slug]">["searchParams"] }) {
  const viewer = await getViewer();
  const next = `/exams/${exam.slug}`;

  if (!viewer) {
    return (
      <>
        <p className="font-medium text-ink-950">{exam.access === "free" ? "Free with an account" : "Premium exam"}</p>
        <p className="mt-1.5 text-sm text-ink-600">Create a free account to save your progress and see your results.</p>
        <ButtonLink href={`/sign-up?next=${encodeURIComponent(next)}`} className="mt-5 w-full" size="lg">
          Create free account
        </ButtonLink>
        <p className="mt-3 text-center text-sm text-ink-600">
          Have an account?{" "}
          <Link href={`/sign-in?next=${encodeURIComponent(next)}`} className="font-medium text-ink-950 underline underline-offset-4">
            Sign in
          </Link>
        </p>
      </>
    );
  }

  if (exam.access === "premium" && !viewer.hasPremium) {
    return (
      <>
        <p className="font-medium text-ink-950">Included with Premium</p>
        <p className="mt-1.5 text-sm text-ink-600">Subscribe to unlock this exam and the full mock library.</p>
        <ButtonLink href={`/pricing?exam=${encodeURIComponent(exam.slug)}`} className="mt-5 w-full" size="lg">
          See plans
        </ButtonLink>
      </>
    );
  }

  const supabase = await createClient();
  const { data: open } = await supabase
    .from("exam_attempts")
    .select("id, deadline_at")
    .eq("exam_id", exam.id)
    .eq("status", "in_progress")
    .maybeSingle();

  return (
    <form action={startExam}>
      <input type="hidden" name="examId" value={exam.id} />
      <input type="hidden" name="slug" value={exam.slug} />
      <p className="font-medium text-ink-950">{open ? "You have an exam in progress" : "Ready when you are"}</p>
      <p className="mt-1.5 text-sm text-ink-600">
        {open
          ? "Pick up exactly where you left off. The timer has kept running."
          : `The ${exam.duration_minutes}-minute timer starts as soon as you press Start.`}
      </p>
      {!open && (await searchParams).limit === "daily" ? (
        <p className="mt-3 rounded-[var(--radius-md)] bg-warning-50 px-3 py-2 text-sm text-warning-700">
          You&apos;ve started the maximum number of exams for today. You can start a new one within 24 hours.
        </p>
      ) : null}
      <StartExamButton resume={Boolean(open)} title={exam.title} />
    </form>
  );
}
