import Link from "next/link";

type Locked = { title: string; questions: number; minutes: number };

/**
 * Upsell shown to students without a membership. Uses real numbers only:
 * the exams they can't open, the questions inside them, and the actual price.
 */
export function UnlockBanner({ locked, compact = false }: { locked: Locked[]; compact?: boolean }) {
  if (!locked.length) return null;
  const questions = locked.reduce((n, e) => n + e.questions, 0);
  const hours = Math.round(locked.reduce((n, e) => n + e.minutes, 0) / 6) / 10;
  const shown = locked.slice(0, compact ? 3 : 4);
  const more = locked.length - shown.length;

  return (
    <section className="relative overflow-hidden rounded-[28px] bg-ink-950 text-paper shadow-[0_30px_70px_-30px_rgba(21,89,237,.55)] ring-1 ring-white/10">
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div className="dash-float absolute -left-24 -top-24 h-80 w-80 rounded-full bg-mark-500/40 blur-3xl" />
        <div className="dash-float absolute -bottom-32 right-1/3 h-72 w-72 rounded-full bg-sky/20 blur-3xl [animation-delay:-6s]" />
        <div className="absolute inset-0 opacity-[0.05]" style={{ backgroundImage: "linear-gradient(#fff 1px,transparent 1px),linear-gradient(90deg,#fff 1px,transparent 1px)", backgroundSize: "30px 30px" }} />
      </div>

      <div className="relative grid gap-8 p-6 sm:p-9 lg:grid-cols-[1.35fr_1fr] lg:items-center">
        {/* The gap */}
        <div>
          <span className="inline-flex items-center gap-2 rounded-full bg-warning-500/15 px-3 py-1 text-xs font-semibold text-[#F6C877] ring-1 ring-inset ring-warning-500/30">
            <span className="h-1.5 w-1.5 rounded-full bg-[#F6C877] motion-safe:animate-pulse" />
            You&apos;re only seeing part of the library
          </span>
          <h2 className="mt-4 font-display text-3xl leading-[1.1] sm:text-4xl">
            {locked.length} full {locked.length === 1 ? "exam is" : "exams are"} locked.
            <span className="block text-sky">That&apos;s {questions.toLocaleString("en")} questions you haven&apos;t practised.</span>
          </h2>
          <p className="mt-4 max-w-xl text-[0.9375rem] leading-relaxed text-ink-300">
            Every official paper is different. The more full, timed mocks you take, the fewer surprises on exam day, and the faster you find the
            topics that cost you points.
          </p>

          <ul className="mt-5 flex flex-wrap gap-2">
            {shown.map((e) => (
              <li key={e.title} className="flex items-center gap-1.5 rounded-xl bg-white/[0.07] px-3 py-2 text-sm ring-1 ring-inset ring-white/10">
                <span aria-hidden>🔒</span>
                <span className="max-w-[16rem] truncate">{e.title}</span>
              </li>
            ))}
            {more > 0 ? <li className="flex items-center rounded-xl bg-white/[0.07] px-3 py-2 text-sm text-ink-300 ring-1 ring-inset ring-white/10">+{more} more</li> : null}
          </ul>

          {!compact ? (
            <dl className="mt-6 grid max-w-md grid-cols-3 gap-3">
              {[
                { k: locked.length, l: "locked exams" },
                { k: questions.toLocaleString("en"), l: "questions" },
                { k: `${hours}h`, l: "of timed practice" },
              ].map((s) => (
                <div key={s.l} className="rounded-2xl bg-white/[0.06] px-3 py-3 ring-1 ring-inset ring-white/10">
                  <dd className="font-display text-2xl tabular">{s.k}</dd>
                  <dt className="text-xs text-ink-400">{s.l}</dt>
                </div>
              ))}
            </dl>
          ) : null}
        </div>

        {/* The offer */}
        <div className="rounded-3xl bg-white p-6 text-ink-950 shadow-2xl">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-mark-500">TargetScore membership</p>
            <span className="rounded-full bg-success-600 px-2.5 py-1 text-[0.6875rem] font-bold text-white">Save up to 52%</span>
          </div>
          <p className="mt-3 flex items-baseline gap-1.5">
            <span className="text-sm text-ink-500">from</span>
            <span className="font-display text-5xl tabular">192</span>
            <span className="text-sm text-ink-500">EGP / month</span>
          </p>
          <p className="text-xs text-ink-500">on the yearly plan · less than 7 EGP a day</p>
          <ul className="mt-5 space-y-2 text-sm">
            {["Every EST, SAT and ACT exam, unlocked", "An explanation for every answer", "Score out of 800 and your weakest topic", "New exams the moment they're published"].map((v) => (
              <li key={v} className="flex gap-2.5">
                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-mark-500 text-[0.6875rem] font-bold text-white">✓</span>
                {v}
              </li>
            ))}
          </ul>
          <Link
            href="/pricing"
            className="mt-6 flex h-13 w-full items-center justify-center gap-2 rounded-2xl bg-mark-500 py-3.5 text-base font-semibold text-white shadow-lg shadow-mark-500/30 transition hover:-translate-y-0.5 hover:bg-mark-600"
          >
            Unlock all {locked.length} {locked.length === 1 ? "exam" : "exams"} →
          </Link>
          <p className="mt-3 text-center text-xs text-ink-500">Instant access after payment · Cancel anytime</p>
        </div>
      </div>
    </section>
  );
}
