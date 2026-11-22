import Link from "next/link";
import { cn } from "@/lib/utils";

/**
 * The TargetScore mark: a target ring and bullseye with a dart struck in the centre.
 * Ring and bullseye use --logo-accent (exam blue); the dart uses currentColor, so it reads on light and dark.
 */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={cn("mk", className)} aria-hidden="true" focusable="false">
      <circle cx="14" cy="18" r="11" fill="none" stroke="var(--logo-accent, #1559ED)" strokeWidth="3" />
      <circle cx="14" cy="18" r="4.25" fill="var(--logo-accent, #1559ED)" />
      <path d="M14 18 26.5 5.5" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" />
      <path d="M23.2 3.6v5.2h5.2" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** Mark + wordmark. Pass `href` to render it as a link; `tone="paper"` for dark backgrounds. */
export function Logo({ href, className, tone = "ink" }: { href?: string; className?: string; tone?: "ink" | "paper" }) {
  const classes = cn("logo", tone === "paper" && "logo-paper", className);
  const inner = (
    <>
      <LogoMark />
      <span>
        Target<b>Score</b>
      </span>
    </>
  );
  return href ? (
    <Link href={href} className={classes} aria-label="TargetScore home">
      {inner}
    </Link>
  ) : (
    <span className={classes}>{inner}</span>
  );
}
