"use client";

import { DialogButton, type BtnSize, type BtnVariant } from "@/components/admin/client";
import { GrantForm, RevokeForm } from "./access-forms";
import { EditStudentForm } from "./manage-forms";

type Profile = { id: string; full_name: string | null; email: string; phone: string | null; school: string | null; grade: string | null };

export function GrantDialog({
  userId,
  name,
  currentEnd,
  variant = "success",
  size = "md",
  label = "Grant premium",
}: {
  userId: string;
  name: string;
  currentEnd?: string | null;
  variant?: BtnVariant;
  size?: BtnSize;
  label?: string;
}) {
  return (
    <DialogButton label={label} icon="crown" variant={variant} size={size} title="Grant premium access" description={`For ${name}. Every grant is recorded in the activity log.`}>
      {(close) => <GrantForm userId={userId} currentEnd={currentEnd} onDone={close} />}
    </DialogButton>
  );
}

export function RevokeDialog({ userId, name, size = "md" }: { userId: string; name: string; size?: BtnSize }) {
  return (
    <DialogButton label="Remove premium" variant="danger-outline" size={size} title="Remove premium access" description={name}>
      {(close) => <RevokeForm userId={userId} onDone={close} />}
    </DialogButton>
  );
}

export function EditDialog({ p }: { p: Profile }) {
  return (
    <DialogButton label="Edit details" icon="edit" title="Edit student details" description={p.email}>
      {(close) => <EditStudentForm p={p} onDone={close} />}
    </DialogButton>
  );
}
