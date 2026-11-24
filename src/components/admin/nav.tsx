"use client";

import Link, { useLinkStatus } from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition, type ReactNode } from "react";
import { adminSearch, type SearchHit } from "@/lib/admin/search";
import { cn } from "@/lib/utils";
import { Icon, Spinner, type IconName } from "./icons";

type Item = { href: string; label: string; icon: IconName; exact?: boolean };
const groups: { label: string; items: Item[] }[] = [
  { label: "", items: [{ href: "/admin", label: "Overview", icon: "home", exact: true }] },
  {
    label: "Students & money",
    items: [
      { href: "/admin/students", label: "Students", icon: "users" },
      { href: "/admin/payments", label: "Payments", icon: "wallet" },
      { href: "/admin/billing", label: "Plans & discounts", icon: "tag" },
    ],
  },
  {
    label: "Content",
    items: [
      { href: "/admin/exams", label: "Exams", icon: "exams" },
      { href: "/admin/questions", label: "Question bank", icon: "bank" },
      { href: "/admin/generate", label: "Generate with AI", icon: "sparkle" },
      { href: "/admin/knowledge", label: "PDF imports", icon: "book" },
    ],
  },
  { label: "System", items: [{ href: "/admin/security", label: "Security", icon: "shield" }] },
];
const allItems = groups.flatMap((g) => g.items);

export function AdminNav({ badges }: { badges?: Record<string, number> }) {
  return <NavList pathname={usePathname()} badges={badges} />;
}

/** Static version used while the current path is resolved. */
export function AdminNavFallback() {
  return <NavList pathname="" />;
}

function NavList({ pathname, badges, onNavigate }: { pathname: string; badges?: Record<string, number>; onNavigate?: () => void }) {
  return (
    <nav aria-label="Admin" className="space-y-5">
      {groups.map((g) => (
        <div key={g.label || "top"}>
          {g.label ? <p className="mb-1.5 px-3 text-[0.6875rem] font-semibold uppercase tracking-[0.1em] text-ink-400">{g.label}</p> : null}
          <ul className="space-y-0.5">
            {g.items.map((item) => {
              const active = item.exact ? pathname === item.href : pathname === item.href || pathname.startsWith(`${item.href}/`);
              const badge = badges?.[item.href];
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={onNavigate}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "group flex items-center gap-3 rounded-[10px] px-3 py-2 text-sm font-medium transition",
                      active ? "bg-mark-50 text-mark-700" : "text-ink-600 hover:bg-paper-2 hover:text-ink-950",
                    )}
                  >
                    <Icon name={item.icon} size={18} className={active ? "text-mark-500" : "text-ink-400 group-hover:text-ink-700"} />
                    <span className="flex-1">{item.label}</span>
                    <LinkPending />
                    {badge ? (
                      <span className="min-w-5 rounded-full bg-danger-600 px-1.5 text-center text-[0.6875rem] font-bold leading-5 text-white" title={`${badge} waiting`}>
                        {badge}
                      </span>
                    ) : null}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}

/** Spinner shown inside a nav link while its page is loading. */
function LinkPending() {
  const { pending } = useLinkStatus();
  return <Spinner size={14} className={cn("text-mark-500 transition-opacity", pending ? "opacity-100" : "opacity-0")} />;
}

/* ------------------------------------------------------------------ */
/* Mobile: top bar with a slide-in menu                                */
/* ------------------------------------------------------------------ */

export function MobileNav({ brand, badges }: { brand: ReactNode; badges?: Record<string, number> }) {
  return <MobileNavView brand={brand} badges={badges} pathname={usePathname()} />;
}

/** Static version used while the current path is resolved. */
export function MobileNavFallback({ brand }: { brand: ReactNode }) {
  return <MobileNavView brand={brand} pathname="" />;
}

function MobileNavView({ brand, badges, pathname }: { brand: ReactNode; badges?: Record<string, number>; pathname: string }) {
  const [open, setOpen] = useState(false);
  const current = allItems.find((i) => (i.exact ? pathname === i.href : pathname.startsWith(i.href) && i.href !== "/admin")) ?? allItems[0];
  const total = Object.values(badges ?? {}).reduce((a, b) => a + b, 0);
  return (
    <>
      <div className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-line bg-white/95 px-4 backdrop-blur lg:hidden">
        <button type="button" onClick={() => setOpen(true)} aria-label="Open menu" className="relative -ml-1 rounded-md p-1.5 text-ink-700 hover:bg-paper-2">
          <Icon name="menu" size={22} />
          {total ? <span className="absolute right-0.5 top-0.5 h-2.5 w-2.5 rounded-full bg-danger-600 ring-2 ring-white" /> : null}
        </button>
        <span className="flex-1 truncate text-sm font-semibold text-ink-950">{current.label}</span>
        <SearchTrigger compact />
      </div>
      {open ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-ink-950/40" onClick={() => setOpen(false)} />
          <div className="absolute inset-y-0 left-0 flex w-72 max-w-[85%] animate-[admin-slide_160ms_ease-out] flex-col overflow-y-auto bg-white p-4 shadow-2xl">
            <div className="mb-6 flex items-center justify-between">
              {brand}
              <button type="button" onClick={() => setOpen(false)} aria-label="Close menu" className="rounded-md p-1.5 text-ink-500 hover:bg-paper-2">
                <Icon name="x" size={20} />
              </button>
            </div>
            <NavList pathname={pathname} badges={badges} onNavigate={() => setOpen(false)} />
          </div>
        </div>
      ) : null}
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Command palette (Ctrl+K)                                            */
/* ------------------------------------------------------------------ */

const OPEN_EVENT = "admin:search";

export function SearchTrigger({ compact }: { compact?: boolean }) {
  const open = () => window.dispatchEvent(new Event(OPEN_EVENT));
  if (compact)
    return (
      <button type="button" onClick={open} aria-label="Search" className="rounded-md p-1.5 text-ink-700 hover:bg-paper-2">
        <Icon name="search" size={20} />
      </button>
    );
  return (
    <button
      type="button"
      onClick={open}
      className="flex w-full items-center gap-2.5 rounded-[10px] bg-paper px-3 py-2 text-sm text-ink-500 ring-1 ring-inset ring-line transition hover:text-ink-900 hover:ring-ink-300"
    >
      <Icon name="search" size={16} />
      <span className="flex-1 text-left">Search…</span>
      <kbd className="rounded bg-white px-1.5 font-mono text-[0.6875rem] text-ink-500 ring-1 ring-line">Ctrl K</kbd>
    </button>
  );
}

export function CommandPalette() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [sel, setSel] = useState(0);
  const [pending, startTransition] = useTransition();
  const [navigating, startNav] = useTransition();
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const seq = useRef(0);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    const onOpen = () => setOpen(true);
    window.addEventListener("keydown", onKey);
    window.addEventListener(OPEN_EVENT, onOpen);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener(OPEN_EVENT, onOpen);
    };
  }, []);

  const pages = allItems
    .filter((i) => !q.trim() || i.label.toLowerCase().includes(q.trim().toLowerCase()))
    .map((i) => ({ kind: "page" as const, id: i.href, title: i.label, subtitle: "Go to page", href: i.href, icon: i.icon }));
  const results = [...pages, ...hits.map((h) => ({ ...h, icon: (h.kind === "student" ? "users" : h.kind === "exam" ? "exams" : "wallet") as IconName }))];

  const close = () => {
    setOpen(false);
    setQ("");
    setHits([]);
    setSel(0);
  };
  const go = (href: string) => {
    startNav(() => router.push(href));
    close();
  };
  const search = (v: string) => {
    setQ(v);
    setSel(0);
    clearTimeout(timer.current);
    if (v.trim().length < 2) {
      setHits([]);
      return;
    }
    const id = ++seq.current;
    timer.current = setTimeout(() => {
      startTransition(async () => {
        try {
          const r = await adminSearch(v);
          if (id === seq.current) setHits(r);
        } catch {
          if (id === seq.current) setHits([]);
        }
      });
    }, 220);
  };

  if (!open) return navigating ? <span className="sr-only">Opening…</span> : null;
  return (
    <div className="fixed inset-0 z-[65] flex items-start justify-center bg-ink-950/40 px-4 pt-[12vh] backdrop-blur-[2px]" onClick={close}>
      <div className="w-full max-w-xl animate-[admin-pop_140ms_ease-out] overflow-hidden rounded-[var(--radius-lg)] bg-white shadow-2xl ring-1 ring-line" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-3 border-b border-line px-4">
          {pending ? <Spinner size={18} className="text-mark-500" /> : <Icon name="search" size={18} className="text-ink-400" />}
          <input
            autoFocus
            value={q}
            onChange={(e) => search(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape") close();
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setSel((s) => Math.min(s + 1, results.length - 1));
              }
              if (e.key === "ArrowUp") {
                e.preventDefault();
                setSel((s) => Math.max(s - 1, 0));
              }
              if (e.key === "Enter" && results[sel]) go(results[sel].href);
            }}
            placeholder="Search students, exams, payment references…"
            className="h-14 flex-1 bg-transparent text-[0.9375rem] text-ink-950 placeholder:text-ink-400 focus:outline-none"
          />
          <kbd className="rounded bg-paper-2 px-1.5 font-mono text-[0.6875rem] text-ink-500">Esc</kbd>
        </div>
        <ul className="max-h-[55vh] overflow-y-auto p-2">
          {results.length ? (
            results.map((r, i) => (
              <li key={`${r.kind}-${r.id}`}>
                {i === 0 || results[i - 1].kind !== r.kind ? (
                  <p className="px-3 pb-1 pt-2 text-[0.6875rem] font-semibold uppercase tracking-[0.1em] text-ink-400">
                    {{ page: "Pages", student: "Students", exam: "Exams", payment: "Payments" }[r.kind]}
                  </p>
                ) : null}
                <button
                  type="button"
                  onMouseEnter={() => setSel(i)}
                  onClick={() => go(r.href)}
                  className={cn("flex w-full items-center gap-3 rounded-[10px] px-3 py-2 text-left", sel === i ? "bg-mark-50" : "")}
                >
                  <span className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-lg", sel === i ? "bg-white text-mark-600" : "bg-paper-2 text-ink-500")}>
                    <Icon name={r.icon} size={16} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-ink-950">{r.title}</span>
                    <span className="block truncate text-xs capitalize text-ink-500">{r.subtitle}</span>
                  </span>
                  {sel === i ? <Icon name="chevronRight" size={16} className="text-mark-500" /> : null}
                </button>
              </li>
            ))
          ) : (
            <li className="px-3 py-8 text-center text-sm text-ink-500">{pending ? "Searching…" : q.trim().length < 2 ? "Type at least 2 letters." : "Nothing found."}</li>
          )}
        </ul>
        <div className="flex gap-4 border-t border-line bg-paper px-4 py-2 text-xs text-ink-500">
          <span>↑↓ to move</span>
          <span>Enter to open</span>
          <span>Esc to close</span>
        </div>
      </div>
    </div>
  );
}
