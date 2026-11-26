"use client";

import Link from "next/link";
import { useActionState, useEffect, useRef, useState } from "react";
import { ActionMessage, SubmitButton } from "@/components/admin/client";
import { DropZone } from "@/components/admin/drop-zone";
import { Icon, Spinner } from "@/components/admin/icons";
import { Label, Select } from "@/components/admin/ui";
import { Input } from "@/components/ui/field";
import { cn } from "@/lib/utils";
import { examTitleTaken, uploadReadyExam } from "./actions";
import { ImportRun } from "./import-runner";

type Clash = { id: string; title: string; status: string } | null;

type Subjects = { id: string; name: string; minutes: number }[];

/** Best subject for a file name like "EST I HS Literacy Practice Test 3.pdf" (null when unsure). */
function guessSubject(fileName: string, subjects: Subjects) {
  const norm = (x: string) =>
    ` ${x
      .toLowerCase()
      .replace(/\.pdf$/, "")
      .replace(/[^a-z0-9]+/g, " ")
      .replace(/\best\s*(2|ii)\b/g, "est ii")
      .replace(/\best\s*(1|i)\b/g, "est i")
      .replace(/\blevel\s*(1|i)\b/g, "level 1")
      .replace(/\blevel\s*(2|ii)\b/g, "level 2")} `;
  const file = norm(fileName);
  let best: { id: string; score: number } | null = null;
  for (const s of subjects) {
    const words = norm(s.name).trim().split(" ");
    // Every word of the subject name must appear ("est i literacy" needs est, i and literacy).
    if (!words.every((w) => file.includes(` ${w} `))) continue;
    if (!best || words.length > best.score) best = { id: s.id, score: words.length };
  }
  return best?.id ?? null;
}

/** Remounts the form after an import so another exam can be uploaded from a clean slate. */
export function ReadyExamForm({ subjects }: { subjects: Subjects }) {
  const [round, setRound] = useState(0);
  return <ExamUpload key={round} subjects={subjects} onReset={() => setRound((r) => r + 1)} />;
}

function ExamUpload({ subjects, onReset }: { subjects: Subjects; onReset: () => void }) {
  // A lost connection during upload shows a clear message instead of an error page.
  const [state, action, pending] = useActionState(async (prev: Awaited<ReturnType<typeof uploadReadyExam>>, fd: FormData) => {
    try {
      return await uploadReadyExam(prev, fd);
    } catch {
      return { error: "The upload didn't reach the server. Check your connection and try again." };
    }
  }, undefined);
  const [title, setTitle] = useState("");
  // Live "name already taken" check, debounced. The answer is kept per title, so typing never shows a stale result.
  const [checked, setChecked] = useState<{ title: string; clash: Clash } | null>(null);
  const titleTouched = useRef(false);
  const [subjectId, setSubjectId] = useState(subjects[0]?.id ?? "");
  const t = title.trim();
  const checking = t.length >= 3 && checked?.title !== t;
  const clash = checked?.title === t ? checked.clash : null;

  useEffect(() => {
    if (t.length < 3) return;
    const id = setTimeout(async () => {
      try {
        const r = await examTitleTaken(t);
        setChecked({ title: t, clash: r.taken ? { id: r.id, title: r.title, status: r.status } : null });
      } catch {
        setChecked({ title: t, clash: null });
      }
    }, 400);
    return () => clearTimeout(id);
  }, [t]);

  return (
    <form action={action} className="space-y-4">
      <ActionMessage state={state} />
      {pending ? <Uploading /> : null}
      {!pending && state?.docId ? (
        <div className="space-y-3">
          <ImportRun key={state.docId} docId={state.docId} title={state.docTitle ?? title} opts={state.run} />
          <button type="button" onClick={onReset} className="text-sm font-medium text-mark-600 hover:underline">
            Upload another exam
          </button>
        </div>
      ) : null}

      <div className={cn("space-y-4", (pending || state?.docId) && "hidden")}>
        <div className="grid gap-4 md:grid-cols-2">
          <DropZone
            name="paper"
            label="Exam PDF"
            required
            onFiles={(f) => {
              if (!f[0]) return;
              if (!titleTouched.current) setTitle(f[0].name.replace(/\.pdf$/i, "").replace(/[_]+/g, " ").trim());
              const guess = guessSubject(f[0].name, subjects);
              if (guess) setSubjectId(guess);
            }}
          />
          <DropZone name="key" label="Answer key PDF" hint="Without a key the AI works out the answers and flags them for review." />
        </div>

        <div>
          <Label htmlFor="title">Exam title</Label>
          <div className="relative">
            <Input
              id="title"
              name="title"
              value={title}
              onChange={(e) => {
                titleTouched.current = true;
                setTitle(e.target.value);
              }}
              placeholder="e.g. EST I Math: Practice Test 4"
              required
              aria-invalid={clash ? true : undefined}
              className="pr-10"
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2">
              {checking ? (
                <Spinner size={16} className="text-ink-400" />
              ) : title.trim().length >= 3 ? (
                clash ? <Icon name="alert" size={16} className="text-danger-600" /> : <Icon name="check" size={16} className="text-success-600" />
              ) : null}
            </span>
          </div>
          {clash ? (
            <p className="mt-1.5 text-sm text-danger-600">
              This name is already taken by{" "}
              <Link href={`/admin/exams/${clash.id}`} target="_blank" className="font-semibold underline">
                {clash.title}
              </Link>{" "}
              ({clash.status.replace("_", " ")}). Choose a different title.
            </p>
          ) : title.trim().length >= 3 && !checking ? (
            <p className="mt-1.5 text-sm text-success-700">This name is available.</p>
          ) : null}
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
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

        <SubmitButton icon="sparkle" disabled={Boolean(clash) || checking}>
          Upload and build exam
        </SubmitButton>
      </div>
    </form>
  );
}

/** Shown while the PDF files travel to the server, before the import starts. */
function Uploading() {
  return (
    <div className="rounded-[var(--radius-lg)] bg-mark-50/60 p-5 ring-1 ring-mark-500/20" role="status" aria-live="polite">
      <p className="flex items-center gap-2 text-sm font-semibold text-ink-950">
        <Spinner size={16} className="text-mark-500" /> Uploading the PDF…
      </p>
      <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-white ring-1 ring-mark-500/15">
        <div className="h-full w-1/3 animate-pulse rounded-full bg-mark-500" />
      </div>
      <p className="mt-2 text-xs text-ink-500">Next, the AI reads it part by part and you&apos;ll see the percentage here.</p>
    </div>
  );
}
