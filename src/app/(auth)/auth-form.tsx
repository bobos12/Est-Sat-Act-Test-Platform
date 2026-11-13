"use client";

import Link from "next/link";
import { useActionState, useState, useTransition } from "react";
import { FormMessage } from "@/components/ui/field";
import { cn } from "@/lib/utils";
import { resendConfirmation, signIn, signUp, type AuthState } from "./actions";

const q = (next?: string) => (next ? `?next=${encodeURIComponent(next)}` : "");

export function AuthForm({ mode, next }: { mode: "sign-in" | "sign-up"; next?: string }) {
  const [state, action, pending] = useActionState<AuthState, FormData>(mode === "sign-in" ? signIn : signUp, undefined);
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const fe = state?.fieldErrors ?? {};

  if (state?.notice === "confirm" && state.email) return <CheckInbox email={state.email} />;

  const rules = [
    { ok: password.length >= 8, label: "8+ characters" },
    { ok: /[A-Za-z]/.test(password), label: "A letter" },
    { ok: /\d/.test(password), label: "A number" },
  ];

  return (
    <div>
      {/* Mode switch */}
      <div className="mb-8 grid grid-cols-2 rounded-2xl bg-paper-2 p-1 text-sm font-semibold">
        <Link
          href={`/sign-in${q(next)}`}
          className={cn("rounded-xl py-2.5 text-center transition", mode === "sign-in" ? "bg-white text-ink-950 shadow-sm" : "text-ink-500 hover:text-ink-950")}
        >
          Sign in
        </Link>
        <Link
          href={`/sign-up${q(next)}`}
          className={cn("rounded-xl py-2.5 text-center transition", mode === "sign-up" ? "bg-white text-ink-950 shadow-sm" : "text-ink-500 hover:text-ink-950")}
        >
          Create account
        </Link>
      </div>

      <h1 className="font-display text-3xl font-medium text-ink-950 sm:text-4xl">
        {mode === "sign-in" ? "Welcome back 👋" : "Start for free"}
      </h1>
      <p className="mb-7 mt-2 text-ink-600">
        {mode === "sign-in" ? "Sign in to pick up where you left off." : "Your first full exam takes a few minutes to start. No card needed."}
      </p>

      <form action={action} className="space-y-4" noValidate>
        {next ? <input type="hidden" name="next" value={next} /> : null}
        {state?.error ? <FormMessage>{state.error}</FormMessage> : null}
        {state?.error?.includes("confirm your email") && state.email ? <ResendLink email={state.email} /> : null}

        {mode === "sign-up" ? (
          <TextField label="Full name" name="fullName" autoComplete="name" placeholder="e.g. Mariam Ahmed" error={fe.fullName} />
        ) : null}

        <TextField
          label="Email"
          name="email"
          type="email"
          inputMode="email"
          autoComplete="email"
          placeholder="you@example.com"
          defaultValue={state?.email}
          error={fe.email}
        />

        <div className="space-y-1.5">
          <div className="flex items-baseline justify-between">
            <label htmlFor="password" className="text-sm font-medium text-ink-800">
              Password
            </label>
            {mode === "sign-in" ? (
              <Link href="/forgot-password" className="text-sm font-medium text-mark-500 hover:underline">
                Forgot password?
              </Link>
            ) : null}
          </div>
          <div className="relative">
            <input
              id="password"
              name="password"
              type={show ? "text" : "password"}
              autoComplete={mode === "sign-up" ? "new-password" : "current-password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              aria-invalid={!!fe.password}
              className="h-12 w-full rounded-xl bg-white pl-4 pr-20 text-[0.9375rem] text-ink-950 ring-1 ring-inset ring-line-strong focus:outline-none focus:ring-2 focus:ring-mark-500 aria-[invalid=true]:ring-danger-600"
            />
            <button
              type="button"
              onClick={() => setShow((s) => !s)}
              className="absolute inset-y-1.5 right-1.5 rounded-lg px-3 text-xs font-semibold text-ink-600 hover:bg-paper-2"
              aria-label={show ? "Hide password" : "Show password"}
            >
              {show ? "Hide" : "Show"}
            </button>
          </div>
          {fe.password ? (
            <p className="text-sm text-danger-600" role="alert">
              {fe.password}
            </p>
          ) : null}
          {mode === "sign-up" ? (
            <ul className="flex flex-wrap gap-1.5 pt-1">
              {rules.map((r) => (
                <li
                  key={r.label}
                  className={cn(
                    "rounded-full px-2.5 py-1 text-xs font-medium transition",
                    r.ok ? "bg-success-600 text-white" : "bg-paper-2 text-ink-500",
                  )}
                >
                  {r.ok ? "✓ " : ""}
                  {r.label}
                </li>
              ))}
            </ul>
          ) : null}
        </div>

        <button
          type="submit"
          disabled={pending}
          className="mt-2 h-12 w-full rounded-xl bg-mark-500 text-base font-semibold text-white shadow-lg shadow-mark-500/25 transition hover:bg-mark-600 disabled:opacity-60"
        >
          {pending ? "One moment…" : mode === "sign-in" ? "Sign in" : "Create my free account"}
        </button>

        {mode === "sign-up" ? (
          <p className="text-center text-xs text-ink-500">By creating an account you agree to use 16hundred for personal study.</p>
        ) : null}
      </form>

      <p className="mt-8 text-center text-sm text-ink-600">
        {mode === "sign-in" ? "New here? " : "Already have an account? "}
        <Link href={`/${mode === "sign-in" ? "sign-up" : "sign-in"}${q(next)}`} className="font-semibold text-mark-500 hover:underline">
          {mode === "sign-in" ? "Create a free account" : "Sign in"}
        </Link>
      </p>
    </div>
  );
}

function TextField({ label, name, error, ...props }: { label: string; name: string; error?: string } & React.ComponentProps<"input">) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={name} className="block text-sm font-medium text-ink-800">
        {label}
      </label>
      <input
        id={name}
        name={name}
        aria-invalid={!!error}
        className="h-12 w-full rounded-xl bg-white px-4 text-[0.9375rem] text-ink-950 ring-1 ring-inset ring-line-strong placeholder:text-ink-400 focus:outline-none focus:ring-2 focus:ring-mark-500 aria-[invalid=true]:ring-danger-600"
        {...props}
      />
      {error ? (
        <p className="text-sm text-danger-600" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

function ResendLink({ email }: { email: string }) {
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, start] = useTransition();
  return (
    <button
      type="button"
      disabled={busy}
      onClick={() =>
        start(async () => {
          const r = await resendConfirmation(email);
          setMsg(r.error ?? "Sent! Check your inbox (and spam).");
        })
      }
      className="text-sm font-semibold text-mark-500 hover:underline disabled:opacity-60"
    >
      {msg ?? (busy ? "Sending…" : "Resend the confirmation email")}
    </button>
  );
}

export function CheckInbox({ email, kind = "confirm" }: { email: string; kind?: "confirm" | "reset" }) {
  const domain = email.split("@")[1] ?? "";
  const webmail = domain.includes("gmail")
    ? { label: "Open Gmail", href: "https://mail.google.com/mail/u/0/#inbox" }
    : /outlook|hotmail|live/.test(domain)
      ? { label: "Open Outlook", href: "https://outlook.live.com/mail/" }
      : domain.includes("yahoo")
        ? { label: "Open Yahoo Mail", href: "https://mail.yahoo.com/" }
        : null;
  return (
    <div className="text-center">
      <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-mark-50 text-3xl">📬</span>
      <h1 className="mt-5 font-display text-3xl font-medium text-ink-950">Check your inbox</h1>
      <p className="mt-3 text-ink-600">
        {kind === "confirm" ? "We sent a confirmation link to" : "If an account exists, we sent a reset link to"}
        <br />
        <b className="text-ink-950">{email}</b>
      </p>
      <p className="mt-2 text-sm text-ink-500">
        {kind === "confirm" ? "Tap the link to activate your account. It can take a minute, so check spam too." : "Tap the link to choose a new password."}
      </p>
      {webmail ? (
        <a
          href={webmail.href}
          target="_blank"
          rel="noreferrer"
          className="mt-6 flex h-12 w-full items-center justify-center rounded-xl bg-mark-500 font-semibold text-white hover:bg-mark-600"
        >
          {webmail.label}
        </a>
      ) : null}
      <div className="mt-4">{kind === "confirm" ? <ResendLink email={email} /> : null}</div>
      <p className="mt-8 text-sm text-ink-600">
        Wrong email?{" "}
        <Link href={kind === "confirm" ? "/sign-up" : "/forgot-password"} className="font-semibold text-mark-500 hover:underline">
          Try again
        </Link>
      </p>
    </div>
  );
}
