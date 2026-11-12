"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const items = [
  { href: "/admin", label: "Overview", exact: true },
  { href: "/admin/exams", label: "Exams" },
  { href: "/admin/generate", label: "Generate exams" },
  { href: "/admin/knowledge", label: "Knowledge base" },
  { href: "/admin/students", label: "Students" },
  { href: "/admin/billing", label: "Plans & payments" },
];

export function AdminNav() {
  return <NavList pathname={usePathname()} />;
}

/** Static version used while the current path is resolved. */
export function AdminNavFallback() {
  return <NavList pathname="" />;
}

function NavList({ pathname }: { pathname: string }) {
  return (
    <nav aria-label="Admin" className="flex gap-1 overflow-x-auto lg:flex-col">
      {items.map((item) => {
        const active = item.exact ? pathname === item.href : pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "shrink-0 rounded-[var(--radius-sm)] px-3 py-2 text-sm transition-colors",
              active ? "bg-ink-950 text-paper" : "text-ink-600 hover:bg-paper-2 hover:text-ink-950",
            )}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
