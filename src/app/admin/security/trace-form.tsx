"use client";

import { SubmitButton } from "@/components/admin/client";
import Link from "next/link";
import { useActionState } from "react";
import { FormMessage } from "@/components/ui/field";
import { Textarea } from "@/components/admin/ui";
import { traceLeak, type TraceState } from "./actions";

export function TraceForm() {
  const [state, action, pending] = useActionState<TraceState, FormData>(traceLeak, undefined);
  return (
    <form action={action} className="space-y-3">
      <Textarea
        name="input"
        rows={4}
        placeholder="Paste leaked question text, or type the code from a screenshot (e.g. TS 4K7Q2M9X)"
        aria-label="Leaked text or watermark code"
      />
      {state?.error ? <FormMessage>{state.error}</FormMessage> : null}
      {state?.matches?.map((m) => (
        <div key={m.code} className="rounded-[var(--radius-md)] bg-paper px-3 py-2.5 text-sm">
          <p className="text-xs text-ink-500">
            Code <span className="font-mono font-semibold text-ink-950">{m.code}</span> · {m.source === "hidden" ? "hidden in the text" : "typed"}
          </p>
          {m.accounts.length ? (
            m.accounts.map((a) => (
              <Link key={a.id} href={`/admin/students/${a.id}`} className="mt-1 block font-medium text-ink-950 hover:underline">
                {a.full_name || a.email} <span className="font-normal text-ink-500">· {a.email} · {a.premium ? "Premium" : "Free"}</span>
              </Link>
            ))
          ) : (
            <p className="mt-1 text-ink-600">No account matches this code. Check the characters (0 vs O, 1 vs I don&apos;t matter).</p>
          )}
        </div>
      ))}
      <SubmitButton size="sm" disabled={pending}>
        {pending ? "Tracing…" : "Trace"}
      </SubmitButton>
    </form>
  );
}
