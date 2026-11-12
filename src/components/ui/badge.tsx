import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type Tone = "neutral" | "free" | "premium" | "success" | "warning";
const tones: Record<Tone, string> = {
  neutral: "bg-paper-2 text-ink-700",
  free: "bg-success-50 text-success-700",
  premium: "bg-ink-950 text-paper",
  success: "bg-success-50 text-success-700",
  warning: "bg-warning-50 text-warning-700",
};

export function Badge({ tone = "neutral", children, className }: { tone?: Tone; children: ReactNode; className?: string }) {
  return (
    <span className={cn("inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium", tones[tone], className)}>
      {children}
    </span>
  );
}
