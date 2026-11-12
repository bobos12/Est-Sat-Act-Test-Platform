import type { Metadata } from "next";
import { Suspense } from "react";
import { AuthForm } from "../auth-form";

export const metadata: Metadata = { title: "Create your account" };

export default function SignUpPage({ searchParams }: PageProps<"/sign-up">) {
  return (
    <>
      <h1 className="font-display text-3xl font-medium text-ink-950">Create your free account</h1>
      <p className="mb-8 mt-2 text-ink-600">Take your first EST mock exam in a few minutes. No card required.</p>
      <Suspense fallback={<div className="h-72" />}>
        <Form searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function Form({ searchParams }: { searchParams: PageProps<"/sign-up">["searchParams"] }) {
  const { next } = await searchParams;
  return <AuthForm mode="sign-up" next={typeof next === "string" ? next : undefined} />;
}
