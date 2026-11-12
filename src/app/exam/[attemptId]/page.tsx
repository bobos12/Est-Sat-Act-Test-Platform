import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { requireViewer } from "@/lib/auth/session";
import type { AttemptPayload, ClosedPayload } from "@/lib/exam-types";
import { createClient } from "@/lib/supabase/server";
import { ExamRunner } from "./exam-runner";

export const metadata: Metadata = { title: "Exam in progress", robots: { index: false } };

export default function ExamPage({ params }: PageProps<"/exam/[attemptId]">) {
  return (
    <Suspense fallback={<ExamLoading />}>
      <Exam params={params} />
    </Suspense>
  );
}

async function Exam({ params }: { params: PageProps<"/exam/[attemptId]">["params"] }) {
  const { attemptId } = await params;
  await requireViewer(`/exam/${attemptId}`);

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_attempt_payload", { p_attempt: attemptId });
  if (error) {
    if (error.message.includes("ATTEMPT_NOT_FOUND") || error.code === "22P02") notFound();
    throw new Error("We couldn't load your exam. Please refresh the page.");
  }
  const payload = data as AttemptPayload | ClosedPayload;
  if (payload.attempt.status !== "in_progress") redirect(`/results/${attemptId}`);

  return <ExamRunner payload={payload as AttemptPayload} />;
}

function ExamLoading() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-paper">
      <p className="text-sm text-ink-500">Loading your exam…</p>
    </div>
  );
}
