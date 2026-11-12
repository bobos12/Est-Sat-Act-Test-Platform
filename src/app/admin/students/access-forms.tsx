"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { FormMessage, Input } from "@/components/ui/field";
import { Label, Select } from "@/components/admin/ui";
import { grantAccess, revokeAccess, setRole } from "./actions";

export function GrantForm({ userId }: { userId: string }) {
  const [state, action, pending] = useActionState(grantAccess, undefined);
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="user_id" value={userId} />
      {state?.error ? <FormMessage>{state.error}</FormMessage> : null}
      {state?.ok ? <FormMessage tone="success">{state.ok}</FormMessage> : null}
      <div className="grid grid-cols-[110px_1fr] gap-3">
        <div>
          <Label htmlFor="days">Days</Label>
          <Input id="days" name="days" type="number" min={1} max={730} defaultValue={30} required />
        </div>
        <div>
          <Label htmlFor="grant-note">Reason</Label>
          <Input id="grant-note" name="note" placeholder="e.g. Paid in cash at centre" required />
        </div>
      </div>
      <Button type="submit" size="sm" disabled={pending}>
        {pending ? "Granting…" : "Grant premium access"}
      </Button>
    </form>
  );
}

export function RevokeForm({ userId }: { userId: string }) {
  const [state, action, pending] = useActionState(revokeAccess, undefined);
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="user_id" value={userId} />
      {state?.error ? <FormMessage>{state.error}</FormMessage> : null}
      {state?.ok ? <FormMessage tone="success">{state.ok}</FormMessage> : null}
      <div>
        <Label htmlFor="revoke-note">Reason</Label>
        <Input id="revoke-note" name="note" placeholder="e.g. Refund issued" required />
      </div>
      <Button type="submit" size="sm" variant="secondary" disabled={pending}>
        {pending ? "Revoking…" : "Revoke premium access"}
      </Button>
    </form>
  );
}

export function RoleForm({ userId, role }: { userId: string; role: string }) {
  const [state, action, pending] = useActionState(setRole, undefined);
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="user_id" value={userId} />
      {state?.error ? <FormMessage>{state.error}</FormMessage> : null}
      {state?.ok ? <FormMessage tone="success">{state.ok}</FormMessage> : null}
      <div className="flex gap-3">
        <Select name="role" defaultValue={role} className="max-w-40">
          <option value="student">Student</option>
          <option value="admin">Administrator</option>
        </Select>
        <Button type="submit" size="md" variant="secondary" disabled={pending}>
          Save role
        </Button>
      </div>
    </form>
  );
}
