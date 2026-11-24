"use client";

import { useActionState, useEffect, useId, useState } from "react";
import { Input } from "@/components/ui/field";
import { ActionMessage, ConfirmSubmit, SubmitButton } from "@/components/admin/client";
import { Label } from "@/components/admin/ui";
import { deleteStudent, setSuspended, signOutEverywhere, updateStudent } from "./actions";

type Profile = { id: string; full_name: string | null; email: string; phone: string | null; school: string | null; grade: string | null };

export function EditStudentForm({ p, onDone }: { p: Profile; onDone?: () => void }) {
  const [state, action] = useActionState(updateStudent, undefined);
  const uid = useId();
  useEffect(() => {
    if (state?.ok) onDone?.();
  }, [state, onDone]);
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="user_id" value={p.id} />
      <ActionMessage state={state} />
      <div>
        <Label htmlFor={`${uid}-full_name`}>Full name</Label>
        <Input id={`${uid}-full_name`} name="full_name" defaultValue={p.full_name ?? ""} />
      </div>
      <div>
        <Label htmlFor={`${uid}-email`}>Email (used to sign in)</Label>
        <Input id={`${uid}-email`} name="email" type="email" defaultValue={p.email} required />
      </div>
      <div>
        <Label htmlFor={`${uid}-phone`}>Phone</Label>
        <Input id={`${uid}-phone`} name="phone" defaultValue={p.phone ?? ""} placeholder="01x xxxx xxxx" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label htmlFor={`${uid}-school`}>School</Label>
          <Input id={`${uid}-school`} name="school" defaultValue={p.school ?? ""} />
        </div>
        <div>
          <Label htmlFor={`${uid}-grade`}>Grade</Label>
          <Input id={`${uid}-grade`} name="grade" defaultValue={p.grade ?? ""} />
        </div>
      </div>
      <SubmitButton pendingLabel="Saving…" icon="check">
        Save details
      </SubmitButton>
    </form>
  );
}

export function SuspendForm({ userId, suspended }: { userId: string; suspended: boolean }) {
  const [state, action] = useActionState(setSuspended, undefined);
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="user_id" value={userId} />
      <input type="hidden" name="suspend" value={String(!suspended)} />
      <ActionMessage state={state} />
      {suspended ? (
        <SubmitButton variant="success" pendingLabel="Restoring…">
          Restore account
        </SubmitButton>
      ) : (
        <ConfirmSubmit
          title="Suspend this account?"
          body="They are signed out everywhere and can't sign in until you restore the account. Nothing is deleted."
          confirmLabel="Suspend account"
          pendingLabel="Suspending…"
        >
          Suspend account
        </ConfirmSubmit>
      )}
    </form>
  );
}

export function SignOutEverywhereForm({ userId }: { userId: string }) {
  const [state, action] = useActionState(signOutEverywhere, undefined);
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="user_id" value={userId} />
      <ActionMessage state={state} />
      <ConfirmSubmit
        variant="secondary"
        icon="logout"
        title="Sign this student out everywhere?"
        body="Every device they're signed in on is signed out. They can sign back in straight away."
        confirmLabel="Sign out everywhere"
        pendingLabel="Signing out…"
      >
        Sign out everywhere
      </ConfirmSubmit>
    </form>
  );
}

export function DeleteStudentForm({ userId, email }: { userId: string; email: string }) {
  const [state, action] = useActionState(deleteStudent, undefined);
  const [typed, setTyped] = useState("");
  const [open, setOpen] = useState(false);
  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="h-10 rounded-[var(--radius-md)] px-4 text-sm font-semibold text-danger-600 ring-1 ring-inset ring-danger-600/40 hover:bg-danger-50"
      >
        Delete account…
      </button>
    );
  }
  return (
    <form action={action} className="space-y-3 rounded-[var(--radius-md)] bg-danger-50/60 p-4 ring-1 ring-inset ring-danger-600/20">
      <input type="hidden" name="user_id" value={userId} />
      <ActionMessage state={state} />
      <p className="text-sm text-ink-700">
        This permanently deletes the login, every exam attempt, subscriptions and payment records. <b>It can&apos;t be undone.</b>
      </p>
      <div>
        <Label htmlFor="confirm">
          Type <span className="font-mono text-ink-950">{email}</span> to confirm
        </Label>
        <Input id="confirm" name="confirm" value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off" />
      </div>
      <div className="flex gap-2">
        <SubmitButton variant="danger" disabled={typed.trim().toLowerCase() !== email.toLowerCase()} pendingLabel="Deleting…" icon="trash">
          Delete permanently
        </SubmitButton>
        <button type="button" onClick={() => setOpen(false)} className="h-10 rounded-[var(--radius-md)] bg-white px-4 text-sm font-medium text-ink-700 ring-1 ring-inset ring-line hover:bg-paper-2">
          Cancel
        </button>
      </div>
    </form>
  );
}
