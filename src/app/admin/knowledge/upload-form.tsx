"use client";

import { useActionState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { FormMessage, Input } from "@/components/ui/field";
import { Label, Select } from "@/components/admin/ui";
import { uploadDocument } from "./actions";

export function UploadForm({
  subjects,
  papers,
}: {
  subjects: { id: string; name: string }[];
  papers: { id: string; title: string }[];
}) {
  const [state, action, pending] = useActionState(uploadDocument, undefined);
  const titleRef = useRef<HTMLInputElement>(null);
  return (
    <form action={action} className="space-y-4">
      {state?.error ? <FormMessage>{state.error}</FormMessage> : null}
      {state?.ok ? <FormMessage tone="success">{state.ok}</FormMessage> : null}
      <div>
        <Label htmlFor="file">PDF</Label>
        <input
          id="file"
          name="file"
          type="file"
          accept="application/pdf"
          required
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f && titleRef.current && !titleRef.current.value) titleRef.current.value = f.name.replace(/\.pdf$/i, "");
          }}
          className="block w-full text-sm text-ink-700 file:mr-3 file:rounded-[var(--radius-md)] file:border-0 file:bg-paper-2 file:px-3 file:py-2 file:text-sm file:font-medium"
        />
      </div>
      <div>
        <Label htmlFor="title">Title</Label>
        <Input id="title" name="title" ref={titleRef} required />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
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
          <Label htmlFor="kind">Document type</Label>
          <Select id="kind" name="kind">
            <option value="question_paper">Question paper</option>
            <option value="answer_key">Answer key</option>
            <option value="reference">Other reference</option>
          </Select>
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="session_label">Session</Label>
          <Input id="session_label" name="session_label" placeholder="e.g. January 2026" />
        </div>
        <div>
          <Label htmlFor="paired_document_id">Answer key for…</Label>
          <Select id="paired_document_id" name="paired_document_id" defaultValue="">
            <option value="">—</option>
            {papers.map((p) => (
              <option key={p.id} value={p.id}>
                {p.title}
              </option>
            ))}
          </Select>
        </div>
      </div>
      <Button type="submit" size="sm" disabled={pending}>
        {pending ? "Uploading…" : "Add to knowledge base"}
      </Button>
      <p className="text-xs text-ink-500">Files are stored privately. Uploading the same file twice is detected and refused — nothing is ever overwritten.</p>
    </form>
  );
}
