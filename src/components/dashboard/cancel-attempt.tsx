"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { cancelAttempt } from "@/app/exam/actions";

/** "Cancel" on an in-progress exam card: asks first, then discards the attempt and its answers. */
export function CancelAttempt({ attemptId, title }: { attemptId: string; title: string }) {
  const router = useRouter();
  const ref = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  useEffect(() => {
    const d = ref.current;
    if (open && d && !d.open) d.showModal();
    if (!open && d?.open) d.close();
  }, [open]);

  const confirm = () =>
    start(async () => {
      setError(null);
      const res = await cancelAttempt(attemptId);
      if (!res.ok) {
        setError(res.message ?? "Something went wrong.");
        return;
      }
      setOpen(false);
      router.refresh();
    });

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-full px-3 py-1.5 text-sm font-semibold text-ink-500 ring-1 ring-inset ring-line-strong transition hover:bg-danger-50 hover:text-danger-600 hover:ring-danger-600/40"
      >
        Cancel
      </button>
      <dialog
        ref={ref}
        onClose={() => !pending && setOpen(false)}
        className="m-auto w-[calc(100%-2rem)] max-w-sm rounded-2xl bg-white p-6 text-left shadow-2xl backdrop:bg-ink-950/40"
      >
        <h2 className="text-lg font-semibold text-ink-950">Cancel this exam?</h2>
        <p className="mt-2 text-sm text-ink-600">
          Your answers in <b className="text-ink-900">{title}</b> will be deleted and it won&apos;t count as a result. You can start the exam again from the beginning any
          time.
        </p>
        {error ? <p className="mt-3 rounded-lg bg-danger-50 px-3 py-2 text-sm text-danger-600">{error}</p> : null}
        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            disabled={pending}
            onClick={() => setOpen(false)}
            className="h-10 rounded-full px-4 text-sm font-semibold text-ink-700 ring-1 ring-inset ring-line-strong hover:bg-paper-2 disabled:opacity-50"
          >
            Keep exam
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={confirm}
            className="inline-flex h-10 items-center gap-2 rounded-full bg-danger-600 px-4 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-70"
          >
            {pending ? (
              <>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" className="animate-spin" aria-hidden>
                  <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.3" strokeWidth="3" />
                  <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
                </svg>
                Cancelling…
              </>
            ) : (
              "Yes, cancel exam"
            )}
          </button>
        </div>
      </dialog>
    </>
  );
}
