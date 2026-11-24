"use client";

import { useEffect } from "react";

const editable = (t: EventTarget | null) => t instanceof Element && Boolean(t.closest("input, textarea, [contenteditable='true']"));

/**
 * Exam, practice and review screens only:
 *  - leak tracing: a near-invisible repeating pattern with the student's code and the date
 *    (see lib/watermark.ts; the same code is hidden in the question text);
 *  - no copying, cutting or dragging content out, and printing shows a notice
 *    (CSS: body.ts-protected in globals.css). Text selection stays on where the exam
 *    highlighter needs it ([data-hl-scope]) and in answer boxes.
 * Never blocks clicks, right-click or keyboard shortcuts.
 */
export function ContentGuard({ code, date }: { code: string; date: string }) {
  useEffect(() => {
    const block = (e: Event) => {
      if (!editable(e.target)) e.preventDefault();
    };
    document.body.classList.add("ts-protected");
    document.addEventListener("copy", block);
    document.addEventListener("cut", block);
    document.addEventListener("dragstart", block);
    return () => {
      document.body.classList.remove("ts-protected");
      document.removeEventListener("copy", block);
      document.removeEventListener("cut", block);
      document.removeEventListener("dragstart", block);
    };
  }, []);

  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="300" height="180">` +
    `<g transform="rotate(-24 150 90)" font-family="ui-monospace,Menlo,Consolas,monospace" font-size="14" fill="#0b1220">` +
    `<text x="20" y="70">TS ${code}</text><text x="160" y="150">${date}</text></g></svg>`;

  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 z-[80] select-none"
      style={{ backgroundImage: `url("data:image/svg+xml,${encodeURIComponent(svg)}")`, opacity: 0.02 }}
    />
  );
}
