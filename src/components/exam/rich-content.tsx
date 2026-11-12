import katex from "katex";
import { Fragment, type ReactNode } from "react";
import type { Block, RichContent } from "@/lib/content";
import { cn } from "@/lib/utils";

/**
 * Renders question/passage content. Pure (no hooks), so it works in both
 * server and client components. Math is rendered to static HTML by KaTeX.
 */

function renderMath(latex: string, displayMode: boolean) {
  return katex.renderToString(latex, { throwOnError: false, displayMode, output: "html", strict: "ignore" });
}

type InlineOptions = { activeMarker?: number | null; onMarker?: (n: number) => void };

// Tokens: $$display$$, $inline$ (\$ is a literal dollar inside math), **bold**, [[n|text]] / [[n]]
const TOKEN = /(\$\$(?:\\\$|[^$])+\$\$|\$(?:\\\$|[^$\n])+\$|\*\*[^*]+\*\*|\[\[\d+(?:\|[^\]]*)?\]\])/g;

export function InlineText({ text, options }: { text: string; options?: InlineOptions }) {
  const parts = text.split(TOKEN).filter((p) => p !== "");
  return (
    <>
      {parts.map((part, i) => {
        if (part.startsWith("$$") && part.endsWith("$$")) {
          return <span key={i} className="block overflow-x-auto py-1" dangerouslySetInnerHTML={{ __html: renderMath(part.slice(2, -2), true) }} />;
        }
        if (part.startsWith("$") && part.endsWith("$") && part.length > 2) {
          return <span key={i} dangerouslySetInnerHTML={{ __html: renderMath(part.slice(1, -1), false) }} />;
        }
        if (part.startsWith("**") && part.endsWith("**")) {
          return <strong key={i}>{part.slice(2, -2)}</strong>;
        }
        const marker = /^\[\[(\d+)(?:\|([^\]]*))?\]\]$/.exec(part);
        if (marker) {
          const n = Number(marker[1]);
          const label = marker[2] ?? "";
          const active = options?.activeMarker === n;
          return (
            <span
              key={i}
              id={`marker-${n}`}
              data-marker={n}
              className={cn(
                "rounded-[3px] px-0.5 transition-colors",
                active ? "bg-mark-100 ring-1 ring-mark-500" : "bg-transparent",
              )}
            >
              <span className="mr-0.5 align-super text-[0.65em] font-semibold text-ink-500 not-italic">[{n}]</span>
              {label ? <span className="underline decoration-ink-700 decoration-1 underline-offset-[3px]">{label}</span> : <span className="inline-block w-10 border-b border-ink-700" />}
            </span>
          );
        }
        return <Fragment key={i}>{part}</Fragment>;
      })}
    </>
  );
}

function BlockView({ block, options }: { block: Block; options?: InlineOptions }): ReactNode {
  switch (block.type) {
    case "paragraph":
      return (
        <p>
          <InlineText text={block.text} options={options} />
        </p>
      );
    case "heading":
      return (
        <h3 className="font-sans text-base font-semibold text-ink-950">
          <InlineText text={block.text} options={options} />
        </h3>
      );
    case "math":
      return <div className="overflow-x-auto py-1" dangerouslySetInnerHTML={{ __html: renderMath(block.latex, true) }} />;
    case "image":
      return (
        <figure>
          {/* eslint-disable-next-line @next/next/no-img-element -- question media come from Supabase Storage with arbitrary sizes */}
          <img src={block.src} alt={block.alt} width={block.width} className="h-auto max-w-full rounded-[var(--radius-sm)]" loading="lazy" />
          {block.caption ? <figcaption className="mt-2 text-sm text-ink-500">{block.caption}</figcaption> : null}
        </figure>
      );
    case "table":
      return (
        <div className="overflow-x-auto">
          <table className="min-w-[240px] border-collapse font-sans text-[0.9375rem]">
            {block.caption ? <caption className="mb-2 text-left text-sm text-ink-500">{block.caption}</caption> : null}
            {block.header ? (
              <thead>
                <tr>
                  {block.header.map((h, i) => (
                    <th key={i} className="border border-line-strong bg-paper-2 px-3 py-2 text-left font-semibold">
                      <InlineText text={h} />
                    </th>
                  ))}
                </tr>
              </thead>
            ) : null}
            <tbody>
              {block.rows.map((row, r) => (
                <tr key={r}>
                  {row.map((cell, c) => (
                    <td key={c} className="tabular border border-line-strong px-3 py-2">
                      <InlineText text={cell} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    case "list": {
      const Tag = block.ordered ? "ol" : "ul";
      return (
        <Tag className={cn("space-y-1 pl-6", block.ordered ? "list-decimal" : "list-disc")}>
          {block.items.map((item, i) => (
            <li key={i}>
              <InlineText text={item} options={options} />
            </li>
          ))}
        </Tag>
      );
    }
  }
}

export function RichContentView({
  content,
  className,
  activeMarker,
}: {
  content: RichContent | null | undefined;
  className?: string;
  activeMarker?: number | null;
}) {
  if (!content?.blocks?.length) return null;
  return (
    <div className={cn("space-y-4", className)}>
      {content.blocks.map((block, i) => (
        <BlockView key={i} block={block} options={{ activeMarker }} />
      ))}
    </div>
  );
}
