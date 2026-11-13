import type { Metadata } from "next";
import { Suspense } from "react";
import { Welcome } from "./welcome";

export const metadata: Metadata = { title: "You're confirmed", robots: { index: false } };

export default function WelcomePage({ searchParams }: PageProps<"/welcome">) {
  return (
    <Suspense fallback={<div className="h-80" />}>
      <Inner searchParams={searchParams} />
    </Suspense>
  );
}

async function Inner({ searchParams }: { searchParams: PageProps<"/welcome">["searchParams"] }) {
  const { next } = await searchParams;
  const safe = typeof next === "string" && next.startsWith("/") && !next.startsWith("//") ? next : "/dashboard";
  return <Welcome next={safe} />;
}
