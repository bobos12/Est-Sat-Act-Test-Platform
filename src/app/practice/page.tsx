import type { Metadata } from "next";
import { Suspense } from "react";
import { SiteFooter } from "@/components/site/footer";
import { SiteHeader } from "@/components/site/header";
import { requireViewer } from "@/lib/auth/session";
import type { BankOverview } from "@/lib/bank-types";
import { redirectIfRevoked } from "@/lib/auth/single-session";
import { createClient } from "@/lib/supabase/server";
import { BankHome } from "./bank-home";

export const metadata: Metadata = {
  title: "Question bank",
  description: "Practise EST, SAT and ACT questions by topic and difficulty, with instant explanations.",
  robots: { index: false },
};

export default function PracticePage({ searchParams }: PageProps<"/practice">) {
  return (
    <>
      <SiteHeader />
      <main className="flex-1">
        <div className="mx-auto max-w-6xl px-4 pb-24 pt-6 sm:px-6 sm:pt-10">
          <Suspense fallback={<BankSkeleton />}>
            <Bank searchParams={searchParams} />
          </Suspense>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}

async function Bank({ searchParams }: { searchParams: PageProps<"/practice">["searchParams"] }) {
  await requireViewer("/practice");
  const sp = await searchParams;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("bank_overview");
  redirectIfRevoked(error, "/practice");
  if (error) throw new Error("We couldn't load the question bank. Please refresh.");
  const overview = data as BankOverview;
  return (
    <BankHome
      overview={overview}
      initialSubject={typeof sp.subject === "string" ? sp.subject : undefined}
      initialTopic={typeof sp.topic === "string" ? sp.topic : undefined}
      flash={typeof sp.error === "string" ? sp.error : undefined}
    />
  );
}

function BankSkeleton() {
  return (
    <div className="space-y-5">
      <div className="h-56 animate-pulse rounded-[28px] bg-ink-950/90" />
      <div className="h-12 w-2/3 animate-pulse rounded-2xl bg-paper-2" />
      <div className="grid gap-5 lg:grid-cols-[1fr_360px]">
        <div className="space-y-3">
          {Array.from({ length: 4 }, (_, i) => (
            <div key={i} className="h-24 animate-pulse rounded-2xl bg-paper-2" />
          ))}
        </div>
        <div className="h-[420px] animate-pulse rounded-[24px] bg-paper-2" />
      </div>
    </div>
  );
}
