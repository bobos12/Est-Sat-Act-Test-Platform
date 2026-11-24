import type { ReactNode } from "react";

/** Plain reading layout for the privacy policy and terms. */
export function LegalPage({ title, updated, children }: { title: string; updated: string; children: ReactNode }) {
  return (
    <article className="mx-auto max-w-3xl px-5 pb-24 pt-12 sm:px-6 sm:pt-16">
      <h1 className="font-display text-4xl font-medium text-ink-950 sm:text-5xl">{title}</h1>
      <p className="mt-3 text-sm text-ink-500">Last updated {updated}</p>
      <div className="mt-10 space-y-8 text-[0.9375rem] leading-relaxed text-ink-700 [&_a]:font-medium [&_a]:text-mark-600 [&_a:hover]:underline [&_h2]:mb-3 [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:text-ink-950 [&_li]:pl-1 [&_p+p]:mt-3 [&_ul]:mt-3 [&_ul]:list-disc [&_ul]:space-y-1.5 [&_ul]:pl-5">
        {children}
      </div>
    </article>
  );
}
