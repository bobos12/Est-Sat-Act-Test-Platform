"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { btn } from "@/components/admin/btn";
import { toast } from "@/components/admin/client";
import { Icon, Spinner } from "@/components/admin/icons";
import { extractPart, finishImport, startImport, stopImport, type RunOptions } from "./import-actions";

export type Phase = { pct: number; label: string; state: "running" | "done" | "failed" | "stopped"; detail?: string };

/**
 * The whole import, one short request per step: start → each part → finish.
 * Resolves with the final phase; never throws.
 */
export async function runSteps(
  docId: string,
  { opts, fallback, onProgress, shouldStop }: { opts?: RunOptions; fallback?: RunOptions; onProgress: (p: Phase) => void; shouldStop: () => boolean },
): Promise<Phase> {
  try {
    const s = await startImport(docId, opts, fallback);
    if ("error" in s) return { pct: 100, label: "Couldn't start", state: "failed", detail: s.error };
    const run = s.opts;
    const total = s.scopes.length;
    const todo = s.scopes.map((_, i) => i).filter((i) => !s.done.includes(i));
    let completed = s.done.length;
    const at = () => 10 + (70 * completed) / total;
    onProgress({ pct: at(), label: completed ? `Continuing: ${completed} of ${total} parts already read` : `Reading the questions (0 of ${total} parts)`, state: "running" });
    for (const i of todo) {
      if (shouldStop()) return { pct: at(), label: "Stopped", state: "stopped" };
      const r = await extractPart(docId, i, total, completed, run);
      if ("error" in r) return { pct: at(), label: r.stopped ? "Stopped" : "Failed", state: r.stopped ? "stopped" : "failed", detail: r.error };
      completed++;
      onProgress({ pct: at(), label: `Reading the questions (${completed} of ${total} parts)`, state: "running" });
    }
    if (shouldStop()) return { pct: 80, label: "Stopped", state: "stopped" };
    onProgress({ pct: 85, label: "Capturing figures, saving and publishing", state: "running" });
    const f = await finishImport(docId, total, run);
    if ("error" in f) return { pct: 85, label: "Failed", state: "failed", detail: f.error };
    return { pct: 100, label: "Done", state: "done", detail: f.ok };
  } catch (e) {
    return { pct: 100, label: "Failed", state: "failed", detail: e instanceof Error ? e.message : "The connection was lost." };
  }
}

/**
 * Runs an import step by step from the browser and shows its progress.
 * Mount it to start; it calls onFinish when the run ends (successfully or not).
 */
export function ImportRun({
  docId,
  title,
  opts,
  fallback,
  onFinish,
}: {
  docId: string;
  title: string;
  /** Settings chosen at upload. */
  opts?: RunOptions;
  /** Used only when no settings were saved for this paper. */
  fallback?: RunOptions;
  onFinish?: (ok: boolean) => void;
}) {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>({ pct: 5, label: "Getting ready", state: "running" });
  const [seconds, setSeconds] = useState(0);
  const stop = useRef(false);
  const started = useRef(false);

  useEffect(() => {
    const tick = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(tick);
  }, []);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    const end = (p: Phase) => {
      setPhase(p);
      if (p.state === "done") toast(p.detail ?? "Import finished", "success");
      onFinish?.(p.state === "done");
      router.refresh();
    };
    runSteps(docId, { opts, fallback, onProgress: setPhase, shouldStop: () => stop.current }).then(end);
  }, [docId, opts, fallback, onFinish, router]);

  const time = `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
  const pct = Math.round(phase.pct);
  const tone =
    phase.state === "done"
      ? "bg-success-50 ring-success-600/25"
      : phase.state === "failed"
        ? "bg-danger-50 ring-danger-600/25"
        : phase.state === "stopped"
          ? "bg-warning-50 ring-warning-500/30"
          : "bg-mark-50/60 ring-mark-500/20";

  return (
    <div className={`rounded-[var(--radius-lg)] p-5 ring-1 ${tone}`} role="status" aria-live="polite">
      <div className="flex items-center justify-between gap-3">
        <p className="flex min-w-0 items-center gap-2 text-sm font-semibold text-ink-950">
          {phase.state === "running" ? (
            <Spinner size={16} className="shrink-0 text-mark-500" />
          ) : (
            <Icon
              name={phase.state === "done" ? "check" : "alert"}
              size={16}
              className={phase.state === "done" ? "text-success-700" : phase.state === "failed" ? "text-danger-600" : "text-warning-700"}
            />
          )}
          <span className="truncate">{title}</span>
        </p>
        <span className="font-display text-2xl font-semibold tabular text-ink-900">{pct}%</span>
      </div>
      <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-white ring-1 ring-black/5">
        <div
          className={`h-full rounded-full transition-[width] duration-700 ease-out ${phase.state === "done" ? "bg-success-600" : phase.state === "failed" ? "bg-danger-600" : phase.state === "stopped" ? "bg-warning-500" : "bg-mark-500"}`}
          style={{ width: `${Math.max(3, pct)}%` }}
        />
      </div>
      <div className="mt-2 flex justify-between gap-3 text-xs text-ink-600">
        <span>
          {phase.label}
          {phase.state === "running" ? "…" : ""}
        </span>
        <span className="shrink-0 tabular">{time}</span>
      </div>
      {phase.detail ? <p className={`mt-3 text-sm ${phase.state === "failed" ? "text-danger-600" : phase.state === "done" ? "text-success-700" : "text-ink-700"}`}>{phase.detail}</p> : null}
      {phase.state === "running" ? (
        <div className="mt-4 flex items-center justify-between gap-3">
          <p className="text-xs text-ink-500">Keep this tab open. If you leave, press Run import later and it continues from the last finished part.</p>
          <button
            type="button"
            onClick={async () => {
              stop.current = true;
              setPhase((p) => ({ ...p, label: "Stopping after the current part" }));
              await stopImport(docId);
            }}
            className={btn("danger-outline", "sm")}
          >
            Stop
          </button>
        </div>
      ) : phase.state === "stopped" || phase.state === "failed" ? (
        <p className="mt-3 text-xs text-ink-500">Parts that finished are kept. Press Run import on the document to continue.</p>
      ) : null}
    </div>
  );
}

/** "Run import" for a paper that hasn't been imported (new, failed, stopped or timed out). */
export function RunImportButton({ docId, title, label = "Run import", fallback }: { docId: string; title: string; label?: string; fallback?: RunOptions }) {
  const [running, setRunning] = useState(false);
  const [runKey, setRunKey] = useState(0);
  if (running)
    return (
      <div className="w-full">
        <ImportRun key={runKey} docId={docId} title={title} fallback={fallback} />
      </div>
    );
  return (
    <button
      type="button"
      onClick={() => {
        setRunKey((k) => k + 1);
        setRunning(true);
      }}
      className={btn("dark", "md")}
    >
      <Icon name="sparkle" size={15} /> {label}
    </button>
  );
}

/** Mark a stuck "processing" import as stopped, so it can be run again. */
export function StopImportButton({ docId, size = "sm" }: { docId: string; size?: "xs" | "sm" }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() =>
        start(async () => {
          await stopImport(docId);
          toast("Import stopped. You can run it again any time.", "info");
          router.refresh();
        })
      }
      className={btn("danger-outline", size)}
    >
      {pending ? <Spinner size={12} /> : null} Stop
    </button>
  );
}
