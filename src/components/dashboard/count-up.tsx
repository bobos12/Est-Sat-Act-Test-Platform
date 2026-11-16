"use client";

import { useEffect, useRef, useState } from "react";

/** Counts from 0 to `value` once it scrolls into view. Shows the final number straight away for reduced motion. */
export function CountUp({ value, duration = 1100, suffix = "", delay = 0 }: { value: number; duration?: number; suffix?: string; delay?: number }) {
  const [shown, setShown] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
    let raf = 0;
    let timer: ReturnType<typeof setTimeout>;
    const io = new IntersectionObserver(([e]) => {
      if (!e.isIntersecting) return;
      io.disconnect();
      timer = setTimeout(() => {
        if (reduce) return setShown(value);
        const start = performance.now();
        const tick = (t: number) => {
          const k = Math.min(1, (t - start) / duration);
          setShown(Math.round(value * (1 - Math.pow(1 - k, 3))));
          if (k < 1) raf = requestAnimationFrame(tick);
        };
        raf = requestAnimationFrame(tick);
      }, delay);
    });
    if (ref.current) io.observe(ref.current);
    return () => {
      io.disconnect();
      cancelAnimationFrame(raf);
      clearTimeout(timer);
    };
  }, [value, duration, delay]);
  return (
    <span ref={ref} className="tabular">
      {shown.toLocaleString("en")}
      {suffix}
    </span>
  );
}
