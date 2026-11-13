"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

const SECONDS = 4;

export function Welcome({ next }: { next: string }) {
  const router = useRouter();
  const [left, setLeft] = useState(SECONDS);
  useEffect(() => {
    const t = setInterval(() => setLeft((s) => s - 1), 1000);
    return () => clearInterval(t);
  }, []);
  useEffect(() => {
    if (left <= 0) router.replace(next);
  }, [left, next, router]);

  return (
    <div className="text-center">
      <div className="relative mx-auto h-24 w-24">
        <span className="absolute inset-0 animate-ping rounded-full bg-success-600/20" />
        <span className="relative flex h-24 w-24 items-center justify-center rounded-full bg-success-600 text-white shadow-xl shadow-success-600/30">
          <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M5 12.5l4.5 4.5L19 7.5" />
          </svg>
        </span>
      </div>
      <h1 className="mt-8 font-display text-4xl font-medium text-ink-950">You&apos;re confirmed! 🎉</h1>
      <p className="mt-3 text-lg text-ink-600">Your 16hundred account is ready. Let&apos;s get you to your first exam.</p>

      <div className="mx-auto mt-8 h-1.5 w-56 overflow-hidden rounded-full bg-paper-3">
        <div className="h-full rounded-full bg-mark-500 transition-[width] duration-1000 ease-linear" style={{ width: `${((SECONDS - Math.max(left, 0)) / SECONDS) * 100}%` }} />
      </div>
      <p className="mt-3 text-sm text-ink-500">Taking you there in {Math.max(left, 0)}s…</p>

      <Link
        href={next}
        replace
        className="mt-8 inline-flex h-12 items-center justify-center rounded-xl bg-mark-500 px-8 font-semibold text-white shadow-lg shadow-mark-500/25 hover:bg-mark-600"
      >
        Go now →
      </Link>
    </div>
  );
}
