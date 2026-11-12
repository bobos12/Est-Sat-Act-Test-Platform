"use client";
import { useEffect, useRef } from "react";

/** Hero background: blue graph paper, cells light up near the pointer, and a score line climbs to "1600". */
export function GraphPaper() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const cv = ref.current!;
    const ctx = cv.getContext("2d")!;
    const host = cv.parentElement!;
    const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const g = 26;
    const pts = [[0, .92], [.12, .86], [.22, .88], [.33, .74], [.45, .7], [.55, .58], [.66, .6], [.76, .42], [.87, .3], [1, .12]];
    let W = 0, H = 0, mx = -999, my = -999, p = reduce ? 1 : 0, raf = 0;

    const size = () => {
      const d = Math.min(devicePixelRatio || 1, 2), b = cv.getBoundingClientRect();
      W = b.width; H = b.height; cv.width = W * d; cv.height = H * d; ctx.setTransform(d, 0, 0, d, 0, 0);
    };
    const move = (e: PointerEvent) => { const b = cv.getBoundingClientRect(); mx = e.clientX - b.left; my = e.clientY - b.top; };
    const leave = () => { mx = my = -999; };

    const frame = () => {
      ctx.clearRect(0, 0, W, H);
      for (let x = 0; x < W; x += g) for (let y = 0; y < H; y += g) {
        const d = Math.hypot(x + g / 2 - mx, y + g / 2 - my);
        if (d < 110) { ctx.fillStyle = `rgba(21,89,237,${0.09 * (1 - d / 110)})`; ctx.fillRect(x + 1, y + 1, g - 1, g - 1); }
      }
      ctx.lineWidth = 1;
      for (let x = 0, i = 0; x < W; x += g, i++) { ctx.strokeStyle = i % 5 ? "rgba(21,89,237,.06)" : "rgba(21,89,237,.12)"; ctx.beginPath(); ctx.moveTo(x + .5, 0); ctx.lineTo(x + .5, H); ctx.stroke(); }
      for (let y = 0, i = 0; y < H; y += g, i++) { ctx.strokeStyle = i % 5 ? "rgba(21,89,237,.06)" : "rgba(21,89,237,.12)"; ctx.beginPath(); ctx.moveTo(0, y + .5); ctx.lineTo(W, y + .5); ctx.stroke(); }

      const x0 = W * .03, x1 = W * .97, y0 = H * .86, y1 = H * .985;
      const P = pts.map(([a, b]) => [x0 + a * (x1 - x0), y0 + b * (y1 - y0)]);
      const n = Math.max(1, p * (P.length - 1));
      ctx.strokeStyle = "rgba(21,89,237,.3)"; ctx.lineWidth = 2; ctx.lineJoin = "round";
      ctx.beginPath(); ctx.moveTo(P[0][0], P[0][1]);
      let last = P[0];
      for (let i = 1; i <= Math.ceil(n); i++) {
        const f = Math.min(1, n - (i - 1)), a = P[i - 1], b = P[i];
        last = [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f]; ctx.lineTo(last[0], last[1]);
      }
      ctx.stroke();
      for (let i = 0; i <= Math.floor(n); i++) {
        ctx.fillStyle = "#fff"; ctx.strokeStyle = "rgba(21,89,237,.5)"; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(P[i][0], P[i][1], 4, 0, 7); ctx.fill(); ctx.stroke();
      }
      if (p >= 1) {
        ctx.fillStyle = "rgba(21,89,237,.55)"; ctx.beginPath(); ctx.arc(last[0], last[1], 6, 0, 7); ctx.fill();
        ctx.font = "italic 22px 'Instrument Serif', Georgia, serif"; ctx.textAlign = "right"; ctx.fillText("1600", last[0] - 12, last[1] + 7);
      }
      if (p < 1) p = Math.min(1, p + .006);
      if (!reduce) raf = requestAnimationFrame(frame);
    };

    size(); frame();
    addEventListener("resize", size);
    host.addEventListener("pointermove", move);
    host.addEventListener("pointerleave", leave);
    return () => {
      cancelAnimationFrame(raf);
      removeEventListener("resize", size);
      host.removeEventListener("pointermove", move);
      host.removeEventListener("pointerleave", leave);
    };
  }, []);

  return <canvas id="grid" ref={ref} aria-hidden="true" />;
}
