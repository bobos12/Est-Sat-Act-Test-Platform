import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { requireViewer } from "@/lib/auth/session";
import { redirectIfRevoked } from "@/lib/auth/single-session";
import type { AttemptPayload, ClosedPayload } from "@/lib/exam-types";
import { protectPayload, watermarkFor } from "@/lib/protect";
import { createClient } from "@/lib/supabase/server";
import { ExamRunner } from "./exam-runner";
import { ExamLoader } from "@/components/exam/exam-loader";
import { ContentGuard } from "@/components/exam/content-guard";

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
  const viewer = await requireViewer(`/exam/${attemptId}`);

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_attempt_payload", { p_attempt: attemptId });
  if (error) {
    redirectIfRevoked(error, `/exam/${attemptId}`);
    if (error.message.includes("ATTEMPT_NOT_FOUND") || error.code === "22P02") notFound();
    throw new Error("We couldn't load your exam. Please refresh the page.");
  }
  const payload = data as AttemptPayload | ClosedPayload;
  if (payload.attempt.status !== "in_progress") redirect(`/results/${attemptId}`);

  return (
    <>
      <ExamRunner payload={await protectPayload(payload as AttemptPayload, viewer.id)} />
      <ContentGuard {...watermarkFor(viewer.id)} />
    </>
  );
}

function ExamLoading() {
  return <ExamLoader />;
}
