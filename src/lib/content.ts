/**
 * Question content model. Stored as JSON in questions.stem / explanation,
 * question_options.content and stimuli.content:  { "blocks": Block[] }
 *
 * Inline text supports:
 *   $...$         inline LaTeX            ($$...$$ for display math inside text)
 *   **bold**      emphasis
 *   [[n|text]]    passage marker: underlined text linked to question n (Literacy)
 *   [[n]]         empty marker / blank linked to question n
 */
export type TextBlock = { type: "paragraph"; text: string };
export type HeadingBlock = { type: "heading"; text: string };
export type MathBlock = { type: "math"; latex: string };
export type ImageBlock = { type: "image"; src: string; alt: string; width?: number; caption?: string };
export type TableBlock = { type: "table"; header?: string[]; rows: string[][]; caption?: string };
export type ListBlock = { type: "list"; ordered?: boolean; items: string[] };

export type Block = TextBlock | HeadingBlock | MathBlock | ImageBlock | TableBlock | ListBlock;
export type RichContent = { blocks: Block[] };

export const emptyContent: RichContent = { blocks: [] };

export function plainText(content: RichContent | null | undefined, max = 160): string {
  if (!content?.blocks) return "";
  const text = content.blocks
    .map((b) => {
      switch (b.type) {
        case "paragraph":
        case "heading":
          return b.text;
        case "math":
          return b.latex;
        case "list":
          return b.items.join(" ");
        case "table":
          return b.caption ?? "[table]";
        case "image":
          return b.alt ? `[${b.alt}]` : "[image]";
      }
    })
    .join(" ")
    .replace(/\[\[(\d+)\|([^\]]*)\]\]/g, "$2")
    .replace(/\s+/g, " ")
    .trim();
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

/**
 * Plain-text authoring format used by the admin editors (round-trips with blocks):
 *   blank line            → new paragraph
 *   ## Heading            → heading
 *   $$ latex $$ (alone)   → display math
 *   ![alt](url)           → image
 *   | a | b |  (rows)     → table; a row of --- after the first row makes it a header
 *   - item / 1. item      → list
 */
export function textToContent(text: string): RichContent {
  const blocks: Block[] = [];
  const chunks = text.replace(/\r\n/g, "\n").split(/\n\s*\n/);
  for (const raw of chunks) {
    const chunk = raw.trim();
    if (!chunk) continue;
    const lines = chunk.split("\n").map((l) => l.trim());
    const img = /^!\[([^\]]*)\]\(([^)\s]+)\)$/.exec(chunk);
    if (img) {
      blocks.push({ type: "image", alt: img[1], src: img[2] });
    } else if (/^\$\$[\s\S]+\$\$$/.test(chunk) && !chunk.slice(2, -2).includes("$$")) {
      blocks.push({ type: "math", latex: chunk.slice(2, -2).trim() });
    } else if (chunk.startsWith("## ")) {
      blocks.push({ type: "heading", text: chunk.slice(3).trim() });
    } else if (lines.every((l) => l.startsWith("|"))) {
      const rows = lines
        .map((l) => l.replace(/^\|/, "").replace(/\|$/, "").split("|").map((c) => c.trim()));
      const sep = rows.length > 1 && rows[1].every((c) => /^:?-{3,}:?$/.test(c));
      blocks.push(sep ? { type: "table", header: rows[0], rows: rows.slice(2) } : { type: "table", rows });
    } else if (lines.every((l) => /^[-*] /.test(l))) {
      blocks.push({ type: "list", items: lines.map((l) => l.slice(2)) });
    } else if (lines.every((l) => /^\d+\. /.test(l))) {
      blocks.push({ type: "list", ordered: true, items: lines.map((l) => l.replace(/^\d+\. /, "")) });
    } else {
      blocks.push({ type: "paragraph", text: lines.join(" ") });
    }
  }
  return { blocks };
}

export function contentToText(content: RichContent | null | undefined): string {
  if (!content?.blocks) return "";
  return content.blocks
    .map((b) => {
      switch (b.type) {
        case "paragraph":
          return b.text;
        case "heading":
          return `## ${b.text}`;
        case "math":
          return `$$ ${b.latex} $$`;
        case "image":
          return `![${b.alt}](${b.src})`;
        case "list":
          return b.items.map((it, i) => (b.ordered ? `${i + 1}. ${it}` : `- ${it}`)).join("\n");
        case "table": {
          const row = (r: string[]) => `| ${r.join(" | ")} |`;
          const head = b.header ? [row(b.header), row(b.header.map(() => "---"))] : [];
          return [...head, ...b.rows.map(row)].join("\n");
        }
      }
    })
    .join("\n\n");
}
