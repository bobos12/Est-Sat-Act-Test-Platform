"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { FormMessage, Input } from "@/components/ui/field";
import { Label } from "@/components/admin/ui";
import { deleteStudent, setSuspended, updateStudent } from "./actions";

type Profile = { id: string; full_name: string | null; email: string; phone: string | null; school: string | null; grade: string | null };

export function EditStudentForm({ p }: { p: Profile }) {
  const [state, action, pending] = useActionState(updateStudent, undefined);
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="user_id" value={p.id} />
      {state?.error ? <FormMessage>{state.error}</FormMessage> : null}
      {state?.ok ? <FormMessage tone="success">{state.ok}</FormMessage> : null}
      <div>
        <Label htmlFor="full_name">Full name</Label>
        <Input id="full_name" name="full_name" defaultValue={p.full_name ?? ""} />
      </div>
      <div>
        <Label htmlFor="email">Email (used to sign in)</Label>
        <Input id="email" name="email" type="email" defaultValue={p.email} required />
      </div>
      <div>
        <Label htmlFor="phone">Phone</Label>
        <Input id="phone" name="phone" defaultValue={p.phone ?? ""} placeholder="01x xxxx xxxx" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label htmlFor="school">School</Label>
          <Input id="school" name="school" defaultValue={p.school ?? ""} />
        </div>
        <div>
          <Label htmlFor="grade">Grade</Label>
          <Input id="grade" name="grade" defaultValue={p.grade ?? ""} />
        </div>
      </div>
      <Button type="submit" size="sm" disabled={pending}>
        {pending ? "Saving…" : "Save details"}
      </Button>
    </form>
  );
}

export function SuspendForm({ userId, suspended }: { userId: string; suspended: boolean }) {
  const [state, action, pending] = useActionState(setSuspended, undefined);
  return (
    <form action={action} className="space-y-2">
      <input type="hidden" name="user_id" value={userId} />
      <input type="hidden" name="suspend" value={String(!suspended)} />
      {state?.error ? <FormMessage>{state.error}</FormMessage> : null}
      {state?.ok ? <FormMessage tone="success">{state.ok}</FormMessage> : null}
      <p className="text-sm text-ink-600">
        {suspended ? "This account is suspended and can't sign in." : "Block sign-in without deleting anything. You can restore it any time."}
      </p>
      <button
        type="submit"
        disabled={pending}
        className={
          suspended
            ? "h-9 rounded-[var(--radius-md)] bg-success-600 px-4 text-sm font-semibold text-white hover:bg-success-700 disabled:opacity-50"
            : "h-9 rounded-[var(--radius-md)] px-4 text-sm font-semibold text-warning-700 ring-1 ring-inset ring-warning-500 hover:bg-warning-50 disabled:opacity-50"
        }
      >
        {pending ? "Saving…" : suspended ? "Restore account" : "Suspend account"}
      </button>
    </form>
  );
}

export function DeleteStudentForm({ userId, email }: { userId: string; email: string }) {
  const [state, action, pending] = useActionState(deleteStudent, undefined);
  const [typed, setTyped] = useState("");
  const [open, setOpen] = useState(false);
  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="h-9 rounded-[var(--radius-md)] px-4 text-sm font-semibold text-danger-600 ring-1 ring-inset ring-danger-600/40 hover:bg-danger-50">
        Delete account…
      </button>
    );
  }
  return (
    <form action={action} className="space-y-2.5">
      <input type="hidden" name="user_id" value={userId} />
      {state?.error ? <FormMessage>{state.error}</FormMessage> : null}
      <p className="text-sm text-ink-700">
        This permanently deletes the login, every exam attempt, subscriptions and payment records. <b>It can&apos;t be undone.</b>
      </p>
      <Label htmlFor="confirm">
        Type <span className="font-mono text-ink-950">{email}</span> to confirm
      </Label>
      <Input id="confirm" name="confirm" value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off" />
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={pending || typed.trim().toLowerCase() !== email.toLowerCase()}
          className="h-9 rounded-[var(--radius-md)] bg-danger-600 px-4 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-40"
        >
          {pending ? "Deleting…" : "Delete permanently"}
        </button>
        <button type="button" onClick={() => setOpen(false)} className="h-9 rounded-[var(--radius-md)] px-4 text-sm font-medium text-ink-700 ring-1 ring-inset ring-line hover:bg-paper-2">
          Cancel
        </button>
      </div>
    </form>
  );
}
