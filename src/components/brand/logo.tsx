import Link from "next/link";
import { cn } from "@/lib/utils";

/** The 16hundred mark: a filled answer bubble holding "16". Read with the wordmark: "16 hundred". */
export function LogoMark({ className }: { className?: string }) {
  return (
    <span className={cn("mk", className)} aria-hidden="true">
      16
    </span>
  );
}

/** Bubble + wordmark. Pass `href` to render it as a link; `tone="paper"` for dark backgrounds. */
export function Logo({ href, className, tone = "ink" }: { href?: string; className?: string; tone?: "ink" | "paper" }) {
  const classes = cn("logo", tone === "paper" && "logo-paper", className);
  const inner = (
    <>
      <LogoMark />
      <span>hundred</span>
    </>
  );
  return href ? (
    <Link href={href} className={classes} aria-label="16hundred home">
      {inner}
    </Link>
  ) : (
    <span className={classes}>{inner}</span>
  );
}
