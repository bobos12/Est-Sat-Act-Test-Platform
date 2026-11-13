"use client";

import Link from "next/link";
import { useActionState, useState, useTransition } from "react";
import { FormMessage } from "@/components/ui/field";
import { cn } from "@/lib/utils";
import { resendConfirmation, sendMagicLink, signIn, signUp, type AuthState } from "./actions";

const q = (next?: string) => (next ? `?next=${encodeURIComponent(next)}` : "");

export function AuthForm({ mode, next }: { mode: "sign-in" | "sign-up"; next?: string }) {
  const [state, action, pending] = useActionState<AuthState, FormData>(mode === "sign-in" ? signIn : signUp, undefined);
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [magic, setMagic] = useState(false);
  const [magicState, magicAction, magicPending] = useActionState<AuthState, FormData>(sendMagicLink, undefined);
  const fe = state?.fieldErrors ?? {};

  if (state?.notice === "confirm" && state.email) return <CheckInbox email={state.email} />;
  if (magicState?.notice === "magic" && magicState.email) return <CheckInbox email={magicState.email} kind="magic" />;

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

      {/* Quick sign-in */}
      {/* Google sign-in is ready (signInWithGoogle) but hidden until the provider is set up in Supabase. */}
      <button
        type="button"
        onClick={() => setMagic((m) => !m)}
        className={cn(
          "flex h-12 w-full items-center justify-center gap-3 rounded-xl text-[0.9375rem] font-semibold ring-1 ring-inset transition",
          magic ? "bg-mark-50 text-mark-600 ring-mark-500" : "bg-white text-ink-950 ring-line-strong hover:bg-paper-2 hover:ring-ink-400",
        )}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M3 7l9 6 9-6" /></svg>
        {magic ? "Use a password instead" : "Email me a sign-in link"}
      </button>

      <div className="my-6 flex items-center gap-3 text-xs font-medium uppercase tracking-[0.12em] text-ink-400">
        <span className="h-px flex-1 bg-line" />
        {magic ? "no password needed" : "or with email"}
        <span className="h-px flex-1 bg-line" />
      </div>

      {magic ? (
        <form action={magicAction} className="space-y-4" noValidate>
          {next ? <input type="hidden" name="next" value={next} /> : null}
          {magicState?.error ? <FormMessage>{magicState.error}</FormMessage> : null}
          <TextField
            label="Email"
            name="email"
            type="email"
            inputMode="email"
            autoComplete="email"
            placeholder="you@example.com"
            defaultValue={magicState?.email}
            error={magicState?.fieldErrors?.email}
          />
          <button
            type="submit"
            disabled={magicPending}
            className="h-12 w-full rounded-xl bg-mark-500 text-base font-semibold text-white shadow-lg shadow-mark-500/25 transition hover:bg-mark-600 disabled:opacity-60"
          >
            {magicPending ? "Sending…" : "Send me the link"}
          </button>
          <p className="text-center text-xs text-ink-500">We&apos;ll email you a link that signs you in with one tap. New here? It creates your account too.</p>
        </form>
      ) : (
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
      )}

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

export function CheckInbox({ email, kind = "confirm" }: { email: string; kind?: "confirm" | "reset" | "magic" }) {
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
        {kind === "confirm" ? "We sent a confirmation link to" : kind === "magic" ? "We sent a sign-in link to" : "If an account exists, we sent a reset link to"}
        <br />
        <b className="text-ink-950">{email}</b>
      </p>
      <p className="mt-2 text-sm text-ink-500">
        {kind === "confirm"
          ? "Tap the link to activate your account. It can take a minute, so check spam too."
          : kind === "magic"
            ? "Tap the link on this device to sign in. It works once and expires in an hour."
            : "Tap the link to choose a new password."}
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
        <Link href={kind === "reset" ? "/forgot-password" : kind === "magic" ? "/sign-in" : "/sign-up"} className="font-semibold text-mark-500 hover:underline">
          Try again
        </Link>
      </p>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 48 48" aria-hidden>
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.6 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.1 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.1 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
    </svg>
  );
}
