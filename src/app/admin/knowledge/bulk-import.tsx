"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { importExam } from "./actions";

type Row = { name: string; state: "waiting" | "working" | "done" | "error"; message?: string };

/** Pairs "… Answer Key …" files with their paper by file name, then imports each pair one at a time. */
const norm = (n: string) =>
  n
    .toLowerCase()
    .replace(/\.pdf$/, "")
    .replace(/answer\s*key/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .split(" ")
    .sort()
    .join(" ");

export function BulkImport() {
  const input = useRef<HTMLInputElement>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [busy, setBusy] = useState(false);

  async function run() {
    const files = Array.from(input.current?.files ?? []);
    const keys = new Map(files.filter((f) => /answer\s*key/i.test(f.name)).map((f) => [norm(f.name), f]));
    const papers = files.filter((f) => !/answer\s*key/i.test(f.name));
    if (!papers.length) return;
    setBusy(true);
    setRows(papers.map((p) => ({ name: p.name, state: "waiting" })));
    for (const [i, paper] of papers.entries()) {
      const patch = (r: Partial<Row>) => setRows((cur) => cur.map((x, j) => (j === i ? { ...x, ...r } : x)));
      patch({ state: "working" });
      const fd = new FormData();
      fd.set("paper", paper);
      const key = keys.get(norm(paper.name));
      if (key) fd.set("key", key);
      try {
        const res = await importExam(undefined, fd);
        patch(res?.error ? { state: "error", message: res.error } : { state: "done", message: res?.ok });
      } catch (e) {
        patch({ state: "error", message: e instanceof Error ? e.message : "Import failed" });
      }
    }
    setBusy(false);
  }

  return (
    <div className="space-y-4">
      <input
        ref={input}
        type="file"
        accept="application/pdf"
        multiple
        className="block w-full text-sm text-ink-700 file:mr-3 file:rounded-[var(--radius-md)] file:border-0 file:bg-paper-2 file:px-3 file:py-2 file:text-sm file:font-medium"
      />
      <Button type="button" size="sm" onClick={run} disabled={busy}>
        {busy ? "Importing…" : "Import and publish"}
      </Button>
      <p className="text-xs text-ink-500">
        Select papers together with their answer keys. Each pair is read, turned into an exam and published to the library. This takes a few minutes per paper.
      </p>
      {rows.length ? (
        <ul className="space-y-2 text-sm">
          {rows.map((r) => (
            <li key={r.name}>
              <span className="font-medium text-ink-950">{r.name}</span>{" "}
              <span className={r.state === "error" ? "text-danger-600" : r.state === "done" ? "text-success-700" : "text-ink-500"}>
                {r.state === "working" ? "working…" : r.state === "waiting" ? "waiting" : r.message}
              </span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
