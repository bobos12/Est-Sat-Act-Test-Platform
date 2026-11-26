"use client";

import { ActionMessage, SubmitButton } from "@/components/admin/client";
import { useActionState, useRef, useState } from "react";
import { Input } from "@/components/ui/field";
import { DropZone } from "@/components/admin/drop-zone";
import { Label, Select } from "@/components/admin/ui";
import { uploadDocument } from "./actions";
import { ImportRun } from "./import-runner";

export function UploadForm({
  subjects,
  papers,
}: {
  subjects: { id: string; name: string }[];
  papers: { id: string; title: string }[];
}) {
  const [state, action, pending] = useActionState(uploadDocument, undefined);
  const titleRef = useRef<HTMLInputElement>(null);
  const [kind, setKind] = useState("question_paper");
  return (
    <form action={action} className="space-y-4">
      <ActionMessage state={state} />
      {!pending && state?.docId ? <ImportRun key={state.docId} docId={state.docId} title={state.docTitle ?? "Paper"} opts={state.run} /> : null}
      <DropZone
        name="file"
        label="PDF"
        required
        onFiles={(f) => {
          if (f[0] && titleRef.current && !titleRef.current.value) titleRef.current.value = f[0].name.replace(/\.pdf$/i, "");
        }}
      />
      <div>
        <Label htmlFor="doc-title">Title</Label>
        <Input id="doc-title" name="title" ref={titleRef} required />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="doc-subject_id">Subject</Label>
          <Select id="doc-subject_id" name="subject_id">
            {subjects.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label htmlFor="doc-kind">Document type</Label>
          <Select id="doc-kind" name="kind" value={kind} onChange={(e) => setKind(e.target.value)}>
            <option value="question_paper">Question paper</option>
            <option value="answer_key">Answer key</option>
            <option value="reference">Other reference</option>
          </Select>
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="doc-session_label">Session</Label>
          <Input id="doc-session_label" name="session_label" placeholder="e.g. January 2026" />
        </div>
        <div>
          <Label htmlFor="doc-paired_document_id">{kind === "answer_key" ? "Answer key for which paper? (required)" : "Answer key for…"}</Label>
          <Select id="doc-paired_document_id" name="paired_document_id" defaultValue="" required={kind === "answer_key"} disabled={kind !== "answer_key"}>
            <option value="">—</option>
            {papers.map((p) => (
              <option key={p.id} value={p.id}>
                {p.title}
              </option>
            ))}
          </Select>
        </div>
      </div>
      <SubmitButton size="sm" disabled={pending}>
        {pending ? "Uploading…" : "Add to knowledge base"}
      </SubmitButton>
      <p className="text-xs text-ink-500">Files are stored privately. Uploading the same file twice is detected and refused — nothing is ever overwritten.</p>
    </form>
  );
}
