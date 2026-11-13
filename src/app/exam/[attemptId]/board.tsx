"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */
export type Tool = "hand" | "pen" | "marker" | "eraser" | "line" | "arrow" | "rect" | "ellipse" | "text" | "laser";
export type Shape = { t: Exclude<Tool, "hand" | "eraser" | "laser">; c: string; w: number; p: number[]; s?: string };
export type BoardSettings = { tool: Tool; color: string; size: number };

export const INK = ["#0A0F1C", "#1559ED", "#E23B3B", "#12A150", "#F08C00", "#8B5CF6"];
export const SIZES = [2, 4, 8];

/* ------------------------------------------------------------------ */
/* Drawing                                                             */
/* ------------------------------------------------------------------ */
function handFont() {
  const v = typeof window === "undefined" ? "" : getComputedStyle(document.documentElement).getPropertyValue("--f-hand").trim();
  return v || "cursive";
}

function drawShape(ctx: CanvasRenderingContext2D, sh: Shape) {
  const p = sh.p;
  ctx.save();
  ctx.strokeStyle = sh.c;
  ctx.fillStyle = sh.c;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.lineWidth = sh.w;
  if (sh.t === "marker") {
    ctx.globalAlpha = 0.32;
    ctx.lineWidth = sh.w * 4 + 8;
    ctx.lineCap = "butt";
  }
  if (sh.t === "pen" || sh.t === "marker") {
    ctx.beginPath();
    ctx.moveTo(p[0], p[1]);
    if (p.length === 2) ctx.lineTo(p[0] + 0.1, p[1] + 0.1);
    for (let i = 2; i < p.length - 2; i += 2) {
      const mx = (p[i] + p[i + 2]) / 2;
      const my = (p[i + 1] + p[i + 3]) / 2;
      ctx.quadraticCurveTo(p[i], p[i + 1], mx, my);
    }
    if (p.length > 2) ctx.lineTo(p[p.length - 2], p[p.length - 1]);
    ctx.stroke();
  } else if (sh.t === "line" || sh.t === "arrow") {
    const [x1, y1, x2, y2] = [p[0], p[1], p[p.length - 2], p[p.length - 1]];
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
    if (sh.t === "arrow") {
      const a = Math.atan2(y2 - y1, x2 - x1);
      const L = 10 + sh.w * 2.5;
      ctx.beginPath();
      ctx.moveTo(x2, y2);
      ctx.lineTo(x2 - L * Math.cos(a - 0.45), y2 - L * Math.sin(a - 0.45));
      ctx.moveTo(x2, y2);
      ctx.lineTo(x2 - L * Math.cos(a + 0.45), y2 - L * Math.sin(a + 0.45));
      ctx.stroke();
    }
  } else if (sh.t === "rect") {
    const [x1, y1, x2, y2] = [p[0], p[1], p[p.length - 2], p[p.length - 1]];
    ctx.strokeRect(Math.min(x1, x2), Math.min(y1, y2), Math.abs(x2 - x1), Math.abs(y2 - y1));
  } else if (sh.t === "ellipse") {
    const [x1, y1, x2, y2] = [p[0], p[1], p[p.length - 2], p[p.length - 1]];
    ctx.beginPath();
    ctx.ellipse((x1 + x2) / 2, (y1 + y2) / 2, Math.abs(x2 - x1) / 2 || 1, Math.abs(y2 - y1) / 2 || 1, 0, 0, Math.PI * 2);
    ctx.stroke();
  } else if (sh.t === "text" && sh.s) {
    ctx.font = `600 ${18 + sh.w * 3}px ${handFont()}`;
    ctx.textBaseline = "top";
    sh.s.split("\n").forEach((line, i) => ctx.fillText(line, p[0], p[1] + i * (22 + sh.w * 3)));
  }
  ctx.restore();
}

/** Pen-shaped cursor in the current ink colour, with the tip as the hotspot. */
function penCursor(color: string) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24"><path d="M16.5 3.5a2.1 2.1 0 013 3L7 19l-4 1 1-4z" fill="${color}" stroke="white" stroke-width="1.6" stroke-linejoin="round"/></svg>`;
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}") 3 25, crosshair`;
}

/** Points along a shape, for the eraser's hit test. */
function samples(sh: Shape): number[] {
  const p = sh.p;
  if (sh.t === "pen" || sh.t === "marker") return p;
  const [x1, y1, x2, y2] = [p[0], p[1], p[p.length - 2] ?? p[0], p[p.length - 1] ?? p[1]];
  const out: number[] = [];
  const seg = (ax: number, ay: number, bx: number, by: number) => {
    const n = Math.max(2, Math.ceil(Math.hypot(bx - ax, by - ay) / 6));
    for (let i = 0; i <= n; i++) out.push(ax + ((bx - ax) * i) / n, ay + ((by - ay) * i) / n);
  };
  if (sh.t === "line" || sh.t === "arrow") seg(x1, y1, x2, y2);
  else if (sh.t === "rect") {
    seg(x1, y1, x2, y1);
    seg(x2, y1, x2, y2);
    seg(x2, y2, x1, y2);
    seg(x1, y2, x1, y1);
  } else if (sh.t === "ellipse") {
    for (let a = 0; a < Math.PI * 2; a += 0.08) out.push((x1 + x2) / 2 + (Math.abs(x2 - x1) / 2) * Math.cos(a), (y1 + y2) / 2 + (Math.abs(y2 - y1) / 2) * Math.sin(a));
  } else if (sh.t === "text") {
    const w = (sh.s?.length ?? 1) * (9 + sh.w * 1.5);
    for (let x = x1; x <= x1 + w; x += 8) for (let y = y1; y <= y1 + 26; y += 8) out.push(x, y);
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* Draw layer: a canvas over a scrolling area, scrolling with it.      */
/* ------------------------------------------------------------------ */
export function DrawLayer({
  shapes,
  onCommit,
  settings,
  active,
}: {
  shapes: Shape[];
  onCommit: (next: Shape[]) => void;
  settings: BoardSettings;
  active: boolean;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const draft = useRef<Shape | null>(null);
  const laser = useRef<{ x: number; y: number; t: number }[]>([]);
  const erased = useRef<Set<number> | null>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [textAt, setTextAt] = useState<{ x: number; y: number } | null>(null);
  const [textVal, setTextVal] = useState("");
  const raf = useRef(0);
  const renderRef = useRef<() => void>(() => {});

  // Size to the scrolling content (parent's scroll size).
  useEffect(() => {
    const host = canvas.current?.parentElement;
    if (!host) return;
    const measure = () => setSize({ w: host.clientWidth, h: host.scrollHeight });
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(host);
    for (const child of Array.from(host.children)) if (child !== canvas.current) ro.observe(child);
    return () => ro.disconnect();
  }, []);

  const render = useCallback(() => {
    const cv = canvas.current;
    if (!cv) return;
    const ctx = cv.getContext("2d")!;
    const d = Math.min(window.devicePixelRatio || 1, 2);
    ctx.setTransform(d, 0, 0, d, 0, 0);
    ctx.clearRect(0, 0, cv.width, cv.height);
    shapes.forEach((sh, i) => {
      if (erased.current?.has(i)) return;
      drawShape(ctx, sh);
    });
    if (draft.current) drawShape(ctx, draft.current);
    // Laser trail fades over ~700ms.
    const now = performance.now();
    laser.current = laser.current.filter((pt) => now - pt.t < 700);
    if (laser.current.length) {
      ctx.save();
      ctx.lineCap = "round";
      for (let i = 1; i < laser.current.length; i++) {
        const a = laser.current[i - 1];
        const b = laser.current[i];
        const life = 1 - (now - b.t) / 700;
        ctx.strokeStyle = `rgba(239,59,59,${life})`;
        ctx.lineWidth = 6 * life + 2;
        ctx.shadowColor = "rgba(239,59,59,.8)";
        ctx.shadowBlur = 12;
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
      }
      ctx.restore();
      raf.current = requestAnimationFrame(() => renderRef.current());
    }
  }, [shapes]);
  useEffect(() => {
    renderRef.current = render;
  }, [render]);

  useEffect(() => {
    const cv = canvas.current;
    if (!cv) return;
    const d = Math.min(window.devicePixelRatio || 1, 2);
    cv.width = Math.max(1, size.w * d);
    cv.height = Math.max(1, size.h * d);
    render();
  }, [size, render]);

  useEffect(() => () => cancelAnimationFrame(raf.current), []);

  const pos = (e: React.PointerEvent) => {
    const r = canvas.current!.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };

  const eraseAt = (x: number, y: number) => {
    const rad = 12 + settings.size * 2;
    shapes.forEach((sh, i) => {
      if (erased.current!.has(i)) return;
      const pts = samples(sh);
      for (let k = 0; k < pts.length; k += 2) {
        if (Math.hypot(pts[k] - x, pts[k + 1] - y) < rad + sh.w) {
          erased.current!.add(i);
          break;
        }
      }
    });
  };

  const down = (e: React.PointerEvent) => {
    if (!active || e.button > 0) return;
    const { x, y } = pos(e);
    const { tool, color, size: w } = settings;
    if (tool === "text") {
      e.preventDefault();
      setTextAt({ x, y });
      setTextVal("");
      return;
    }
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    if (tool === "laser") {
      laser.current.push({ x, y, t: performance.now() });
      cancelAnimationFrame(raf.current);
      raf.current = requestAnimationFrame(render);
    } else if (tool === "eraser") {
      erased.current = new Set();
      eraseAt(x, y);
      render();
    } else if (tool !== "hand") {
      const width = e.pointerType === "pen" && e.pressure > 0 ? w * (0.6 + e.pressure) : w;
      draft.current = { t: tool, c: color, w: width, p: [x, y] };
      render();
    }
  };

  const move = (e: React.PointerEvent) => {
    if (!active) return;
    const { x, y } = pos(e);
    const { tool } = settings;
    if (tool === "laser" && (e.buttons || e.pointerType !== "mouse")) {
      laser.current.push({ x, y, t: performance.now() });
      cancelAnimationFrame(raf.current);
      raf.current = requestAnimationFrame(render);
      return;
    }
    if (erased.current) {
      eraseAt(x, y);
      render();
      return;
    }
    const dft = draft.current;
    if (!dft) return;
    if (dft.t === "pen" || dft.t === "marker") {
      const n = dft.p.length;
      if (Math.hypot(x - dft.p[n - 2], y - dft.p[n - 1]) > 1.5) dft.p.push(x, y);
    } else {
      dft.p = [dft.p[0], dft.p[1], x, y];
      if (e.shiftKey && (dft.t === "rect" || dft.t === "ellipse")) {
        const s = Math.max(Math.abs(x - dft.p[0]), Math.abs(y - dft.p[1]));
        dft.p = [dft.p[0], dft.p[1], dft.p[0] + Math.sign(x - dft.p[0]) * s, dft.p[1] + Math.sign(y - dft.p[1]) * s];
      }
    }
    render();
  };

  const up = () => {
    if (erased.current) {
      const gone = erased.current;
      erased.current = null;
      if (gone.size) onCommit(shapes.filter((_, i) => !gone.has(i)));
      else render();
      return;
    }
    const dft = draft.current;
    draft.current = null;
    if (!dft) return;
    const tiny = dft.p.length >= 4 && Math.hypot(dft.p[2] - dft.p[0], dft.p[3] - dft.p[1]) < 3 && dft.t !== "pen" && dft.t !== "marker";
    if (tiny || (dft.t !== "pen" && dft.t !== "marker" && dft.p.length < 4)) return render();
    onCommit([...shapes, { ...dft, p: dft.p.map((v) => Math.round(v * 10) / 10) }]);
  };

  const commitText = () => {
    if (textAt && textVal.trim()) onCommit([...shapes, { t: "text", c: settings.color, w: settings.size, p: [textAt.x, textAt.y], s: textVal.trim() }]);
    setTextAt(null);
    setTextVal("");
  };

  const cursor = !active
    ? undefined
    : settings.tool === "eraser"
      ? "cell"
      : settings.tool === "text"
        ? "text"
        : settings.tool === "laser"
          ? "none"
          : penCursor(settings.color);

  return (
    <>
      <canvas
        ref={canvas}
        aria-hidden="true"
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={up}
        onPointerCancel={up}
        className="absolute left-0 top-0 z-10"
        style={{
          width: size.w,
          height: size.h,
          pointerEvents: active ? "auto" : "none",
          touchAction: active ? "none" : "auto",
          cursor,
        }}
      />
      {textAt ? (
        <textarea
          autoFocus
          value={textVal}
          onChange={(e) => setTextVal(e.target.value)}
          onBlur={commitText}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              commitText();
            }
            if (e.key === "Escape") setTextAt(null);
          }}
          placeholder="Type, then press Enter"
          rows={1}
          className="absolute z-20 min-w-[180px] resize rounded-md bg-white/90 px-2 py-1 shadow-lg outline-none ring-2 ring-mark-500"
          style={{ left: textAt.x, top: textAt.y, color: settings.color, fontFamily: "var(--f-hand), cursive", fontWeight: 600, fontSize: 18 + settings.size * 3 }}
        />
      ) : null}
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Toolbar                                                             */
/* ------------------------------------------------------------------ */
const TOOLS: { t: Tool; label: string; key: string; icon: React.ReactNode }[] = [
  { t: "hand", label: "Scroll & select", key: "V", icon: <path d="M8 13V5.5a1.5 1.5 0 013 0V12m0-1.5v-3a1.5 1.5 0 013 0V12m0-2.5a1.5 1.5 0 013 0V15a6 6 0 01-6 6h-1.5a6 6 0 01-4.8-2.4L3.5 15.5a1.6 1.6 0 012.5-2L8 15" /> },
  { t: "pen", label: "Pen", key: "P", icon: <path d="M12 20h9M16.5 3.5a2.1 2.1 0 013 3L7 19l-4 1 1-4z" /> },
  { t: "marker", label: "Marker", key: "M", icon: <><path d="M9 11l-6 6v3h9l3-3" /><path d="M22 12l-4.6 4.6a2 2 0 01-2.8 0l-5.2-5.2a2 2 0 010-2.8L14 4" /></> },
  { t: "eraser", label: "Eraser", key: "E", icon: <><path d="M20 20H7L3 16a2 2 0 010-2.8L13.2 3a2 2 0 012.8 0L21 8a2 2 0 010 2.8L11 21" /><path d="M6 11l7 7" /></> },
  { t: "line", label: "Line", key: "L", icon: <path d="M5 19L19 5" /> },
  { t: "arrow", label: "Arrow", key: "A", icon: <><path d="M5 19L19 5" /><path d="M10 5h9v9" /></> },
  { t: "rect", label: "Box", key: "R", icon: <rect x="4" y="6" width="16" height="12" rx="1.5" /> },
  { t: "ellipse", label: "Circle", key: "O", icon: <ellipse cx="12" cy="12" rx="8.5" ry="6.5" /> },
  { t: "text", label: "Text", key: "T", icon: <path d="M5 6V4h14v2M12 4v16M9 20h6" /> },
  { t: "laser", label: "Laser pointer", key: "K", icon: <><circle cx="12" cy="12" r="3" fill="currentColor" /><path d="M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M5 19l2-2M17 7l2-2" /></> },
];

export function BoardToolbar({
  settings,
  setSettings,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
  onClear,
  onClose,
  inkCount,
}: {
  settings: BoardSettings;
  setSettings: (s: BoardSettings) => void;
  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  onClear: () => void;
  onClose: () => void;
  inkCount: number;
}) {
  const [full, setFull] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  useEffect(() => {
    const on = () => setFull(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", on);
    return () => document.removeEventListener("fullscreenchange", on);
  }, []);

  // Shortcuts while the board is open.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (el && /input|textarea|select/i.test(el.tagName)) return;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
        e.preventDefault();
        if (e.shiftKey) onRedo();
        else onUndo();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "y") {
        e.preventDefault();
        onRedo();
        return;
      }
      if (e.key === "Escape") return onClose();
      const t = TOOLS.find((x) => x.key.toLowerCase() === e.key.toLowerCase());
      if (t) setSettings({ ...settings, tool: t.t });
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [settings, setSettings, onUndo, onRedo, onClose]);

  const btn = "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition";
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-20 z-50 flex justify-center px-3">
      <div
        role="toolbar"
        aria-label="Board tools"
        className="pointer-events-auto flex max-w-full items-center gap-1 overflow-x-auto rounded-2xl bg-ink-950/95 p-1.5 text-paper shadow-[0_20px_50px_-12px_rgba(10,15,28,.6)] ring-1 ring-white/10 backdrop-blur [scrollbar-width:none]"
      >
        {TOOLS.map((t) => (
          <button
            key={t.t}
            type="button"
            onClick={() => setSettings({ ...settings, tool: t.t })}
            aria-pressed={settings.tool === t.t}
            title={`${t.label} (${t.key})`}
            aria-label={t.label}
            className={cn(btn, settings.tool === t.t ? "bg-mark-500 text-white" : "text-ink-300 hover:bg-white/10 hover:text-white")}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              {t.icon}
            </svg>
          </button>
        ))}

        <span className="mx-1 h-7 w-px shrink-0 bg-white/15" />
        {INK.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => setSettings({ ...settings, color: c, tool: ["hand", "eraser", "laser"].includes(settings.tool) ? "pen" : settings.tool })}
            aria-label={`Colour ${c}`}
            className={cn("h-7 w-7 shrink-0 rounded-full ring-2 transition", settings.color === c ? "ring-white" : "ring-transparent hover:ring-white/40")}
            style={{ background: c, boxShadow: c === "#0A0F1C" ? "inset 0 0 0 2px rgba(255,255,255,.35)" : undefined }}
          />
        ))}

        <span className="mx-1 h-7 w-px shrink-0 bg-white/15" />
        {SIZES.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setSettings({ ...settings, size: s })}
            aria-label={`Size ${s}`}
            className={cn(btn, "w-9", settings.size === s ? "bg-white/15" : "hover:bg-white/10")}
          >
            <span className="rounded-full bg-white" style={{ width: s + 4, height: s + 4 }} />
          </button>
        ))}

        <span className="mx-1 h-7 w-px shrink-0 bg-white/15" />
        <button type="button" onClick={onUndo} disabled={!canUndo} title="Undo (Ctrl+Z)" aria-label="Undo" className={cn(btn, "text-ink-300 hover:bg-white/10 hover:text-white disabled:opacity-30")}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 14L4 9l5-5" /><path d="M4 9h10.5a5.5 5.5 0 010 11H11" /></svg>
        </button>
        <button type="button" onClick={onRedo} disabled={!canRedo} title="Redo (Ctrl+Shift+Z)" aria-label="Redo" className={cn(btn, "text-ink-300 hover:bg-white/10 hover:text-white disabled:opacity-30")}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 14l5-5-5-5" /><path d="M20 9H9.5a5.5 5.5 0 000 11H13" /></svg>
        </button>
        {confirmClear ? (
          <button
            type="button"
            onClick={() => {
              onClear();
              setConfirmClear(false);
            }}
            onBlur={() => setConfirmClear(false)}
            autoFocus
            className="h-10 shrink-0 rounded-xl bg-danger-600 px-3 text-xs font-bold text-white"
          >
            Clear this page?
          </button>
        ) : (
          <button type="button" onClick={() => setConfirmClear(true)} disabled={!inkCount} title="Clear this page" aria-label="Clear this page" className={cn(btn, "text-ink-300 hover:bg-white/10 hover:text-white disabled:opacity-30")}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14" /></svg>
          </button>
        )}
        <button
          type="button"
          onClick={() => (document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen?.())}
          title={full ? "Exit full screen" : "Full screen (for a projector)"}
          aria-label="Full screen"
          className={cn(btn, "text-ink-300 hover:bg-white/10 hover:text-white")}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            {full ? <path d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5" /> : <path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" />}
          </svg>
        </button>
        <span className="mx-1 h-7 w-px shrink-0 bg-white/15" />
        <button type="button" onClick={onClose} className="h-10 shrink-0 rounded-xl bg-white px-4 text-sm font-semibold text-ink-950 hover:bg-paper-2">
          Done
        </button>
      </div>
    </div>
  );
}
