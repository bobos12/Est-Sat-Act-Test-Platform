import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/utils";

export function PageHeader({ title, description, actions }: { title: string; description?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="font-display text-3xl font-medium text-ink-950">{title}</h1>
        {description ? <p className="mt-1.5 max-w-2xl text-ink-600">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
    </div>
  );
}

export function Panel({ title, actions, children, className }: { title?: string; actions?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={cn("rounded-[var(--radius-lg)] bg-white ring-1 ring-line", className)}>
      {title ? (
        <div className="flex items-center justify-between gap-4 border-b border-line px-5 py-3.5">
          <h2 className="text-sm font-semibold text-ink-950">{title}</h2>
          {actions}
        </div>
      ) : null}
      {children}
    </section>
  );
}

export function DataTable({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn("overflow-x-auto", className)}>
      <table className="w-full text-left text-sm">{children}</table>
    </div>
  );
}
export function Th({ children, className }: { children?: ReactNode; className?: string }) {
  return <th className={cn("border-b border-line px-5 py-2.5 text-xs font-semibold uppercase tracking-[0.08em] text-ink-500", className)}>{children}</th>;
}
export function Td({ children, className, ...rest }: ComponentProps<"td">) {
  return (
    <td className={cn("border-b border-line px-5 py-3 align-middle text-ink-800", className)} {...rest}>
      {children}
    </td>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="px-5 py-10 text-center text-sm text-ink-500">{children}</p>;
}

export function Select({ className, ...props }: ComponentProps<"select">) {
  return (
    <select
      className={cn(
        "h-10 w-full rounded-[var(--radius-md)] bg-white px-3 text-sm text-ink-950 ring-1 ring-inset ring-line-strong focus:outline-none focus:ring-2 focus:ring-ink-950",
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
        "w-full rounded-[var(--radius-md)] bg-white px-3.5 py-2.5 font-mono text-[0.8125rem] leading-relaxed text-ink-950 ring-1 ring-inset ring-line-strong focus:outline-none focus:ring-2 focus:ring-ink-950",
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
  in_progress: "bg-warning-50 text-warning-700",
};

export function StatusBadge({ status }: { status: string }) {
  return (
    <span className={cn("inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium capitalize", statusTone[status] ?? "bg-paper-2 text-ink-700")}>
      {status.replace("_", " ")}
    </span>
  );
}

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
