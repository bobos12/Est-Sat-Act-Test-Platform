"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { FormMessage, Input } from "@/components/ui/field";
import { Label, Select } from "@/components/admin/ui";
import { uploadReadyExam } from "./actions";

const file =
  "block w-full text-sm text-ink-700 file:mr-3 file:rounded-[var(--radius-md)] file:border-0 file:bg-paper-2 file:px-3 file:py-2 file:text-sm file:font-medium";

export function ReadyExamForm({ subjects }: { subjects: { id: string; name: string; minutes: number }[] }) {
  const [state, action, pending] = useActionState(uploadReadyExam, undefined);
  return (
    <form action={action} className="space-y-4">
      {state?.error ? <FormMessage>{state.error}</FormMessage> : null}
      {state?.ok ? <FormMessage tone="success">{state.ok}</FormMessage> : null}
      <div>
        <Label htmlFor="paper">Exam PDF</Label>
        <input id="paper" name="paper" type="file" accept="application/pdf" required className={file} />
      </div>
      <div>
        <Label htmlFor="key">Answer key PDF (optional)</Label>
        <input id="key" name="key" type="file" accept="application/pdf" className={file} />
        <p className="mt-1 text-xs text-ink-500">Without a key the AI works out the answers and flags them for review.</p>
      </div>
      <div>
        <Label htmlFor="title">Exam title</Label>
        <Input id="title" name="title" placeholder="e.g. EST I Math: Practice Test 4" required />
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <Label htmlFor="subject_id">Subject</Label>
          <Select id="subject_id" name="subject_id">
            {subjects.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label htmlFor="access">Access</Label>
          <Select id="access" name="access" defaultValue="premium">
            <option value="premium">Premium</option>
            <option value="free">Free</option>
          </Select>
        </div>
        <div>
          <Label htmlFor="duration">Minutes</Label>
          <Input id="duration" name="duration" type="number" min={1} max={300} placeholder="Subject default" />
        </div>
      </div>
      <Button type="submit" size="sm" disabled={pending}>
        {pending ? "Reading the PDF… this takes a few minutes" : "Upload and build exam"}
      </Button>
    </form>
  );
}
