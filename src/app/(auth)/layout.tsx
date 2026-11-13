import Link from "next/link";
import { Logo } from "@/components/brand/logo";

const points = [
  "Real timed EST, SAT and ACT practice tests",
  "An explanation for every answer",
  "A score out of 800 and your weakest topic",
  "Your first exam is free, no card needed",
];

export default function AuthLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="grid min-h-screen bg-paper lg:grid-cols-[1fr_1.1fr]">
      {/* Brand panel (desktop) */}
      <aside className="relative hidden overflow-hidden bg-ink-950 p-12 text-paper lg:flex lg:flex-col">
        <div
          aria-hidden
          className="absolute inset-0 opacity-[0.07]"
          style={{ backgroundImage: "linear-gradient(#fff 1px,transparent 1px),linear-gradient(90deg,#fff 1px,transparent 1px)", backgroundSize: "28px 28px" }}
        />
        <Link href="/" aria-label="16hundred home" className="relative">
          <Logo tone="paper" />
        </Link>
        <div className="relative mt-auto max-w-md">
          <p className="font-display text-5xl leading-[1.02]">
            Train smarter.
            <br />
            Score higher.
            <br />
            Reach <span className="italic text-sky" style={{ fontFamily: "var(--f-serif), serif", fontWeight: 400 }}>1600</span>.
          </p>
          <ul className="mt-10 space-y-3.5">
            {points.map((p) => (
              <li key={p} className="flex items-center gap-3 text-[0.9375rem] text-ink-300">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-mark-500 text-xs font-bold text-white">✓</span>
                {p}
              </li>
            ))}
          </ul>
        </div>
        <div
          aria-hidden
          className="relative mt-12 w-56 rotate-[-4deg] self-end bg-[#FFE88A] px-5 pb-4 pt-6 text-[1.45rem] leading-tight text-ink-900 shadow-2xl"
          style={{ fontFamily: "var(--f-hand), cursive" }}
        >
          <span className="absolute -top-2.5 left-1/2 h-5 w-5 -translate-x-1/2 rounded-full bg-[radial-gradient(circle_at_34%_30%,#ff9d9d_0,#ef3b3b_38%,#b0141a_75%)] shadow-md" />
          Every top score started with a first mock. Today&apos;s a good day!
        </div>
      </aside>

      {/* Form */}
      <div className="flex min-h-screen flex-col">
        <header className="flex items-center justify-between px-6 py-5 sm:px-10">
          <Link href="/" aria-label="16hundred home" className="lg:invisible">
            <Logo />
          </Link>
          <Link href="/" className="text-sm text-ink-500 hover:text-ink-950">
            ← Back to site
          </Link>
        </header>
        <main className="flex flex-1 items-start justify-center px-6 pb-16 pt-4 sm:items-center sm:px-10 sm:pt-0">
          <div className="w-full max-w-[420px]">{children}</div>
        </main>
      </div>
    </div>
  );
}
