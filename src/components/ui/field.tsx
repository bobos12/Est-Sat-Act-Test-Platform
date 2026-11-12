import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/utils";

export function Input({ className, ...props }: ComponentProps<"input">) {
  return (
    <input
      className={cn(
        "h-11 w-full rounded-[var(--radius-md)] bg-white px-3.5 text-[0.9375rem] text-ink-950 ring-1 ring-inset ring-line-strong placeholder:text-ink-400",
        "focus:outline-none focus:ring-2 focus:ring-ink-950 aria-[invalid=true]:ring-danger-600",
        className,
      )}
      {...props}
    />
  );
}

export function Field({
  label,
  htmlFor,
  hint,
  error,
  children,
}: {
  label: string;
  htmlFor: string;
  hint?: ReactNode;
  error?: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={htmlFor} className="block text-sm font-medium text-ink-800">
        {label}
      </label>
      {children}
      {error ? (
        <p className="text-sm text-danger-600" role="alert">
          {error}
        </p>
      ) : hint ? (
        <p className="text-sm text-ink-500">{hint}</p>
      ) : null}
    </div>
  );
}

export function FormMessage({ tone = "error", children }: { tone?: "error" | "success"; children: ReactNode }) {
  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      className={cn(
        "rounded-[var(--radius-md)] px-3.5 py-2.5 text-sm",
        tone === "error" ? "bg-danger-50 text-danger-600" : "bg-success-50 text-success-700",
      )}
    >
      {children}
    </div>
  );
}
