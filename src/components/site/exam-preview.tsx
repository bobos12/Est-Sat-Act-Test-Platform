import { InlineText } from "@/components/exam/rich-content";
import { cn } from "@/lib/utils";

/**
 * Static illustration of the exam screen for marketing pages.
 * The question is an original example, not taken from an official paper.
 */
export function ExamPreview({ className }: { className?: string }) {
  const options = ["$1$", "$9$", "$17$", "$21$"];
  const selected = 2;
  return (
    <div
      aria-hidden="true"
      className={cn("overflow-hidden rounded-[var(--radius-lg)] bg-white shadow-[var(--shadow-pop)] ring-1 ring-line", className)}
    >
      <div className="flex items-center justify-between border-b border-line px-5 py-3 text-sm">
        <span className="font-medium text-ink-800">EST I Math · Practice</span>
        <span className="tabular rounded-[var(--radius-sm)] bg-paper-2 px-2.5 py-1 font-medium text-ink-950">38:42</span>
      </div>
      <div className="px-5 py-6 sm:px-7">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium text-ink-500">Question 12 of 50</p>
          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-warning-700">
            <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="currentColor">
              <path d="M3 1.5a.75.75 0 0 1 .75.75V3h8.69a.5.5 0 0 1 .4.8L11 6.25l1.84 2.45a.5.5 0 0 1-.4.8H3.75v5.25a.75.75 0 0 1-1.5 0V2.25A.75.75 0 0 1 3 1.5Z" />
            </svg>
            Flagged
          </span>
        </div>
        <p className="mt-3 font-reading text-lg leading-relaxed text-ink-950">
          <InlineText text="If $3(x - 4) = 2x + 5$, what is the value of $x$?" />
        </p>
        <div className="mt-5 grid gap-2">
          {options.map((o, i) => (
            <div
              key={o}
              className={cn(
                "flex items-center gap-3.5 rounded-[var(--radius-md)] px-3.5 py-2.5 ring-1 ring-inset",
                i === selected ? "bg-ink-950 text-paper ring-ink-950" : "ring-line-strong",
              )}
            >
              <span
                className={cn(
                  "flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold",
                  i === selected ? "bg-paper text-ink-950" : "bg-paper-2 text-ink-700",
                )}
              >
                {"ABCD"[i]}
              </span>
              <span className="font-reading text-base">
                <InlineText text={o} />
              </span>
            </div>
          ))}
        </div>
      </div>
      <div className="flex items-center gap-1 overflow-hidden border-t border-line bg-paper px-5 py-3">
        {Array.from({ length: 16 }, (_, i) => (
          <span
            key={i}
            className={cn(
              "flex h-6 w-6 shrink-0 items-center justify-center rounded-[5px] text-[0.65rem] font-medium tabular",
              i === 11
                ? "bg-ink-950 text-paper"
                : i < 11 && i !== 6
                  ? "bg-ink-700/10 text-ink-800"
                  : i === 6
                    ? "bg-warning-50 text-warning-700 ring-1 ring-inset ring-warning-500"
                    : "text-ink-400 ring-1 ring-inset ring-line",
            )}
          >
            {i + 1}
          </span>
        ))}
      </div>
    </div>
  );
}
