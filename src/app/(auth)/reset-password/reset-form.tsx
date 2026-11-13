"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { FormMessage } from "@/components/ui/field";
import { cn } from "@/lib/utils";
import { updatePassword, type AuthState } from "../actions";

export function ResetForm() {
  const [state, action, pending] = useActionState<AuthState, FormData>(updatePassword, undefined);
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const rules = [
    { ok: password.length >= 8, label: "8+ characters" },
    { ok: /[A-Za-z]/.test(password), label: "A letter" },
    { ok: /\d/.test(password), label: "A number" },
  ];
  return (
    <div>
      <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-mark-50 text-2xl">🔒</span>
      <h1 className="mt-5 font-display text-3xl font-medium text-ink-950 sm:text-4xl">Choose a new password</h1>
      <p className="mb-7 mt-2 text-ink-600">Pick something you&apos;ll remember. You&apos;ll be signed in right after.</p>
      <form action={action} className="space-y-4" noValidate>
        {state?.error ? (
          <FormMessage>
            {state.error}{" "}
            {state.error.includes("expired") ? <Link href="/forgot-password" className="font-semibold underline">Get a new link</Link> : null}
          </FormMessage>
        ) : null}
        <div className="relative">
          <input
            name="password"
            type={show ? "text" : "password"}
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="New password"
            aria-label="New password"
            className="h-12 w-full rounded-xl bg-white pl-4 pr-20 text-[0.9375rem] ring-1 ring-inset ring-line-strong focus:outline-none focus:ring-2 focus:ring-mark-500"
          />
          <button type="button" onClick={() => setShow((s) => !s)} className="absolute inset-y-1.5 right-1.5 rounded-lg px-3 text-xs font-semibold text-ink-600 hover:bg-paper-2">
            {show ? "Hide" : "Show"}
          </button>
        </div>
        {state?.fieldErrors?.password ? <p className="text-sm text-danger-600" role="alert">{state.fieldErrors.password}</p> : null}
        <ul className="flex flex-wrap gap-1.5">
          {rules.map((r) => (
            <li key={r.label} className={cn("rounded-full px-2.5 py-1 text-xs font-medium", r.ok ? "bg-success-600 text-white" : "bg-paper-2 text-ink-500")}>
              {r.ok ? "✓ " : ""}{r.label}
            </li>
          ))}
        </ul>
        <button type="submit" disabled={pending} className="h-12 w-full rounded-xl bg-mark-500 font-semibold text-white shadow-lg shadow-mark-500/25 hover:bg-mark-600 disabled:opacity-60">
          {pending ? "Saving…" : "Save and sign in"}
        </button>
      </form>
    </div>
  );
}
