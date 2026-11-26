"use client";

import { useRef, useState } from "react";
import { Spinner } from "@/components/admin/icons";
import { DropZone } from "@/components/admin/drop-zone";
import { importExam } from "./actions";
import { runSteps } from "./import-runner";

type Row = { name: string; state: "waiting" | "working" | "done" | "error"; message?: string; pct?: number };

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
        patch({ message: "Uploading", pct: 2 });
        const res = await importExam(undefined, fd);
        if (res?.error || !res?.docId) {
          patch({ state: "error", message: res?.error ?? "Upload failed" });
          continue;
        }
        const end = await runSteps(res.docId, { opts: res.run, onProgress: (ph) => patch({ message: ph.label, pct: ph.pct }), shouldStop: () => false });
        patch(end.state === "done" ? { state: "done", message: end.detail, pct: 100 } : { state: "error", message: end.detail ?? end.label });
      } catch (e) {
        patch({ state: "error", message: e instanceof Error ? e.message : "Import failed" });
      }
    }
    setBusy(false);
  }

  return (
    <div className="space-y-4">
      <DropZone label="Papers and answer keys" multiple required inputRef={input} disabled={busy} hint="Select or drop several PDFs at once" onFiles={() => setRows([])} />
      <button
        type="button"
        onClick={run}
        disabled={busy}
        className="inline-flex h-10 items-center gap-2 rounded-[var(--radius-md)] bg-ink-950 px-4 text-sm font-semibold text-white hover:bg-ink-800 disabled:opacity-60"
      >
        {busy ? <Spinner size={14} /> : null}
        {busy ? `Importing ${rows.filter((r) => r.state === "done" || r.state === "error").length + 1} of ${rows.length}…` : "Import and publish"}
      </button>
      <p className="text-xs text-ink-500">
        Select papers together with their answer keys. Each pair is read, turned into an exam and published to the library. This takes a few minutes per paper.
      </p>
      {rows.length ? (
        <ul className="space-y-2 text-sm">
          {rows.map((r) => (
            <li key={r.name}>
              <span className="font-medium text-ink-950">{r.name}</span>{" "}
              <span className={r.state === "error" ? "text-danger-600" : r.state === "done" ? "text-success-700" : "text-ink-500"}>
                {r.state === "working" ? `${Math.round(r.pct ?? 0)}% · ${r.message ?? "working"}…` : r.state === "waiting" ? "waiting" : r.message}
              </span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
