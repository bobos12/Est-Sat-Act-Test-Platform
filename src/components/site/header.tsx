import Link from "next/link";
import { Suspense } from "react";
import { Logo } from "@/components/brand/logo";
import { ButtonLink } from "@/components/ui/button";
import { getViewer } from "@/lib/auth/session";
import { signOut } from "@/app/(auth)/actions";

const nav = [
  { href: "/exams?track=sat", label: "SAT" },
  { href: "/exams?track=act", label: "ACT" },
  { href: "/exams?track=est", label: "EST" },
  { href: "/exams", label: "Exams" },
  { href: "/pricing", label: "Pricing" },
  { href: "/#contact", label: "Contact" },
];

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-line/70 bg-paper/90 backdrop-blur supports-[backdrop-filter]:bg-paper/75">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-8 px-5 sm:px-6">
        <Link href="/" aria-label="16hundred home" className="shrink-0">
          <Logo />
        </Link>
        <nav aria-label="Main" className="hidden items-center gap-1 md:flex">
          {nav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded-[var(--radius-sm)] px-3 py-2 text-[0.9375rem] text-ink-600 transition-colors hover:text-ink-950"
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-2">
          <Suspense fallback={<div className="h-9 w-40" />}>
            <AccountActions />
          </Suspense>
        </div>
      </div>
      <nav aria-label="Main (mobile)" className="flex gap-1 overflow-x-auto px-3 pb-2 md:hidden">
        {nav.map((item) => (
          <Link key={item.href} href={item.href} className="shrink-0 rounded-full px-3 py-1.5 text-sm text-ink-600 hover:bg-paper-2">
            {item.label}
          </Link>
        ))}
      </nav>
    </header>
  );
}

async function AccountActions() {
  const viewer = await getViewer();
  if (!viewer) {
    return (
      <>
        <ButtonLink href="/sign-in" variant="ghost" size="sm" className="hidden sm:inline-flex">
          Sign in
        </ButtonLink>
        <ButtonLink href="/sign-up" size="sm">
          Start free
        </ButtonLink>
      </>
    );
  }
  return (
    <>
      {viewer.role === "admin" ? (
        <ButtonLink href="/admin" variant="ghost" size="sm" className="hidden sm:inline-flex">
          Admin
        </ButtonLink>
      ) : null}
      <ButtonLink href="/dashboard" variant="secondary" size="sm">
        My exams
      </ButtonLink>
      <form action={signOut}>
        <button type="submit" className="px-2 text-sm text-ink-500 hover:text-ink-950">
          Sign out
        </button>
      </form>
    </>
  );
}
