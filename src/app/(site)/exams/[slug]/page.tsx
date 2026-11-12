import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Badge } from "@/components/ui/badge";
import { Button, ButtonLink } from "@/components/ui/button";
import { getViewer } from "@/lib/auth/session";
import { difficultyLabel, getExamBySlug, getSubjects, getTopics, type CatalogExam } from "@/lib/catalog";
import { createClient } from "@/lib/supabase/server";
import { startExam } from "../actions";

export async function generateMetadata({ params }: PageProps<"/exams/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const exam = await getExamBySlug(slug);
  return exam ? { title: exam.title, description: exam.description || undefined } : { title: "Exam not found" };
}

export default function ExamDetailPage({ params }: PageProps<"/exams/[slug]">) {
  return (
    <div className="mx-auto max-w-4xl px-5 pb-24 pt-10 sm:px-6 sm:pt-14">
      <Link href="/exams" className="text-sm text-ink-500 hover:text-ink-950">
        ← Exam library
      </Link>
      <Suspense fallback={<div className="mt-8 h-96 animate-pulse rounded-[var(--radius-lg)] bg-paper-2" />}>
        <ExamDetail params={params} />
      </Suspense>
    </div>
  );
}

async function ExamDetail({ params }: { params: PageProps<"/exams/[slug]">["params"] }) {
  const { slug } = await params;
  const exam = await getExamBySlug(slug);
  if (!exam) notFound();

  const [subjects, topics] = await Promise.all([getSubjects(), getTopics()]);
  const subject = subjects.find((s) => s.id === exam.subject_id);
  const topic = topics.find((t) => t.id === exam.focus_topic_id);
  const isMath = subject?.code.includes("math");

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
    isMath ? "A calculator is allowed, as on the real EST I Math paper." : "Passages stay on screen while you answer their questions.",
  ];

  return (
    <article className="mt-8">
      <div className="flex flex-wrap items-center gap-2">
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
            <StartPanel exam={exam} />
          </Suspense>
        </aside>
      </div>
    </article>
  );
}

async function StartPanel({ exam }: { exam: CatalogExam }) {
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
      <Button type="submit" size="lg" className="mt-5 w-full">
        {open ? "Resume exam" : "Start exam"}
      </Button>
    </form>
  );
}
