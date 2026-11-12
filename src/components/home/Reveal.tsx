"use client";
import { useEffect } from "react";

/** Adds `.in` to every `.rv` element as it scrolls into view; also toggles the nav border. */
export function RevealOnScroll() {
  useEffect(() => {
    const io = new IntersectionObserver(
      (es) => es.forEach((e) => {
        if (!e.isIntersecting) return;
        e.target.classList.add("in");
        if (e.target.id === "report") {
          const arc = document.getElementById("ringArc");
          if (arc) arc.style.strokeDashoffset = String(226.2 * (1 - 0.82));
        }
        const count = (e.target as HTMLElement).querySelector?.("#count");
        if (count && !matchMedia("(prefers-reduced-motion: reduce)").matches) {
          const st = performance.now();
          const tick = (n: number) => {
            const k = Math.min(1, (n - st) / 1800), ease = 1 - Math.pow(1 - k, 3);
            count.textContent = String(Math.round(400 + 1200 * ease));
            if (k < 1) requestAnimationFrame(tick);
          };
          requestAnimationFrame(tick);
        }
        io.unobserve(e.target);
      }),
      { threshold: 0.15 },
    );
    document.querySelectorAll<HTMLElement>(".sh .rv").forEach((el, i) => {
      el.style.transitionDelay = `${(i % 3) * 70}ms`;
      io.observe(el);
    });
    const nav = document.getElementById("nav");
    const onScroll = () => nav?.classList.toggle("scrolled", scrollY > 10);
    addEventListener("scroll", onScroll, { passive: true });
    return () => { io.disconnect(); removeEventListener("scroll", onScroll); };
  }, []);
  return null;
}
