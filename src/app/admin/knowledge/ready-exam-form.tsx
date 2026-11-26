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

type Clash = { id: string; title: string; status: string } | null;

export function ReadyExamForm({ subjects }: { subjects: { id: string; name: string; minutes: number }[] }) {
  // If the server cuts the request off (time limit), show a clear message instead of an error page.
  const [state, action, pending] = useActionState(async (prev: Awaited<ReturnType<typeof uploadReadyExam>>, fd: FormData) => {
    try {
      return await uploadReadyExam(prev, fd);
    } catch {
      return {
        error:
          "The import stopped before it finished, usually because a long PDF takes more than the server's 5-minute limit. Check the document in the list below and press Retry, or split the PDF into smaller parts.",
      };
    }
  }, undefined);
  const [title, setTitle] = useState("");
  // Live "name already taken" check, debounced. The answer is kept per title, so typing never shows a stale result.
  const [checked, setChecked] = useState<{ title: string; clash: Clash } | null>(null);
  const titleTouched = useRef(false);
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
      {pending ? <ImportProgress title={title.trim()} /> : null}

      <div className={cn("space-y-4", pending && "hidden")}>
        <div className="grid gap-4 md:grid-cols-2">
          <DropZone
            name="paper"
            label="Exam PDF"
            required
            onFiles={(f) => {
              if (f[0] && !titleTouched.current) setTitle(f[0].name.replace(/\.pdf$/i, "").replace(/[_]+/g, " ").trim());
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

        <SubmitButton icon="sparkle" disabled={Boolean(clash) || checking}>
          Upload and build exam
        </SubmitButton>
      </div>
    </form>
  );
}

/** Progress bar while the PDF is uploaded, read by the AI and published. Polls the import's saved progress. */
function ImportProgress({ title }: { title: string }) {
  const [p, setP] = useState<{ pct: number; label: string }>({ pct: 2, label: "Uploading the PDF" });
  const [seconds, setSeconds] = useState(0);
  const [failed, setFailed] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    const poll = async () => {
      try {
        const res = await fetch(`/admin/knowledge/progress?title=${encodeURIComponent(title)}`, { cache: "no-store" });
        const r = (await res.json()) as { pct: number; label: string; failed?: boolean } | null;
        if (alive && r?.failed) setFailed(r.label);
        else if (alive && r) setP((cur) => (r.pct >= cur.pct ? r : cur));
      } catch {
        /* keep the last value; the next poll retries */
      }
    };
    const id = setInterval(poll, 2000);
    const tick = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => {
      alive = false;
      clearInterval(id);
      clearInterval(tick);
    };
  }, [title]);

  const time = `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
  if (failed)
    return (
      <div className="rounded-[var(--radius-lg)] bg-danger-50 p-5 text-sm text-danger-600 ring-1 ring-danger-600/20" role="alert">
        <p className="font-semibold">{title || "This exam"} didn&apos;t finish</p>
        <p className="mt-1">{failed}</p>
      </div>
    );
  return (
    <div className="rounded-[var(--radius-lg)] bg-mark-50/60 p-5 ring-1 ring-mark-500/20" role="status" aria-live="polite">
      <div className="flex items-center justify-between gap-3">
        <p className="flex min-w-0 items-center gap-2 text-sm font-semibold text-ink-950">
          <Spinner size={16} className="shrink-0 text-mark-500" />
          <span className="truncate">{title || "Your exam"}</span>
        </p>
        <span className="font-display text-2xl font-semibold tabular text-mark-600">{p.pct}%</span>
      </div>
      <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-white ring-1 ring-mark-500/15">
        <div className="h-full rounded-full bg-mark-500 transition-[width] duration-700 ease-out" style={{ width: `${Math.max(2, p.pct)}%` }} />
      </div>
      <div className="mt-2 flex justify-between gap-3 text-xs text-ink-600">
        <span>{p.label}…</span>
        <span className="shrink-0 tabular">{time} elapsed</span>
      </div>
      <p className="mt-3 text-xs text-ink-500">This usually takes 2–5 minutes. Keep this tab open until it finishes.</p>
    </div>
  );
}
