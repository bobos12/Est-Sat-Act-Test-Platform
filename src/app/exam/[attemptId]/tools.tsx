"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

/* ------------------------------------------------------------------ */
/* Small persisted state helper (per device, never required to work). */
/* ------------------------------------------------------------------ */
export function useStored<T>(key: string, initial: T) {
  const [value, setValue] = useState<T>(initial);
  const loaded = useRef(false);
  useEffect(() => {
    try {
      const raw = localStorage.getItem(key);
      // eslint-disable-next-line react-hooks/set-state-in-effect -- hydrate from storage after mount
      if (raw != null) setValue(JSON.parse(raw));
    } catch {
      /* storage blocked */
    }
    loaded.current = true;
  }, [key]);
  useEffect(() => {
    if (!loaded.current) return;
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      /* storage blocked */
    }
  }, [key, value]);
  return [value, setValue] as const;
}

/* ------------------------------------------------------------------ */
/* Highlights: stored as character offsets inside a scope container,  */
/* painted with the CSS Custom Highlight API (no DOM changes, so React */
/* re-renders never wipe them).                                         */
/* ------------------------------------------------------------------ */
export type Mark = { s: number; e: number; c: HighlightColor };
export type HighlightColor = "yellow" | "green" | "pink" | "blue" | "under";
export const COLORS: { c: HighlightColor; label: string; swatch: string }[] = [
  { c: "yellow", label: "Yellow", swatch: "#FDE68A" },
  { c: "green", label: "Green", swatch: "#BBF7D0" },
  { c: "pink", label: "Pink", swatch: "#FBCFE8" },
  { c: "blue", label: "Blue", swatch: "#BFDBFE" },
];

function offsetIn(container: Node, node: Node, offset: number) {
  const r = document.createRange();
  r.setStart(container, 0);
  r.setEnd(node, offset);
  return r.toString().length;
}

function rangeFor(container: Node, s: number, e: number) {
  const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);
  let pos = 0;
  let start: [Node, number] | null = null;
  let end: [Node, number] | null = null;
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    const len = n.textContent?.length ?? 0;
    if (!start && s <= pos + len) start = [n, Math.max(0, s - pos)];
    if (start && e <= pos + len) {
      end = [n, Math.max(0, e - pos)];
      break;
    }
    pos += len;
  }
  if (!start || !end) return null;
  const r = document.createRange();
  r.setStart(start[0], start[1]);
  r.setEnd(end[0], end[1]);
  return r;
}

type HighlightRegistry = { set(name: string, h: unknown): void; delete(name: string): void };
const registry = () => (globalThis as unknown as { CSS?: { highlights?: HighlightRegistry } }).CSS?.highlights;
const HighlightCtor = () => (globalThis as unknown as { Highlight?: new (...r: Range[]) => unknown }).Highlight;

export function useHighlights(attemptId: string, deps: unknown[]) {
  const [marks, setMarks] = useStored<Record<string, Mark[]>>(`16h:hl:${attemptId}`, {});
  const supported = typeof window !== "undefined" && !!registry() && !!HighlightCtor();

  const paint = useCallback(() => {
    const reg = registry();
    const H = HighlightCtor();
    if (!reg || !H) return;
    const byColor: Record<string, Range[]> = {};
    document.querySelectorAll<HTMLElement>("[data-hl-scope]").forEach((el) => {
      for (const m of marks[el.dataset.hlScope!] ?? []) {
        const r = rangeFor(el, m.s, m.e);
        if (r) (byColor[m.c] ??= []).push(r);
      }
    });
    for (const { c } of [...COLORS, { c: "under" as const }]) {
      if (byColor[c]?.length) reg.set(`hl-${c}`, new H(...byColor[c]));
      else reg.delete(`hl-${c}`);
    }
  }, [marks]);

  useEffect(() => {
    const id = requestAnimationFrame(paint);
    return () => cancelAnimationFrame(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- repaint when the visible question/passage changes
  }, [paint, ...deps]);

  const apply = useCallback(
    (scope: string, s: number, e: number, c: HighlightColor | null) =>
      setMarks((all) => {
        const kept = (all[scope] ?? []).filter((m) => (c === "under" ? m.c !== "under" : m.c === "under") || m.e <= s || m.s >= e);
        return { ...all, [scope]: c ? [...kept, { s, e, c }] : kept };
      }),
    [setMarks],
  );
  const clearAll = useCallback(() => setMarks({}), [setMarks]);
  const count = Object.values(marks).reduce((n, l) => n + l.length, 0);
  return { supported, apply, clearAll, count };
}

/** Floating toolbar shown over a text selection inside a [data-hl-scope] area. */
export function SelectionToolbar({ onApply }: { onApply: (scope: string, s: number, e: number, c: HighlightColor | null) => void }) {
  const [sel, setSel] = useState<{ scope: string; s: number; e: number; x: number; y: number } | null>(null);

  useEffect(() => {
    let t: ReturnType<typeof setTimeout>;
    const read = () => {
      clearTimeout(t);
      t = setTimeout(() => {
        const s = window.getSelection();
        if (!s || s.isCollapsed || !s.rangeCount) return setSel(null);
        const r = s.getRangeAt(0);
        const scopeEl = (r.commonAncestorContainer instanceof Element ? r.commonAncestorContainer : r.commonAncestorContainer.parentElement)?.closest<HTMLElement>("[data-hl-scope]");
        if (!scopeEl) return setSel(null);
        const start = offsetIn(scopeEl, r.startContainer, r.startOffset);
        const end = offsetIn(scopeEl, r.endContainer, r.endOffset);
        if (end - start < 1) return setSel(null);
        const box = r.getBoundingClientRect();
        setSel({ scope: scopeEl.dataset.hlScope!, s: start, e: end, x: box.left + box.width / 2, y: box.top });
      }, 120);
    };
    document.addEventListener("selectionchange", read);
    return () => {
      document.removeEventListener("selectionchange", read);
      clearTimeout(t);
    };
  }, []);

  if (!sel) return null;
  const act = (c: HighlightColor | null) => {
    onApply(sel.scope, sel.s, sel.e, c);
    window.getSelection()?.removeAllRanges();
    setSel(null);
  };
  const top = Math.max(8, sel.y - 58);
  return (
    <div
      role="toolbar"
      aria-label="Highlight selection"
      className="fixed z-[60] flex -translate-x-1/2 items-center gap-1 rounded-2xl bg-ink-950 p-1.5 shadow-2xl"
      style={{ left: Math.min(Math.max(sel.x, 140), window.innerWidth - 140), top }}
      onMouseDown={(e) => e.preventDefault()}
    >
      {COLORS.map((c) => (
        <button
          key={c.c}
          type="button"
          onClick={() => act(c.c)}
          aria-label={`Highlight ${c.label}`}
          className="h-8 w-8 rounded-xl ring-2 ring-transparent transition hover:ring-white"
          style={{ background: c.swatch }}
        />
      ))}
      <span className="mx-0.5 h-6 w-px bg-white/20" />
      <button type="button" onClick={() => act("under")} aria-label="Underline" className="flex h-8 w-8 items-center justify-center rounded-xl text-sm font-bold text-white underline decoration-danger-600 decoration-2 underline-offset-2 hover:bg-white/10">
        U
      </button>
      <button type="button" onClick={() => act(null)} aria-label="Remove highlight" className="flex h-8 items-center justify-center rounded-xl px-2.5 text-xs font-semibold text-white hover:bg-white/10">
        Erase
      </button>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Draggable split between passage and question.                       */
/* ------------------------------------------------------------------ */
export function SplitHandle({ onChange, onReset }: { onChange: (ratio: number) => void; onReset: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const start = (e: React.PointerEvent) => {
    const host = ref.current?.parentElement;
    if (!host) return;
    e.preventDefault();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    const rect = host.getBoundingClientRect();
    const move = (ev: PointerEvent) => onChange(Math.min(0.75, Math.max(0.25, (ev.clientX - rect.left) / rect.width)));
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      document.body.style.userSelect = "";
    };
    document.body.style.userSelect = "none";
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };
  return (
    <div
      ref={ref}
      role="separator"
      aria-orientation="vertical"
      aria-label="Drag to resize the passage and question"
      tabIndex={0}
      onPointerDown={start}
      onDoubleClick={onReset}
      onKeyDown={(e) => {
        const host = ref.current?.parentElement;
        const cur = host ? (ref.current!.offsetLeft / host.clientWidth) : 0.5;
        if (e.key === "ArrowLeft") onChange(Math.max(0.25, cur - 0.05));
        if (e.key === "ArrowRight") onChange(Math.min(0.75, cur + 0.05));
      }}
      className="group relative hidden cursor-col-resize touch-none select-none items-center justify-center bg-paper-2 outline-none hover:bg-mark-50 focus-visible:bg-mark-50 md:flex"
    >
      <span className="flex h-14 w-2 flex-col items-center justify-center gap-1 rounded-full bg-white shadow ring-1 ring-line group-hover:ring-mark-500">
        <span className="h-1 w-1 rounded-full bg-ink-400" />
        <span className="h-1 w-1 rounded-full bg-ink-400" />
        <span className="h-1 w-1 rounded-full bg-ink-400" />
      </span>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Tools menu in the header.                                           */
/* ------------------------------------------------------------------ */
export function ToolsMenu({
  fontScale,
  setFontScale,
  highlightCount,
  onClearHighlights,
  highlightSupported,
  hasPassage,
  onLayout,
}: {
  fontScale: number;
  setFontScale: (n: number) => void;
  highlightCount: number;
  onClearHighlights: () => void;
  highlightSupported: boolean;
  hasPassage: boolean;
  onLayout: (ratio: number) => void;
}) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!open) return;
    const close = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [open]);
  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className={cn("flex h-9 items-center gap-1.5 rounded-[var(--radius-md)] px-3 text-sm font-medium ring-1 ring-inset ring-line-strong hover:bg-paper-2", open && "bg-paper-2")}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M12 20h9M16.5 3.5a2.1 2.1 0 013 3L7 19l-4 1 1-4z" />
        </svg>
        <span className="hidden sm:inline">Tools</span>
      </button>
      {open ? (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-11 z-50 w-72 rounded-2xl bg-white p-4 shadow-2xl ring-1 ring-line">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-ink-500">Text size</p>
            <div className="mt-2 flex items-center gap-2">
              <button type="button" onClick={() => setFontScale(Math.max(0.85, +(fontScale - 0.1).toFixed(2)))} className="h-9 w-12 rounded-lg text-sm font-semibold ring-1 ring-line hover:bg-paper-2" aria-label="Smaller text">A−</button>
              <span className="flex-1 text-center text-sm tabular text-ink-600">{Math.round(fontScale * 100)}%</span>
              <button type="button" onClick={() => setFontScale(Math.min(1.4, +(fontScale + 0.1).toFixed(2)))} className="h-9 w-12 rounded-lg text-base font-semibold ring-1 ring-line hover:bg-paper-2" aria-label="Larger text">A+</button>
            </div>

            {hasPassage ? (
              <>
                <p className="mt-5 text-xs font-semibold uppercase tracking-[0.12em] text-ink-500">Layout</p>
                <div className="mt-2 grid grid-cols-3 gap-1.5 text-xs font-medium">
                  {[
                    { l: "More passage", r: 0.65 },
                    { l: "Even", r: 0.5 },
                    { l: "More question", r: 0.35 },
                  ].map((o) => (
                    <button key={o.l} type="button" onClick={() => onLayout(o.r)} className="rounded-lg px-2 py-2 ring-1 ring-line hover:bg-paper-2">
                      {o.l}
                    </button>
                  ))}
                </div>
                <p className="mt-2 text-xs text-ink-500">Or drag the handle between the two halves.</p>
              </>
            ) : null}

            <p className="mt-5 text-xs font-semibold uppercase tracking-[0.12em] text-ink-500">Highlighter</p>
            <p className="mt-1.5 text-sm text-ink-600">
              {highlightSupported
                ? "Select any words in the passage or question to highlight, underline or erase."
                : "Update your browser to use the highlighter."}
            </p>
            {highlightCount ? (
              <button type="button" onClick={onClearHighlights} className="mt-2 text-sm font-medium text-danger-600 hover:underline">
                Clear all {highlightCount} highlights
              </button>
            ) : null}

            <p className="mt-5 text-xs font-semibold uppercase tracking-[0.12em] text-ink-500">Cross out choices</p>
            <p className="mt-1.5 text-sm text-ink-600">Tap the ✕ next to an answer to rule it out, like crossing it off on paper.</p>
          </div>
        </>
      ) : null}
    </div>
  );
}
