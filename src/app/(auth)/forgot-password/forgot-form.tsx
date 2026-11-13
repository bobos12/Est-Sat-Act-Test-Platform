"use client";

import Link from "next/link";
import { useActionState } from "react";
import { FormMessage } from "@/components/ui/field";
import { requestPasswordReset, type AuthState } from "../actions";
import { CheckInbox } from "../auth-form";

export function ForgotForm() {
  const [state, action, pending] = useActionState<AuthState, FormData>(requestPasswordReset, undefined);
  if (state?.notice === "reset" && state.email) return <CheckInbox email={state.email} kind="reset" />;
  return (
    <div>
      <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-mark-50 text-2xl">🔑</span>
      <h1 className="mt-5 font-display text-3xl font-medium text-ink-950 sm:text-4xl">Forgot your password?</h1>
      <p className="mb-7 mt-2 text-ink-600">No problem. Enter your email and we&apos;ll send you a link to choose a new one.</p>
      <form action={action} className="space-y-4" noValidate>
        {state?.error ? <FormMessage>{state.error}</FormMessage> : null}
        <div className="space-y-1.5">
          <label htmlFor="email" className="block text-sm font-medium text-ink-800">Email</label>
          <input
            id="email"
            name="email"
            type="email"
            inputMode="email"
            autoComplete="email"
            placeholder="you@example.com"
            aria-invalid={!!state?.fieldErrors?.email}
            className="h-12 w-full rounded-xl bg-white px-4 text-[0.9375rem] ring-1 ring-inset ring-line-strong placeholder:text-ink-400 focus:outline-none focus:ring-2 focus:ring-mark-500 aria-[invalid=true]:ring-danger-600"
          />
          {state?.fieldErrors?.email ? <p className="text-sm text-danger-600" role="alert">{state.fieldErrors.email}</p> : null}
        </div>
        <button type="submit" disabled={pending} className="h-12 w-full rounded-xl bg-mark-500 font-semibold text-white shadow-lg shadow-mark-500/25 hover:bg-mark-600 disabled:opacity-60">
          {pending ? "Sending…" : "Send reset link"}
        </button>
      </form>
      <p className="mt-8 text-center text-sm text-ink-600">
        Remembered it? <Link href="/sign-in" className="font-semibold text-mark-500 hover:underline">Back to sign in</Link>
      </p>
    </div>
  );
}
