"use client";

import { useActionState, useState, useTransition } from "react";
import { Turnstile } from "@/components/auth/turnstile";
import { FormMessage } from "@/components/ui/field";
import { resetTwoStep, sendRecoveryLink, startEnrollment, verifyCode, type CodeState, type Enrollment, type RecoveryState } from "./actions";

const primary = "h-12 w-full rounded-xl bg-mark-500 font-semibold text-white shadow-lg shadow-mark-500/25 hover:bg-mark-600 disabled:opacity-60";

export function TwoStepForm({ enrolled, email, canReset, serviceMissing }: { enrolled: boolean; email: string; canReset: boolean; serviceMissing: boolean }) {
  const [setup, setSetup] = useState<Enrollment | null>(null);
  const [starting, start] = useTransition();
  const [useCode, setUseCode] = useState(false);
  const needsSetup = !enrolled && !setup?.factorId;

  if (canReset && !useCode) return <ResetPanel serviceMissing={serviceMissing} onUseCode={() => setUseCode(true)} />;

  return (
    <div>
      <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-mark-50 text-2xl">🛡️</span>
      <h1 className="mt-5 font-display text-3xl font-medium text-ink-950 sm:text-4xl">
        {enrolled ? "Enter your code" : "Protect the admin area"}
      </h1>
      <p className="mb-7 mt-2 text-ink-600">
        {enrolled
          ? "Open your authenticator app and enter the 6-digit code for TargetScore."
          : "Admin access needs 2-step verification. Use Google Authenticator, Microsoft Authenticator or any authenticator app."}
      </p>

      {needsSetup ? (
        <>
          {setup?.error ? <FormMessage>{setup.error}</FormMessage> : null}
          <button type="button" disabled={starting} onClick={() => start(async () => setSetup(await startEnrollment()))} className={primary}>
            {starting ? "Preparing…" : "Set up 2-step verification"}
          </button>
        </>
      ) : (
        <>
          {setup?.qr ? (
            <div className="mb-6 rounded-2xl bg-white p-5 text-center ring-1 ring-line">
              <p className="text-sm font-medium text-ink-800">1. Scan this with your authenticator app</p>
              {/* eslint-disable-next-line @next/next/no-img-element -- QR code is a data URI from Supabase */}
              <img src={setup.qr} alt="QR code for your authenticator app" width={180} height={180} className="mx-auto mt-3" />
              <p className="mt-3 text-xs text-ink-500">Can&apos;t scan? Enter this key in the app:</p>
              <p className="mt-1 break-all font-mono text-sm text-ink-950">{setup.secret}</p>
              <p className="mt-4 text-sm font-medium text-ink-800">2. Enter the code it shows below</p>
            </div>
          ) : null}
          <CodeForm factorId={setup?.factorId} />
          {enrolled ? <LostPhone email={email} /> : null}
        </>
      )}
    </div>
  );
}

function CodeForm({ factorId }: { factorId?: string }) {
  const [state, action, pending] = useActionState<CodeState, FormData>(verifyCode, undefined);
  return (
    <form action={action} className="space-y-4" noValidate>
      {factorId ? <input type="hidden" name="factorId" value={factorId} /> : null}
      {state?.error ? <FormMessage>{state.error}</FormMessage> : null}
      <input
        name="code"
        inputMode="numeric"
        autoComplete="one-time-code"
        pattern="[0-9]*"
        maxLength={7}
        autoFocus
        placeholder="123456"
        aria-label="6-digit code"
        className="h-14 w-full rounded-xl bg-white px-4 text-center font-mono text-2xl tracking-[0.4em] text-ink-950 ring-1 ring-inset ring-line-strong placeholder:text-ink-300 focus:outline-none focus:ring-2 focus:ring-mark-500"
      />
      <button type="submit" disabled={pending} className={primary}>
        {pending ? "Checking…" : "Verify"}
      </button>
    </form>
  );
}

/** Backup: prove inbox access with an emailed sign-in link, then reset the authenticator. */
function LostPhone({ email }: { email: string }) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState<RecoveryState, FormData>(sendRecoveryLink, undefined);

  if (state?.sent) {
    return (
      <p className="mt-6 rounded-xl bg-success-50 px-4 py-3 text-sm text-success-700">
        We emailed a sign-in link to <b>{state.sent}</b>. Open it on this device within 15 minutes and you&apos;ll be able to reset 2-step verification.
      </p>
    );
  }
  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="mt-6 w-full text-center text-sm font-medium text-mark-500 hover:underline">
        Lost your phone? Email me a recovery link
      </button>
    );
  }
  return (
    <form action={action} className="mt-6 space-y-3 rounded-2xl bg-white p-5 ring-1 ring-line">
      <p className="text-sm text-ink-700">
        We&apos;ll send a one-time sign-in link to <b>{email}</b>. After opening it you can remove the lost authenticator and set up a new phone.
      </p>
      {state?.error ? <FormMessage>{state.error}</FormMessage> : null}
      <Turnstile action="mfa-recovery" resetKey={state} />
      <button type="submit" disabled={pending} className="h-11 w-full rounded-xl bg-ink-950 text-sm font-semibold text-paper disabled:opacity-60">
        {pending ? "Sending…" : "Email me the link"}
      </button>
    </form>
  );
}

function ResetPanel({ serviceMissing, onUseCode }: { serviceMissing: boolean; onUseCode: () => void }) {
  const [resetting, start] = useTransition();
  return (
    <div>
      <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-mark-50 text-2xl">🔑</span>
      <h1 className="mt-5 font-display text-3xl font-medium text-ink-950 sm:text-4xl">Set up a new phone</h1>
      <p className="mb-7 mt-2 text-ink-600">
        You signed in from your email link. Reset 2-step verification to remove the lost authenticator. You&apos;ll sign in once more, then scan a new QR code.
      </p>
      {serviceMissing ? <FormMessage>The reset needs SUPABASE_SERVICE_ROLE_KEY in the server environment.</FormMessage> : null}
      <button type="button" disabled={resetting} onClick={() => start(() => resetTwoStep())} className={primary}>
        {resetting ? "Resetting…" : "Reset 2-step verification"}
      </button>
      <button type="button" onClick={onUseCode} className="mt-4 w-full text-center text-sm font-medium text-mark-500 hover:underline">
        I still have my phone: enter a code instead
      </button>
    </div>
  );
}
