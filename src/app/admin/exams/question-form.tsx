"use client";

import Link from "next/link";
import { useActionState, useRef, useState, useTransition } from "react";
import { RichContentView } from "@/components/exam/rich-content";
import { Button } from "@/components/ui/button";
import { FormMessage, Input } from "@/components/ui/field";
import { Label, Select, Textarea } from "@/components/admin/ui";
import { textToContent } from "@/lib/content";
import { cn } from "@/lib/utils";
import { saveQuestion, uploadQuestionImage } from "./actions";

type Option = { id: string; name: string };
export type QuestionDraft = {
  question_id?: string;
  section_id: string;
  stimulus_id: string | null;
  stimulus_marker: number | null;
  stem: string;
  explanation: string;
  options: Record<"A" | "B" | "C" | "D", string>;
  correct: "A" | "B" | "C" | "D" | "";
  topic_id: string | null;
  skill_id: string | null;
  cognitive_level: string | null;
  difficulty: string;
  status: string;
  origin?: string;
};

const LABELS = ["A", "B", "C", "D"] as const;

export function QuestionForm({
  examId,
  draft,
  sections,
  stimuli,
  topics,
  skills,
  isLiteracy,
}: {
  examId: string;
  draft: QuestionDraft;
  sections: { id: string; title: string }[];
  stimuli: Option[];
  topics: Option[];
  skills: Option[];
  isLiteracy: boolean;
}) {
  const [state, action, pending] = useActionState(saveQuestion, undefined);
  const [stem, setStem] = useState(draft.stem);
  const [options, setOptions] = useState(draft.options);
  const [correct, setCorrect] = useState(draft.correct);
  const [explanation, setExplanation] = useState(draft.explanation);
  const stemRef = useRef<HTMLTextAreaElement>(null);
  const [uploading, startUpload] = useTransition();
  const [uploadError, setUploadError] = useState<string | null>(null);

  function insertImage(file: File) {
    startUpload(async () => {
      setUploadError(null);
      const fd = new FormData();
      fd.set("file", file);
      fd.set("alt", window.prompt("Describe the image for screen readers (e.g. ‘Graph of f and g’)", "Figure") ?? "Figure");
      const res = await uploadQuestionImage(fd);
      if (res.error || !res.markdown) {
        setUploadError(res.error ?? "Upload failed");
        return;
      }
      setStem((s) => `${s.trimEnd()}\n\n${res.markdown}\n`);
    });
  }

  return (
    <form action={action} className="grid gap-8 xl:grid-cols-2">
      <input type="hidden" name="exam_id" value={examId} />
      {draft.question_id ? <input type="hidden" name="question_id" value={draft.question_id} /> : null}

      <div className="space-y-5">
        {state?.error ? <FormMessage>{state.error}</FormMessage> : null}

        <div>
          <div className="flex items-end justify-between">
            <Label htmlFor="stem">Question</Label>
            <label className="mb-1.5 cursor-pointer text-xs font-medium text-ink-600 hover:text-ink-950">
              {uploading ? "Uploading…" : "+ Insert image"}
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp,image/svg+xml"
                className="sr-only"
                onChange={(e) => e.target.files?.[0] && insertImage(e.target.files[0])}
              />
            </label>
          </div>
          <Textarea id="stem" name="stem" ref={stemRef} rows={6} value={stem} onChange={(e) => setStem(e.target.value)} required />
          {uploadError ? <p className="mt-1 text-sm text-danger-600">{uploadError}</p> : null}
          <p className="mt-1.5 text-xs text-ink-500">
            Math: <code>$x^2$</code> inline, <code>$$ … $$</code> on its own line · bold: <code>**text**</code> · table rows: <code>| a | b |</code> ·
            image: <code>![alt](url)</code>{isLiteracy ? <> · passage marker: <code>[[3|underlined words]]</code></> : null}
          </p>
        </div>

        <fieldset>
          <legend className="mb-1.5 text-sm font-medium text-ink-800">Answer choices — select the correct one</legend>
          <div className="space-y-2.5">
            {LABELS.map((l) => (
              <div key={l} className="flex items-start gap-3">
                <label
                  className={cn(
                    "mt-1.5 flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-full text-sm font-semibold ring-1 ring-inset",
                    correct === l ? "bg-success-600 text-white ring-success-600" : "bg-white text-ink-700 ring-line-strong hover:bg-paper-2",
                  )}
                  title={`Mark ${l} as correct`}
                >
                  <input type="radio" name="correct" value={l} checked={correct === l} onChange={() => setCorrect(l)} className="sr-only" />
                  {l}
                </label>
                <Textarea
                  name={`option_${l}`}
                  rows={1}
                  value={options[l]}
                  onChange={(e) => setOptions((o) => ({ ...o, [l]: e.target.value }))}
                  placeholder={l === "C" || l === "D" ? "Optional" : undefined}
                  className="min-h-10"
                />
              </div>
            ))}
          </div>
        </fieldset>

        <div>
          <Label htmlFor="explanation">Explanation (shown after submission)</Label>
          <Textarea id="explanation" name="explanation" rows={4} value={explanation} onChange={(e) => setExplanation(e.target.value)} />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          {sections.length > 1 ? (
            <div>
              <Label htmlFor="section_id">Module</Label>
              <Select id="section_id" name="section_id" defaultValue={draft.section_id}>
                {sections.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.title}
                  </option>
                ))}
              </Select>
            </div>
          ) : (
            <input type="hidden" name="section_id" value={draft.section_id} />
          )}
          {topics.length ? (
            <div>
              <Label htmlFor="topic_id">Topic</Label>
              <Select id="topic_id" name="topic_id" defaultValue={draft.topic_id ?? ""}>
                <option value="">—</option>
                {topics.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </Select>
            </div>
          ) : null}
          {skills.length ? (
            <div>
              <Label htmlFor="skill_id">Skill</Label>
              <Select id="skill_id" name="skill_id" defaultValue={draft.skill_id ?? ""}>
                <option value="">—</option>
                {skills.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </Select>
            </div>
          ) : null}
          <div>
            <Label htmlFor="difficulty">Difficulty</Label>
            <Select id="difficulty" name="difficulty" defaultValue={draft.difficulty}>
              <option value="easy">Foundation</option>
              <option value="medium">Standard</option>
              <option value="hard">Challenging</option>
            </Select>
          </div>
          <div>
            <Label htmlFor="cognitive_level">Cognitive level</Label>
            <Select id="cognitive_level" name="cognitive_level" defaultValue={draft.cognitive_level ?? ""}>
              <option value="">—</option>
              <option value="knowledge">Knowledge</option>
              <option value="application">Application</option>
              <option value="reasoning">Reasoning</option>
              <option value="synthesis">Synthesis</option>
            </Select>
          </div>
          <div>
            <Label htmlFor="stimulus_id">Shared passage / data</Label>
            <Select id="stimulus_id" name="stimulus_id" defaultValue={draft.stimulus_id ?? ""}>
              <option value="">None</option>
              {stimuli.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </Select>
          </div>
          {isLiteracy ? (
            <div>
              <Label htmlFor="stimulus_marker">Passage marker number</Label>
              <Input id="stimulus_marker" name="stimulus_marker" type="number" min={1} defaultValue={draft.stimulus_marker ?? ""} />
            </div>
          ) : null}
        </div>

        <label className="flex items-center gap-2.5 text-sm text-ink-800">
          <input type="checkbox" name="approve" defaultChecked={draft.status === "approved"} className="h-4 w-4 accent-[var(--color-ink-950)]" />
          I have reviewed this question and its answer key (mark as approved)
        </label>

        <div className="flex gap-3">
          <Button type="submit" disabled={pending}>
            {pending ? "Saving…" : "Save question"}
          </Button>
          <Link href={`/admin/exams/${examId}`} className="inline-flex h-10 items-center px-3 text-sm text-ink-600 hover:text-ink-950">
            Cancel
          </Link>
        </div>
      </div>

      <aside className="xl:sticky xl:top-8 xl:self-start">
        <p className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-ink-500">Student preview</p>
        <div className="rounded-[var(--radius-lg)] bg-white p-6 ring-1 ring-line">
          <RichContentView content={textToContent(stem)} className="font-reading text-lg leading-relaxed text-ink-950" />
          <div className="mt-5 grid gap-2">
            {LABELS.filter((l) => options[l].trim()).map((l) => (
              <div
                key={l}
                className={cn(
                  "flex items-start gap-3 rounded-[var(--radius-md)] px-3.5 py-2.5 ring-1 ring-inset",
                  correct === l ? "bg-success-50 ring-success-600" : "ring-line-strong",
                )}
              >
                <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-paper-2 text-xs font-semibold">{l}</span>
                <RichContentView content={textToContent(options[l])} className="flex-1 font-reading [&_p]:my-0" />
              </div>
            ))}
          </div>
          {explanation.trim() ? (
            <div className="mt-5 border-t border-line pt-4">
              <p className="text-xs font-semibold text-ink-500">Explanation</p>
              <RichContentView content={textToContent(explanation)} className="mt-1 text-sm leading-relaxed text-ink-700" />
            </div>
          ) : null}
        </div>
      </aside>
    </form>
  );
}
