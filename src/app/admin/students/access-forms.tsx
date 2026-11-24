"use client";

import { useActionState, useEffect, useState } from "react";
import { Input } from "@/components/ui/field";
import { ActionMessage, ConfirmSubmit, SubmitButton } from "@/components/admin/client";
import { Label, Select } from "@/components/admin/ui";
import { cn } from "@/lib/utils";
import { grantAccess, revokeAccess, setRole } from "./actions";

const PRESETS = [
  { days: 7, label: "1 week" },
  { days: 30, label: "1 month" },
  { days: 90, label: "3 months" },
  { days: 180, label: "6 months" },
  { days: 365, label: "1 year" },
];

/** Grant premium days. `onDone` lets a dialog close itself after success. */
export function GrantForm({ userId, currentEnd, onDone }: { userId: string; currentEnd?: string | null; onDone?: () => void }) {
  const [state, action] = useActionState(grantAccess, undefined);
  const [days, setDays] = useState(30);
  useEffect(() => {
    if (state?.ok) onDone?.();
  }, [state, onDone]);
  // currentEnd is only passed while access is live, so new days start from it.
  const [opened] = useState(() => Date.now());
  const until = new Date((currentEnd ? Date.parse(currentEnd) : opened) + days * 86_400_000);
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="user_id" value={userId} />
      <ActionMessage state={state} />
      <div>
        <Label>How long?</Label>
        <div className="flex flex-wrap gap-1.5">
          {PRESETS.map((p) => (
            <button
              key={p.days}
              type="button"
              onClick={() => setDays(p.days)}
              className={cn(
                "rounded-full px-3 py-1.5 text-sm font-medium ring-1 ring-inset transition",
                days === p.days ? "bg-ink-950 text-white ring-ink-950" : "bg-white text-ink-700 ring-line-strong hover:bg-paper-2",
              )}
            >
              {p.label}
            </button>
          ))}
        </div>
        <div className="mt-3 flex items-center gap-2">
          <Input
            name="days"
            type="number"
            min={1}
            max={730}
            value={days}
            onChange={(e) => setDays(Math.max(1, Math.min(730, Number(e.target.value) || 1)))}
            className="h-10 w-24"
            required
          />
          <span className="text-sm text-ink-600">
            days · premium until{" "}
            <b className="text-ink-950">{until.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}</b>
          </span>
        </div>
        {currentEnd ? <p className="mt-1.5 text-xs text-ink-500">Added on top of their current access.</p> : null}
      </div>
      <div>
        <Label htmlFor="grant-note">Reason (saved in the activity log)</Label>
        <Input id="grant-note" name="note" placeholder="e.g. Paid 500 EGP cash at the centre" required minLength={3} />
      </div>
      <SubmitButton variant="success" icon="crown" pendingLabel="Granting…" className="w-full">
        Grant {days} day{days === 1 ? "" : "s"} of premium
      </SubmitButton>
    </form>
  );
}

export function RevokeForm({ userId, onDone }: { userId: string; onDone?: () => void }) {
  const [state, action] = useActionState(revokeAccess, undefined);
  useEffect(() => {
    if (state?.ok) onDone?.();
  }, [state, onDone]);
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="user_id" value={userId} />
      <ActionMessage state={state} />
      <p className="text-sm text-ink-600">All of their current premium access ends immediately. Past payments are kept.</p>
      <div>
        <Label htmlFor="revoke-note">Reason (saved in the activity log)</Label>
        <Input id="revoke-note" name="note" placeholder="e.g. Refund issued" required minLength={3} />
      </div>
      <SubmitButton variant="danger" pendingLabel="Removing…" className="w-full">
        Remove premium access now
      </SubmitButton>
    </form>
  );
}

export function RoleForm({ userId, role }: { userId: string; role: string }) {
  const [state, action] = useActionState(setRole, undefined);
  const [value, setValue] = useState(role);
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="user_id" value={userId} />
      <ActionMessage state={state} />
      <div className="flex gap-2">
        <Select name="role" value={value} onChange={(e) => setValue(e.target.value)} className="max-w-48">
          <option value="student">Student</option>
          <option value="admin">Administrator</option>
        </Select>
        {value === "admin" && role !== "admin" ? (
          <ConfirmSubmit
            variant="dark"
            tone="primary"
            title="Make this person an administrator?"
            body="Admins can see every student, change payments and edit all exams. Only do this for people you fully trust."
            confirmLabel="Yes, make admin"
          >
            Save role
          </ConfirmSubmit>
        ) : (
          <SubmitButton variant="secondary" disabled={value === role} pendingLabel="Saving…">
            Save role
          </SubmitButton>
        )}
      </div>
    </form>
  );
}
