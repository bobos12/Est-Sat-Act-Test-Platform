import type { Metadata } from "next";
import { Suspense } from "react";
import { AuthForm } from "../auth-form";

export const metadata: Metadata = { title: "Sign in" };

export default function SignInPage({ searchParams }: PageProps<"/sign-in">) {
  return (
    <>
      <h1 className="font-display text-3xl font-medium text-ink-950">Welcome back</h1>
      <p className="mb-8 mt-2 text-ink-600">Sign in to continue your EST preparation.</p>
      <Suspense fallback={<div className="h-72" />}>
        <Form searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function Form({ searchParams }: { searchParams: PageProps<"/sign-in">["searchParams"] }) {
  const { next, error } = await searchParams;
  return (
    <>
      {error === "confirmation" ? (
        <p role="alert" className="mb-5 rounded-[var(--radius-md)] bg-danger-50 px-3.5 py-2.5 text-sm text-danger-600">
          That confirmation link has expired or was already used. Sign in, or create your account again.
        </p>
      ) : null}
      <AuthForm mode="sign-in" next={typeof next === "string" ? next : undefined} />
    </>
  );
}
