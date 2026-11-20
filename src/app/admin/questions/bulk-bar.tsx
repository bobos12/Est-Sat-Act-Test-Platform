"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

type Opt = { value: string; label: string };

/**
 * Floating action bar for the question table. Appears once a row is ticked and
 * submits the surrounding form with op = "kind:value".
 */
export function BulkBar({ topics, exams }: { topics: Opt[]; exams: Opt[] }) {
  const ref = useRef<HTMLDivElement>(null);
  const [count, setCount] = useState(0);

  useEffect(() => {
    const form = ref.current?.closest("form");
    if (!form) return;
    // Deferred: the select-all box ticks rows in its own handler, after this listener runs.
    const sync = () => window.setTimeout(() => setCount(form.querySelectorAll<HTMLInputElement>('input[name="ids"]:checked').length), 0);
    form.addEventListener("change", sync);
    sync();
    return () => form.removeEventListener("change", sync);
  }, []);

  const submit = (op: string) => {
    const form = ref.current?.closest("form");
    const input = form?.querySelector<HTMLInputElement>('input[name="op"]');
    if (!form || !input || !op) return;
    input.value = op;
    form.requestSubmit();
  };
  const clear = () => {
    const form = ref.current?.closest("form");
    form?.querySelectorAll<HTMLInputElement>('input[type="checkbox"]').forEach((c) => (c.checked = false));
    setCount(0);
  };

  return (
    <div ref={ref}>
      <input type="hidden" name="op" defaultValue="" />
      <div
        className={cn(
          "fixed inset-x-0 bottom-5 z-40 flex justify-center px-4 transition-all duration-300",
          count ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-6 opacity-0",
        )}
        aria-hidden={!count}
      >
        <div className="flex max-w-full flex-wrap items-center gap-2 rounded-2xl bg-ink-950 p-2 pl-4 text-paper shadow-[0_24px_60px_-20px_rgba(10,15,28,.6)]">
          <span className="mr-1 text-sm font-semibold tabular">{count} selected</span>
          <Btn onClick={() => submit("status:approved")} className="bg-success-600 hover:bg-success-700">
            Approve
          </Btn>
          <Btn onClick={() => submit("status:draft")}>Draft</Btn>
          <Btn onClick={() => submit("status:retired")} className="text-[#F6A3A3] hover:bg-danger-600/25">
            Retire
          </Btn>
          <Menu label="Difficulty" options={[{ value: "difficulty:easy", label: "Easy" }, { value: "difficulty:medium", label: "Medium" }, { value: "difficulty:hard", label: "Hard" }]} onPick={submit} />
          {topics.length ? <Menu label="Move to topic" options={topics.map((t) => ({ value: `category:${t.value}`, label: t.label }))} onPick={submit} /> : null}
          {exams.length ? <Menu label="Add to exam" options={exams.map((e) => ({ value: `exam:${e.value}`, label: e.label }))} onPick={submit} /> : null}
          <button type="button" onClick={clear} className="ml-1 h-9 cursor-pointer rounded-lg px-2.5 text-sm text-ink-400 hover:text-paper" aria-label="Clear selection">
            ✕
          </button>
        </div>
      </div>
    </div>
  );
}

function Btn({ onClick, className, children }: { onClick: () => void; className?: string; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick} className={cn("h-9 cursor-pointer rounded-lg bg-white/10 px-3 text-sm font-semibold transition hover:bg-white/20", className)}>
      {children}
    </button>
  );
}

function Menu({ label, options, onPick }: { label: string; options: Opt[]; onPick: (v: string) => void }) {
  return (
    <select
      aria-label={label}
      value=""
      onChange={(e) => onPick(e.target.value)}
      className="h-9 max-w-44 cursor-pointer rounded-lg bg-white/10 px-2.5 text-sm font-semibold text-paper outline-none transition hover:bg-white/20 [&>option]:text-ink-950"
    >
      <option value="">{label} ▾</option>
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}
