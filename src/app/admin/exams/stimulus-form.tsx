"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { RichContentView } from "@/components/exam/rich-content";
import { Button } from "@/components/ui/button";
import { FormMessage, Input } from "@/components/ui/field";
import { Label, Select, Textarea } from "@/components/admin/ui";
import { textToContent } from "@/lib/content";
import { saveStimulus } from "./actions";

export function StimulusForm({
  examId,
  stimulus,
  domains,
}: {
  examId: string;
  stimulus?: { id: string; kind: string; title: string | null; attribution: string | null; domain_topic_id: string | null; content: string };
  domains: { id: string; name: string }[];
}) {
  const [state, action, pending] = useActionState(saveStimulus, undefined);
  const [content, setContent] = useState(stimulus?.content ?? "");
  return (
    <form action={action} className="grid gap-8 xl:grid-cols-2">
      <input type="hidden" name="exam_id" value={examId} />
      {stimulus ? <input type="hidden" name="stimulus_id" value={stimulus.id} /> : null}
      <div className="space-y-5">
        {state?.error ? <FormMessage>{state.error}</FormMessage> : null}
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="kind">Type</Label>
            <Select id="kind" name="kind" defaultValue={stimulus?.kind ?? "passage"}>
              <option value="passage">Reading passage</option>
              <option value="table">Table</option>
              <option value="figure">Figure / graph</option>
              <option value="data_set">Data set</option>
              <option value="text">Scenario text</option>
            </Select>
          </div>
          {domains.length ? (
            <div>
              <Label htmlFor="domain_topic_id">Passage domain</Label>
              <Select id="domain_topic_id" name="domain_topic_id" defaultValue={stimulus?.domain_topic_id ?? ""}>
                <option value="">—</option>
                {domains.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </Select>
            </div>
          ) : null}
        </div>
        <div>
          <Label htmlFor="title">Title</Label>
          <Input id="title" name="title" defaultValue={stimulus?.title ?? ""} />
        </div>
        <div>
          <Label htmlFor="attribution">Attribution</Label>
          <Input id="attribution" name="attribution" defaultValue={stimulus?.attribution ?? ""} placeholder="e.g. Adapted from …" />
        </div>
        <div>
          <Label htmlFor="content">Content</Label>
          <Textarea id="content" name="content" rows={16} value={content} onChange={(e) => setContent(e.target.value)} required />
          <p className="mt-1.5 text-xs text-ink-500">
            Mark the text a question refers to with <code>[[3|the underlined words]]</code> — question 3&apos;s marker number highlights it.
          </p>
        </div>
        <div className="flex gap-3">
          <Button type="submit" disabled={pending}>
            {pending ? "Saving…" : "Save passage"}
          </Button>
          <Link href={`/admin/exams/${examId}`} className="inline-flex h-10 items-center px-3 text-sm text-ink-600 hover:text-ink-950">
            Cancel
          </Link>
        </div>
      </div>
      <aside className="xl:sticky xl:top-8 xl:self-start">
        <p className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-ink-500">Student preview</p>
        <div className="max-h-[75vh] overflow-y-auto rounded-[var(--radius-lg)] bg-white p-6 ring-1 ring-line">
          <RichContentView content={textToContent(content)} className="font-reading leading-[1.8] text-ink-900" />
        </div>
      </aside>
    </form>
  );
}
