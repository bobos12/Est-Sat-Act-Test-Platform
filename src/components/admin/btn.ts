import { cn } from "@/lib/utils";

/** Button classes, usable from server and client components. */
export type BtnVariant = "primary" | "secondary" | "ghost" | "danger" | "danger-outline" | "success" | "dark";
export type BtnSize = "xs" | "sm" | "md";

const variantCls: Record<BtnVariant, string> = {
  primary: "bg-mark-500 text-white hover:bg-mark-600 shadow-sm",
  dark: "bg-ink-950 text-white hover:bg-ink-800 shadow-sm",
  secondary: "bg-white text-ink-900 ring-1 ring-inset ring-line-strong hover:bg-paper-2",
  ghost: "text-ink-600 hover:bg-paper-2 hover:text-ink-950",
  danger: "bg-danger-600 text-white hover:opacity-90 shadow-sm",
  "danger-outline": "bg-white text-danger-600 ring-1 ring-inset ring-danger-600/40 hover:bg-danger-50",
  success: "bg-success-600 text-white hover:bg-success-700 shadow-sm",
};
const sizeCls: Record<BtnSize, string> = {
  xs: "h-7 px-2.5 text-xs gap-1",
  sm: "h-8 px-3 text-[0.8125rem] gap-1.5",
  md: "h-10 px-4 text-sm gap-2",
};

export function btn(variant: BtnVariant = "secondary", size: BtnSize = "md", className?: string) {
  return cn(
    "relative inline-flex items-center justify-center whitespace-nowrap rounded-[var(--radius-md)] font-semibold transition disabled:cursor-not-allowed disabled:opacity-50",
    variantCls[variant],
    sizeCls[size],
    className,
  );
}
