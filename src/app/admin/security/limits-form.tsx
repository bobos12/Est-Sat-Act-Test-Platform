"use client";

import { ActionMessage, SubmitButton } from "@/components/admin/client";
import { useActionState } from "react";
import { Input } from "@/components/ui/field";
import { Label } from "@/components/admin/ui";
import { saveLimits } from "./actions";

export type Limits = { max_new_attempts_per_day: number; max_practice_questions_per_day: number; flag_score: number };

export function LimitsForm({ limits }: { limits: Limits }) {
  const [state, action, pending] = useActionState(saveLimits, undefined);
  return (
    <form action={action} className="space-y-3">
      <ActionMessage state={state} />
      <div>
        <Label htmlFor="max_new_attempts_per_day">New exams per student, per 24 hours</Label>
        <Input id="max_new_attempts_per_day" name="max_new_attempts_per_day" type="number" min="1" max="100" defaultValue={limits.max_new_attempts_per_day} required />
      </div>
      <div>
        <Label htmlFor="max_practice_questions_per_day">New practice questions per student, per 24 hours</Label>
        <Input id="max_practice_questions_per_day" name="max_practice_questions_per_day" type="number" min="10" max="5000" defaultValue={limits.max_practice_questions_per_day} required />
      </div>
      <div>
        <Label htmlFor="flag_score">Risk score that flags an account (limits halve)</Label>
        <Input id="flag_score" name="flag_score" type="number" min="20" max="100" defaultValue={limits.flag_score} required />
      </div>
      <SubmitButton size="sm" disabled={pending}>
        {pending ? "Saving…" : "Save limits"}
      </SubmitButton>
    </form>
  );
}
