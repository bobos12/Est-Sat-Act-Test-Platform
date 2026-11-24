import type { Metadata } from "next";
import { Suspense } from "react";
import { AuthForm } from "../auth-form";

export const metadata: Metadata = { title: "Sign in", robots: { index: false, follow: true } };

export default function SignInPage({ searchParams }: PageProps<"/sign-in">) {
  return (
    <Suspense fallback={<div className="h-96" />}>
      <Form searchParams={searchParams} />
    </Suspense>
  );
}

async function Form({ searchParams }: { searchParams: PageProps<"/sign-in">["searchParams"] }) {
  const { next, error, reason } = await searchParams;
  return (
    <>
      {reason === "mfa_reset" ? (
        <p role="alert" className="mb-5 rounded-xl bg-success-50 px-4 py-3 text-sm text-success-700">
          2-step verification was reset. Sign in again, then scan the new QR code with your new phone.
        </p>
      ) : null}
      {reason === "elsewhere" ? (
        <p role="alert" className="mb-5 rounded-xl bg-warning-50 px-4 py-3 text-sm text-warning-700">
          You were signed out because your account was signed in on another device. Sign in again to continue here.
        </p>
      ) : null}
      {error === "confirmation" ? (
        <p role="alert" className="mb-5 rounded-xl bg-warning-50 px-4 py-3 text-sm text-warning-700">
          That link has expired or was already used. Sign in below, or ask for a new link.
        </p>
      ) : null}
      {error === "google" ? (
        <p role="alert" className="mb-5 rounded-xl bg-warning-50 px-4 py-3 text-sm text-warning-700">
          Google sign-in isn&apos;t available right now. Use your email below, or try again later.
        </p>
      ) : null}
      <AuthForm mode="sign-in" next={typeof next === "string" ? next : undefined} />
    </>
  );
}
