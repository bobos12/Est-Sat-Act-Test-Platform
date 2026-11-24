import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { SiteFooter } from "@/components/site/footer";
import { SiteHeader } from "@/components/site/header";
import { requireViewer } from "@/lib/auth/session";
import { redirectIfRevoked } from "@/lib/auth/single-session";
import type { BankSessionPayload } from "@/lib/bank-types";
import { ContentGuard } from "@/components/exam/content-guard";
import { protectPayload, watermarkFor } from "@/lib/protect";
import { createClient } from "@/lib/supabase/server";
import { SessionResults } from "./session-results";
import { SessionRunner } from "./session-runner";

export const metadata: Metadata = { title: "Practice session", robots: { index: false } };

export default function PracticeSessionPage({ params }: PageProps<"/practice/[sessionId]">) {
  return (
    <Suspense fallback={<RunnerSkeleton />}>
      <Session params={params} />
    </Suspense>
  );
}

async function Session({ params }: { params: PageProps<"/practice/[sessionId]">["params"] }) {
  const { sessionId } = await params;
  const viewer = await requireViewer(`/practice/${sessionId}`);
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("bank_session", { p_session: sessionId });
  if (error) {
    redirectIfRevoked(error, `/practice/${sessionId}`);
    if (error.message.includes("SESSION_NOT_FOUND") || error.code === "22P02") notFound();
    throw new Error("We couldn't load this session. Please refresh.");
  }
  const payload = await protectPayload(data as BankSessionPayload, viewer.id);
  const guard = <ContentGuard {...watermarkFor(viewer.id)} />;

  if (payload.session.completed_at) {
    return (
      <>
        <SiteHeader />
        <main className="flex-1">
          <SessionResults payload={payload} />
        </main>
        <SiteFooter />
        {guard}
      </>
    );
  }
  return (
    <>
      <SessionRunner payload={payload} />
      {guard}
    </>
  );
}

function RunnerSkeleton() {
  return (
    <div className="min-h-screen bg-paper">
      <div className="h-14 border-b border-line bg-white" />
      <div className="mx-auto max-w-3xl space-y-4 px-5 py-10">
        <div className="h-6 w-40 animate-pulse rounded-lg bg-paper-2" />
        <div className="h-24 animate-pulse rounded-2xl bg-paper-2" />
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="h-14 animate-pulse rounded-xl bg-paper-2" />
        ))}
      </div>
    </div>
  );
}
