"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

/** "You're verified and signed in" popup, shown once when a page is opened with ?welcome=1 (set by /auth/confirm). */
export function WelcomeDialog() {
  const params = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  const welcome = params.get("welcome") === "1";
  const [open, setOpen] = useState(false);
  const [shown, setShown] = useState(false);
  if (welcome && !shown) {
    setShown(true);
    setOpen(true);
  }

  useEffect(() => {
    if (!welcome) return;
    const rest = new URLSearchParams(params);
    rest.delete("welcome");
    const q = rest.toString();
    router.replace(q ? `${pathname}?${q}` : pathname, { scroll: false });
  }, [welcome, params, pathname, router]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink-950/50 p-4" onClick={() => setOpen(false)}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="welcome-title"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm rounded-[var(--radius-xl)] bg-white p-8 text-center shadow-[var(--shadow-pop)]"
      >
        <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-success-600 text-white shadow-lg shadow-success-600/30">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M5 12.5l4.5 4.5L19 7.5" />
          </svg>
        </span>
        <h2 id="welcome-title" className="mt-5 font-display text-3xl font-medium text-ink-950">
          You&apos;re all set! 🎉
        </h2>
        <p className="mt-2 text-ink-600">Your account is verified and you&apos;re signed in. Let&apos;s get you to your first exam.</p>
        <button
          type="button"
          autoFocus
          onClick={() => setOpen(false)}
          className="mt-6 h-12 w-full rounded-xl bg-mark-500 font-semibold text-white shadow-lg shadow-mark-500/25 hover:bg-mark-600"
        >
          Let&apos;s go
        </button>
      </div>
    </div>
  );
}
