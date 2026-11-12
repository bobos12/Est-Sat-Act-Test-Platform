"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { FormMessage, Input } from "@/components/ui/field";
import { Label, Select } from "@/components/admin/ui";
import { generateExams } from "./actions";

type Subject = { id: string; code: string; name: string; official_duration_minutes: number; official_question_count: number };
type Topic = { id: string; subject_id: string; kind: string; name: string };

export function GenerateForm({ subjects, topics, disabled }: { subjects: Subject[]; topics: Topic[]; disabled: boolean }) {
  const [state, action, pending] = useActionState(generateExams, undefined);
  const [subjectId, setSubjectId] = useState(subjects[0]?.id ?? "");
  const subject = subjects.find((s) => s.id === subjectId);
  const isLiteracy = subject?.code.includes("literacy");
  const choices = topics.filter((t) => t.subject_id === subjectId && t.kind === (isLiteracy ? "domain" : "topic"));
  const [count, setCount] = useState(20);

  return (
    <form action={action} className="space-y-5">
      {state?.error ? <FormMessage>{state.error}</FormMessage> : null}
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="subject_id">Subject</Label>
          <Select id="subject_id" name="subject_id" value={subjectId} onChange={(e) => setSubjectId(e.target.value)}>
            {subjects.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label htmlFor="title">Exam title</Label>
          <Input id="title" name="title" required defaultValue={isLiteracy ? "Literacy Practice" : "Math Practice"} key={subjectId} />
        </div>
      </div>

      <fieldset>
        <legend className="mb-2 text-sm font-medium text-ink-800">
          {isLiteracy ? "Passage domains" : "Topics"} <span className="font-normal text-ink-500">(none selected = official blueprint mix)</span>
        </legend>
        <div className="grid gap-2 sm:grid-cols-2">
          {choices.map((t) => (
            <label key={t.id} className="flex items-center gap-2.5 rounded-[var(--radius-md)] bg-white px-3 py-2 text-sm ring-1 ring-inset ring-line">
              <input type="checkbox" name="topic_ids" value={t.id} className="h-4 w-4 accent-[var(--color-ink-950)]" />
              {t.name}
            </label>
          ))}
        </div>
      </fieldset>

      <div className="grid gap-4 sm:grid-cols-4">
        <div>
          <Label htmlFor="questions">Questions per exam</Label>
          <Input id="questions" name="questions" type="number" min={5} max={60} value={count} onChange={(e) => setCount(Number(e.target.value))} required />
        </div>
        <div>
          <Label htmlFor="duration">Duration (min)</Label>
          <Input
            id="duration"
            name="duration"
            type="number"
            min={5}
            max={180}
            required
            key={`${subjectId}-${count}`}
            defaultValue={subject ? Math.max(5, Math.round((subject.official_duration_minutes * count) / subject.official_question_count)) : 30}
          />
        </div>
        <div>
          <Label htmlFor="exams">Number of exams</Label>
          <Input id="exams" name="exams" type="number" min={1} max={3} defaultValue={1} required />
        </div>
        <div>
          <Label htmlFor="access">Access</Label>
          <Select id="access" name="access" defaultValue="premium">
            <option value="premium">Premium</option>
            <option value="free">Free</option>
          </Select>
        </div>
      </div>

      <fieldset>
        <legend className="mb-2 text-sm font-medium text-ink-800">Difficulty mix (%)</legend>
        <div className="grid grid-cols-3 gap-4">
          {[
            ["easy", "Foundation", 30],
            ["medium", "Standard", 50],
            ["hard", "Challenging", 20],
          ].map(([name, label, def]) => (
            <div key={name}>
              <Label htmlFor={String(name)}>{label}</Label>
              <Input id={String(name)} name={String(name)} type="number" min={0} max={100} defaultValue={def} required />
            </div>
          ))}
        </div>
      </fieldset>

      <Button type="submit" disabled={pending || disabled}>
        {pending ? "Writing questions… this takes 1–4 minutes" : "Generate draft exams"}
      </Button>
      <p className="text-xs text-ink-500">
        Generated exams are saved as <strong>In review</strong> with every question as a draft. Each answer key is checked by a second, independent
        AI pass; disagreements are flagged on the question. Nothing is published until you approve and publish it.
      </p>
    </form>
  );
}
