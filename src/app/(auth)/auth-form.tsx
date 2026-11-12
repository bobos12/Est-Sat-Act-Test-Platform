"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Field, FormMessage, Input } from "@/components/ui/field";
import { signIn, signUp, type AuthState } from "./actions";

export function AuthForm({ mode, next }: { mode: "sign-in" | "sign-up"; next?: string }) {
  const [state, action, pending] = useActionState<AuthState, FormData>(mode === "sign-in" ? signIn : signUp, undefined);
  const fe = state?.fieldErrors ?? {};

  if (state?.notice) return <FormMessage tone="success">{state.notice}</FormMessage>;

  return (
    <form action={action} className="space-y-5" noValidate>
      {next ? <input type="hidden" name="next" value={next} /> : null}
      {state?.error ? <FormMessage>{state.error}</FormMessage> : null}

      {mode === "sign-up" ? (
        <Field label="Full name" htmlFor="fullName" error={fe.fullName}>
          <Input id="fullName" name="fullName" autoComplete="name" required aria-invalid={!!fe.fullName} />
        </Field>
      ) : null}

      <Field label="Email" htmlFor="email" error={fe.email}>
        <Input id="email" name="email" type="email" autoComplete="email" required aria-invalid={!!fe.email} />
      </Field>

      <Field
        label="Password"
        htmlFor="password"
        error={fe.password}
        hint={mode === "sign-up" ? "At least 8 characters, with a letter and a number." : undefined}
      >
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete={mode === "sign-up" ? "new-password" : "current-password"}
          required
          aria-invalid={!!fe.password}
        />
      </Field>

      <Button type="submit" size="lg" className="w-full" disabled={pending}>
        {pending ? "Please wait…" : mode === "sign-in" ? "Sign in" : "Create account"}
      </Button>

      <p className="text-center text-sm text-ink-600">
        {mode === "sign-in" ? (
          <>
            New to 16hundred?{" "}
            <Link href={`/sign-up${next ? `?next=${encodeURIComponent(next)}` : ""}`} className="font-medium text-ink-950 underline underline-offset-4">
              Create a free account
            </Link>
          </>
        ) : (
          <>
            Already have an account?{" "}
            <Link href={`/sign-in${next ? `?next=${encodeURIComponent(next)}` : ""}`} className="font-medium text-ink-950 underline underline-offset-4">
              Sign in
            </Link>
          </>
        )}
      </p>
    </form>
  );
}
