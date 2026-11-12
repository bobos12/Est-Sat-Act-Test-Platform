"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { FormMessage, Input } from "@/components/ui/field";
import { Label, Select, Textarea } from "@/components/admin/ui";
import type { ActionState } from "./actions";

type Subject = { id: string; name: string; official_duration_minutes: number; official_sections: number; is_active: boolean };
type Topic = { id: string; subject_id: string; kind: string; name: string };
type Exam = {
  id: string;
  subject_id: string;
  title: string;
  slug: string;
  description: string;
  kind: string;
  focus_topic_id: string | null;
  difficulty: string | null;
  access: string;
  duration_minutes: number;
  sort_order: number;
};

export function ExamForm({
  action,
  subjects,
  topics,
  exam,
}: {
  action: (state: ActionState, formData: FormData) => Promise<ActionState>;
  subjects: Subject[];
  topics: Topic[];
  exam?: Exam;
}) {
  const [state, formAction, pending] = useActionState(action, undefined);
  const [subjectId, setSubjectId] = useState(exam?.subject_id ?? subjects.find((s) => s.is_active)?.id ?? subjects[0]?.id);
  const subject = subjects.find((s) => s.id === subjectId);
  const subjectTopics = topics.filter((t) => t.subject_id === subjectId && t.kind !== "domain");

  return (
    <form action={formAction} className="space-y-5">
      {exam ? <input type="hidden" name="id" value={exam.id} /> : null}
      {state?.error ? <FormMessage>{state.error}</FormMessage> : null}
      {state?.ok ? <FormMessage tone="success">{state.ok}</FormMessage> : null}

      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <Label htmlFor="subject_id">Subject</Label>
          <Select id="subject_id" name="subject_id" value={subjectId} onChange={(e) => setSubjectId(e.target.value)} disabled={!!exam}>
            {subjects.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
                {s.is_active ? "" : " (not launched)"}
              </option>
            ))}
          </Select>
          {exam ? <input type="hidden" name="subject_id" value={exam.subject_id} /> : null}
        </div>
        <div>
          <Label htmlFor="kind">Format</Label>
          <Select id="kind" name="kind" defaultValue={exam?.kind ?? "practice"}>
            <option value="practice">Practice set</option>
            <option value="full_mock">Full-length mock</option>
          </Select>
        </div>
      </div>

      <div>
        <Label htmlFor="title">Title</Label>
        <Input id="title" name="title" required defaultValue={exam?.title} placeholder="e.g. Advanced Algebra and Functions — Practice 2" />
      </div>
      <div>
        <Label htmlFor="slug">URL slug</Label>
        <Input id="slug" name="slug" defaultValue={exam?.slug} placeholder="Generated from the title if left empty" />
      </div>
      <div>
        <Label htmlFor="description">Description</Label>
        <Textarea id="description" name="description" rows={3} defaultValue={exam?.description} className="font-sans text-sm" />
      </div>

      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <Label htmlFor="focus_topic_id">Focus topic</Label>
          <Select id="focus_topic_id" name="focus_topic_id" defaultValue={exam?.focus_topic_id ?? ""}>
            <option value="">Mixed topics</option>
            {subjectTopics.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label htmlFor="difficulty">Difficulty</Label>
          <Select id="difficulty" name="difficulty" defaultValue={exam?.difficulty ?? ""}>
            <option value="">Mixed</option>
            <option value="easy">Foundation</option>
            <option value="medium">Standard</option>
            <option value="hard">Challenging</option>
          </Select>
        </div>
        <div>
          <Label htmlFor="access">Access</Label>
          <Select id="access" name="access" defaultValue={exam?.access ?? "premium"}>
            <option value="free">Free</option>
            <option value="premium">Premium</option>
          </Select>
        </div>
        <div>
          <Label htmlFor="duration_minutes">Duration (minutes)</Label>
          <Input
            id="duration_minutes"
            name="duration_minutes"
            type="number"
            min={1}
            max={300}
            required
            defaultValue={exam?.duration_minutes ?? subject?.official_duration_minutes ?? 30}
            key={exam ? "fixed" : subjectId}
          />
        </div>
      </div>

      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {!exam ? (
          <div>
            <Label htmlFor="sections">Sections / modules</Label>
            <Input id="sections" name="sections" type="number" min={1} max={5} defaultValue={subject?.official_sections ?? 1} key={subjectId} />
          </div>
        ) : null}
        <div>
          <Label htmlFor="sort_order">Library order</Label>
          <Input id="sort_order" name="sort_order" type="number" min={0} defaultValue={exam?.sort_order ?? 0} />
        </div>
      </div>

      <Button type="submit" disabled={pending}>
        {pending ? "Saving…" : exam ? "Save details" : "Create exam"}
      </Button>
    </form>
  );
}
