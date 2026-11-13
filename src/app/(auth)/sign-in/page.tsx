import type { Metadata } from "next";
import { Suspense } from "react";
import { AuthForm } from "../auth-form";

export const metadata: Metadata = { title: "Sign in" };

export default function SignInPage({ searchParams }: PageProps<"/sign-in">) {
  return (
    <Suspense fallback={<div className="h-96" />}>
      <Form searchParams={searchParams} />
    </Suspense>
  );
}

async function Form({ searchParams }: { searchParams: PageProps<"/sign-in">["searchParams"] }) {
  const { next, error } = await searchParams;
  return (
    <>
      {error === "confirmation" ? (
        <p role="alert" className="mb-5 rounded-xl bg-warning-50 px-4 py-3 text-sm text-warning-700">
          That link has expired or was already used. Sign in below, or ask for a new link.
        </p>
      ) : null}
      <AuthForm mode="sign-in" next={typeof next === "string" ? next : undefined} />
    </>
  );
}
