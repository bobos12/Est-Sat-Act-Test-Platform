import type { Metadata } from "next";
import { Suspense } from "react";
import { AuthForm } from "../auth-form";

export const metadata: Metadata = { title: "Create your free account" };

export default function SignUpPage({ searchParams }: PageProps<"/sign-up">) {
  return (
    <Suspense fallback={<div className="h-96" />}>
      <Form searchParams={searchParams} />
    </Suspense>
  );
}

async function Form({ searchParams }: { searchParams: PageProps<"/sign-up">["searchParams"] }) {
  const { next } = await searchParams;
  return <AuthForm mode="sign-up" next={typeof next === "string" ? next : undefined} />;
}
