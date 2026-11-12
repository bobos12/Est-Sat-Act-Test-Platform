import Link from "next/link";
import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

type Variant = "primary" | "secondary" | "ghost" | "accent";
type Size = "sm" | "md" | "lg";

const base =
  "inline-flex items-center justify-center gap-2 rounded-[var(--radius-md)] font-medium transition-colors disabled:pointer-events-none disabled:opacity-50 whitespace-nowrap";
const variants: Record<Variant, string> = {
  primary: "bg-mark-500 text-white hover:bg-mark-600",
  secondary: "bg-white text-ink-950 ring-1 ring-inset ring-line-strong hover:bg-paper-2",
  ghost: "text-ink-700 hover:bg-paper-2 hover:text-ink-950",
  accent: "bg-ink-950 text-white hover:bg-ink-900",
};
const sizes: Record<Size, string> = {
  sm: "h-8 px-3 text-sm",
  md: "h-10 px-4 text-[0.9375rem]",
  lg: "h-12 px-6 text-base",
};

export function buttonClasses(variant: Variant = "primary", size: Size = "md", className?: string) {
  return cn(base, variants[variant], sizes[size], className);
}

export function Button({
  variant,
  size,
  className,
  ...props
}: ComponentProps<"button"> & { variant?: Variant; size?: Size }) {
  return <button className={buttonClasses(variant, size, className)} {...props} />;
}

export function ButtonLink({
  variant,
  size,
  className,
  ...props
}: ComponentProps<typeof Link> & { variant?: Variant; size?: Size }) {
  return <Link className={buttonClasses(variant, size, className)} {...props} />;
}
