import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Icon, type IconName } from "./icons";

/* ------------------------------------------------------------------ */
/* Page structure                                                      */
/* ------------------------------------------------------------------ */

export function PageHeader({
  title,
  description,
  actions,
  back,
}: {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  back?: { href: string; label: string };
}) {
  return (
    <div className="mb-6">
      {back ? (
        <Link href={back.href} className="mb-3 inline-flex items-center gap-1 text-sm font-medium text-ink-500 transition hover:text-ink-950">
          <Icon name="chevronLeft" size={16} />
          {back.label}
        </Link>
      ) : null}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <h1 className="font-display text-[1.75rem] font-semibold leading-tight tracking-tight text-ink-950">{title}</h1>
          {description ? <div className="mt-1.5 max-w-3xl text-[0.9375rem] text-ink-600">{description}</div> : null}
        </div>
        {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
      </div>
    </div>
  );
}

export function Panel({
  title,
  description,
  actions,
  children,
  className,
  icon,
}: {
  title?: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  icon?: IconName;
}) {
  return (
    <section className={cn("overflow-hidden rounded-[var(--radius-lg)] bg-white shadow-[0_1px_2px_rgba(10,15,28,0.04)] ring-1 ring-line", className)}>
      {title ? (
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-3.5">
          <div className="flex min-w-0 items-center gap-2.5">
            {icon ? (
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-paper-2 text-ink-600">
                <Icon name={icon} size={15} />
              </span>
            ) : null}
            <div className="min-w-0">
              <h2 className="text-[0.9375rem] font-semibold text-ink-950">{title}</h2>
              {description ? <p className="text-xs text-ink-500">{description}</p> : null}
            </div>
          </div>
          {actions}
        </div>
      ) : null}
      {children}
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Tables                                                              */
/* ------------------------------------------------------------------ */

export function DataTable({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn("overflow-x-auto", className)}>
      <table className="w-full text-left text-sm">{children}</table>
    </div>
  );
}
export function Th({ children, className }: { children?: ReactNode; className?: string }) {
  return (
    <th className={cn("whitespace-nowrap border-b border-line bg-paper/60 px-5 py-2.5 text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-ink-500", className)}>
      {children}
    </th>
  );
}
export function Td({ children, className, ...rest }: ComponentProps<"td">) {
  return (
    <td className={cn("border-b border-line px-5 py-3 align-middle text-ink-800", className)} {...rest}>
      {children}
    </td>
  );
}

export function Empty({ children, icon = "info", action }: { children: ReactNode; icon?: IconName; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center px-5 py-12 text-center">
      <span className="flex h-11 w-11 items-center justify-center rounded-full bg-paper-2 text-ink-400">
        <Icon name={icon} size={20} />
      </span>
      <p className="mt-3 max-w-sm text-sm text-ink-500">{children}</p>
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Form controls                                                       */
/* ------------------------------------------------------------------ */

export function Select({ className, ...props }: ComponentProps<"select">) {
  return (
    <select
      className={cn(
        "h-10 w-full rounded-[var(--radius-md)] bg-white px-3 text-sm text-ink-950 ring-1 ring-inset ring-line-strong focus:outline-none focus:ring-2 focus:ring-mark-500",
        className,
      )}
      {...props}
    />
  );
}

export function Textarea({ className, ...props }: ComponentProps<"textarea">) {
  return (
    <textarea
      className={cn(
        "w-full rounded-[var(--radius-md)] bg-white px-3.5 py-2.5 font-mono text-[0.8125rem] leading-relaxed text-ink-950 ring-1 ring-inset ring-line-strong focus:outline-none focus:ring-2 focus:ring-mark-500",
        className,
      )}
      {...props}
    />
  );
}

export function Label({ htmlFor, children }: { htmlFor?: string; children: ReactNode }) {
  return (
    <label htmlFor={htmlFor} className="mb-1.5 block text-sm font-medium text-ink-800">
      {children}
    </label>
  );
}

/* ------------------------------------------------------------------ */
/* Status and badges                                                   */
/* ------------------------------------------------------------------ */

const statusTone: Record<string, string> = {
  draft: "bg-paper-2 text-ink-700",
  in_review: "bg-warning-50 text-warning-700",
  published: "bg-success-50 text-success-700",
  archived: "bg-paper-3 text-ink-500",
  approved: "bg-success-50 text-success-700",
  retired: "bg-paper-3 text-ink-500",
  active: "bg-success-50 text-success-700",
  expired: "bg-paper-3 text-ink-600",
  canceled: "bg-paper-3 text-ink-600",
  pending: "bg-warning-50 text-warning-700",
  succeeded: "bg-success-50 text-success-700",
  failed: "bg-danger-50 text-danger-600",
  refunded: "bg-info-50 text-info-600",
  uploaded: "bg-paper-2 text-ink-700",
  processing: "bg-info-50 text-info-600",
  extracted: "bg-warning-50 text-warning-700",
  reviewed: "bg-success-50 text-success-700",
  queued: "bg-paper-2 text-ink-700",
  running: "bg-info-50 text-info-600",
  completed: "bg-success-50 text-success-700",
  submitted: "bg-success-50 text-success-700",
  expired_attempt: "bg-paper-3 text-ink-600",
  in_progress: "bg-warning-50 text-warning-700",
};

const statusLabel: Record<string, string> = {
  succeeded: "Paid",
  in_progress: "In progress",
  in_review: "In review",
};

export function StatusBadge({ status, label }: { status: string; label?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium", statusTone[status] ?? "bg-paper-2 text-ink-700")}>
      <span className="h-1.5 w-1.5 rounded-full bg-current opacity-70" />
      {label ?? statusLabel[status] ?? status.replaceAll("_", " ").replace(/^\w/, (c) => c.toUpperCase())}
    </span>
  );
}

type Tone = "neutral" | "success" | "warning" | "danger" | "info" | "brand" | "dark";
const toneCls: Record<Tone, string> = {
  neutral: "bg-paper-2 text-ink-700",
  success: "bg-success-50 text-success-700",
  warning: "bg-warning-50 text-warning-700",
  danger: "bg-danger-50 text-danger-600",
  info: "bg-info-50 text-info-600",
  brand: "bg-mark-50 text-mark-600",
  dark: "bg-ink-950 text-white",
};

export function Badge({ tone = "neutral", icon, children, className }: { tone?: Tone; icon?: IconName; children: ReactNode; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold", toneCls[tone], className)}>
      {icon ? <Icon name={icon} size={12} /> : null}
      {children}
    </span>
  );
}

export function Callout({ tone = "info", title, children, action }: { tone?: "info" | "warning" | "danger" | "success"; title?: ReactNode; children?: ReactNode; action?: ReactNode }) {
  const cls = {
    info: "bg-info-50 text-info-600 ring-info-600/15",
    warning: "bg-warning-50 text-warning-700 ring-warning-500/25",
    danger: "bg-danger-50 text-danger-600 ring-danger-600/20",
    success: "bg-success-50 text-success-700 ring-success-600/20",
  }[tone];
  const icon: IconName = tone === "success" ? "check" : tone === "info" ? "info" : "alert";
  return (
    <div className={cn("flex items-start gap-3 rounded-[var(--radius-md)] px-4 py-3 text-sm ring-1 ring-inset", cls)}>
      <Icon name={icon} size={18} className="mt-0.5 shrink-0" />
      <div className="min-w-0 flex-1">
        {title ? <p className="font-semibold">{title}</p> : null}
        {children ? <div className={title ? "mt-0.5 opacity-90" : ""}>{children}</div> : null}
      </div>
      {action}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Stats                                                               */
/* ------------------------------------------------------------------ */

export function StatCard({
  label,
  value,
  note,
  href,
  icon,
  tone = "neutral",
  active,
}: {
  label: string;
  value: ReactNode;
  note?: ReactNode;
  href?: string;
  icon?: IconName;
  tone?: "neutral" | "success" | "warning" | "danger" | "brand";
  active?: boolean;
}) {
  const iconTone = {
    neutral: "bg-paper-2 text-ink-600",
    success: "bg-success-50 text-success-700",
    warning: "bg-warning-50 text-warning-700",
    danger: "bg-danger-50 text-danger-600",
    brand: "bg-mark-50 text-mark-600",
  }[tone];
  const body = (
    <>
      <div className="flex items-start justify-between gap-3">
        <p className="text-[0.75rem] font-semibold uppercase tracking-[0.08em] text-ink-500">{label}</p>
        {icon ? (
          <span className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-lg", iconTone)}>
            <Icon name={icon} size={16} />
          </span>
        ) : null}
      </div>
      <p className="mt-1 font-display text-[1.75rem] font-semibold leading-tight tabular text-ink-950">{value}</p>
      {note ? <p className="mt-1 text-[0.8125rem] text-ink-500">{note}</p> : null}
    </>
  );
  const cls = cn(
    "block rounded-[var(--radius-lg)] bg-white p-4 shadow-[0_1px_2px_rgba(10,15,28,0.04)] ring-1 transition",
    active ? "ring-2 ring-mark-500" : "ring-line",
    href && "hover:-translate-y-px hover:shadow-md hover:ring-ink-300",
  );
  return href ? (
    <Link href={href} scroll={false} className={cls}>
      {body}
    </Link>
  ) : (
    <div className={cls}>{body}</div>
  );
}

/** Compact key/value list for profile and detail panels. */
export function DetailList({ items }: { items: { label: string; value: ReactNode }[] }) {
  return (
    <dl className="divide-y divide-line">
      {items.map((i) => (
        <div key={i.label} className="grid grid-cols-[130px_1fr] gap-3 px-5 py-2.5 text-sm">
          <dt className="text-ink-500">{i.label}</dt>
          <dd className="min-w-0 break-words text-ink-900">{i.value ?? <span className="text-ink-400">—</span>}</dd>
        </div>
      ))}
    </dl>
  );
}

export function Avatar({ name, size = 36, className }: { name: string; size?: number; className?: string }) {
  const initials =
    name
      .replace(/@.*/, "")
      .split(/[\s._-]+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0]?.toUpperCase())
      .join("") || "?";
  // Stable hue per name, kept within the brand's cool range.
  const hues = ["bg-mark-50 text-mark-700", "bg-success-50 text-success-700", "bg-warning-50 text-warning-700", "bg-paper-3 text-ink-800", "bg-info-50 text-ink-900"];
  let h = 0;
  for (const c of name) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return (
    <span
      className={cn("inline-flex shrink-0 items-center justify-center rounded-full font-semibold", hues[h % hues.length], className)}
      style={{ width: size, height: size, fontSize: size * 0.38 }}
      aria-hidden
    >
      {initials}
    </span>
  );
}

/** Link-based filter tabs (server-filtered lists). */
export function FilterTabs({ items }: { items: { href: string; label: string; count?: number; active: boolean }[] }) {
  return (
    <div className="flex gap-1 overflow-x-auto rounded-[var(--radius-md)] bg-paper-2 p-1 [scrollbar-width:none]">
      {items.map((t) => (
        <Link
          key={t.label}
          href={t.href}
          scroll={false}
          aria-current={t.active ? "page" : undefined}
          className={cn(
            "inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-[10px] px-3 py-1.5 text-sm font-medium transition",
            t.active ? "bg-white text-ink-950 shadow-sm ring-1 ring-line" : "text-ink-600 hover:text-ink-950",
          )}
        >
          {t.label}
          {t.count !== undefined ? (
            <span className={cn("rounded-full px-1.5 text-xs tabular", t.active ? "bg-mark-50 text-mark-600" : "bg-white/70 text-ink-500")}>{t.count.toLocaleString("en")}</span>
          ) : null}
        </Link>
      ))}
    </div>
  );
}

export function Pagination({ page, pages, href, total }: { page: number; pages: number; href: (p: number) => string; total?: number }) {
  if (pages <= 1) return total !== undefined ? <p className="px-5 py-3 text-xs text-ink-500">{total.toLocaleString("en")} total</p> : null;
  const btn = "inline-flex h-8 items-center gap-1 rounded-md px-2.5 text-sm font-medium ring-1 ring-inset ring-line transition hover:bg-paper-2";
  return (
    <div className="flex items-center justify-between gap-3 px-5 py-3 text-sm">
      <span className="text-ink-500">
        Page <b className="text-ink-900">{page}</b> of {pages}
        {total !== undefined ? ` · ${total.toLocaleString("en")} total` : ""}
      </span>
      <div className="flex gap-2">
        {page > 1 ? (
          <Link href={href(page - 1)} className={btn}>
            <Icon name="chevronLeft" size={14} /> Previous
          </Link>
        ) : null}
        {page < pages ? (
          <Link href={href(page + 1)} className={btn}>
            Next <Icon name="chevronRight" size={14} />
          </Link>
        ) : null}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Skeletons (loading.tsx)                                             */
/* ------------------------------------------------------------------ */

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-md bg-paper-3/80", className)} />;
}

export function PageSkeleton({ stats = 4, rows = 8, side = false, tabs = false }: { stats?: number; rows?: number; side?: boolean; tabs?: boolean }) {
  return (
    <div role="status" aria-label="Loading" aria-busy>
      <span className="sr-only">Loading…</span>
      <Skeleton className="h-8 w-56" />
      <Skeleton className="mt-3 h-4 w-80 max-w-full" />
      {stats ? (
        <div className={cn("mt-7 grid gap-3", stats >= 4 ? "grid-cols-2 lg:grid-cols-4" : "grid-cols-2 sm:grid-cols-3")}>
          {Array.from({ length: stats }, (_, i) => (
            <div key={i} className="rounded-[var(--radius-lg)] bg-white p-4 ring-1 ring-line">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="mt-3 h-7 w-16" />
              <Skeleton className="mt-2 h-3 w-28" />
            </div>
          ))}
        </div>
      ) : null}
      {tabs ? <Skeleton className="mt-6 h-10 w-full max-w-xl" /> : null}
      <div className={cn("mt-6 grid gap-6", side && "xl:grid-cols-[1fr_360px]")}>
        <TableSkeleton rows={rows} />
        {side ? (
          <div className="space-y-6">
            <CardSkeleton />
            <CardSkeleton />
          </div>
        ) : null}
      </div>
    </div>
  );
}

export function TableSkeleton({ rows = 8 }: { rows?: number }) {
  return (
    <div className="overflow-hidden rounded-[var(--radius-lg)] bg-white ring-1 ring-line">
      <div className="border-b border-line px-5 py-3.5">
        <Skeleton className="h-4 w-40" />
      </div>
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex items-center gap-4 border-b border-line px-5 py-3.5 last:border-0">
          <Skeleton className="h-8 w-8 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-3.5 w-1/3" />
            <Skeleton className="h-3 w-1/2" />
          </div>
          <Skeleton className="hidden h-6 w-20 rounded-full sm:block" />
          <Skeleton className="hidden h-4 w-16 md:block" />
        </div>
      ))}
    </div>
  );
}

export function CardSkeleton() {
  return (
    <div className="rounded-[var(--radius-lg)] bg-white p-5 ring-1 ring-line">
      <Skeleton className="h-4 w-32" />
      <Skeleton className="mt-4 h-3 w-full" />
      <Skeleton className="mt-2 h-3 w-5/6" />
      <Skeleton className="mt-2 h-3 w-2/3" />
      <Skeleton className="mt-5 h-9 w-36" />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Formatting                                                          */
/* ------------------------------------------------------------------ */

export const adminDate = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Africa/Cairo",
});
export const adminDay = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "Africa/Cairo" });

export function money(cents: number, currency: string) {
  return new Intl.NumberFormat("en-EG", { style: "currency", currency, maximumFractionDigits: 2 }).format(cents / 100);
}

/** "3 days ago", "in 5 days", "just now". */
export function relative(iso: string | null | undefined, now: number) {
  if (!iso) return "—";
  const diff = Date.parse(iso) - now;
  const abs = Math.abs(diff);
  const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
  if (abs < 60_000) return "just now";
  if (abs < 3_600_000) return rtf.format(Math.round(diff / 60_000), "minute");
  if (abs < 86_400_000) return rtf.format(Math.round(diff / 3_600_000), "hour");
  if (abs < 30 * 86_400_000) return rtf.format(Math.round(diff / 86_400_000), "day");
  if (abs < 365 * 86_400_000) return rtf.format(Math.round(diff / (30 * 86_400_000)), "month");
  return rtf.format(Math.round(diff / (365 * 86_400_000)), "year");
}

export function one<T>(v: T | T[] | null | undefined): T | undefined {
  return Array.isArray(v) ? v[0] : (v ?? undefined);
}

export function providerName(p: string) {
  return ({ instapay: "InstaPay", vodafone_cash: "Vodafone Cash", paymob: "Card (Paymob)", fawry: "Fawry", manual: "Manual" } as Record<string, string>)[p] ?? p;
}

export function ScorePill({ percent }: { percent: number }) {
  const p = Math.round(percent);
  return (
    <span
      className={cn(
        "inline-flex min-w-12 justify-center rounded-full px-2 py-0.5 text-xs font-bold tabular",
        p >= 75 ? "bg-success-50 text-success-700" : p >= 50 ? "bg-warning-50 text-warning-700" : "bg-danger-50 text-danger-600",
      )}
    >
      {p}%
    </span>
  );
}
