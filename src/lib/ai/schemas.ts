/** Shared JSON shapes for model output (validated again with zod before saving). */
import { z } from "zod";

export const LABELS = ["A", "B", "C", "D"] as const;
/** Imported papers: EST I uses A–D, EST II adds E. */
export const PAPER_LABELS = ["A", "B", "C", "D", "E"] as const;
export const optionLabels = (q: { options: { E?: string | null } }) => (q.options.E?.trim() ? PAPER_LABELS : LABELS);

export const aiStimulus = z.object({
  ref: z.string().min(1),
  kind: z.enum(["passage", "figure", "table", "data_set", "text"]),
  title: z.string().nullish(),
  attribution: z.string().nullish(),
  domain: z.string().nullish(),
  content: z.string().min(1),
  page: z.number().int().nullish(),
  figure_box: z.array(z.number()).length(4).nullish(),
});

export const aiQuestion = z.object({
  number: z.number().int().nullish(),
  stimulus_ref: z.string().nullish(),
  marker: z.number().int().nullish(),
  stem: z.string().min(1),
  options: z.object({ A: z.string(), B: z.string(), C: z.string(), D: z.string(), E: z.string().nullish() }),
  correct: z.enum(PAPER_LABELS).nullish(),
  explanation: z.string().nullish(),
  topic: z.string().nullish(),
  skill: z.string().nullish(),
  cognitive_level: z.enum(["knowledge", "application", "reasoning", "synthesis"]).nullish(),
  difficulty: z.enum(["easy", "medium", "hard"]).nullish(),
  has_figure: z.boolean().nullish(),
  page: z.number().int().nullish(),
  figure_box: z.array(z.number()).length(4).nullish(),
});

export type AiStimulus = z.infer<typeof aiStimulus>;
export type AiQuestion = z.infer<typeof aiQuestion>;

export const FORMAT_GUIDE = `Write all text in this plain-text format:
- Inline math in single dollar signs: $3x^2 - 5$. Display math alone on a line: $$ \\frac{a}{b} $$. Use LaTeX inside math.
- A literal dollar sign inside math is \\$ (e.g. $\\$25$). Never use a bare $ for money outside math.
- Bold: **text**. Paragraphs separated by a blank line.
- Tables as pipe rows, with a header separator row: | x | y |\\n| --- | --- |\\n| 1 | 2 |
- In reading passages, mark the text a question refers to as [[n|exact words]] where n is that question's marker number; use [[n]] for an inserted blank.`;

export function stimulusSchemaJson(domains: string[]) {
  return {
    type: "object",
    properties: {
      ref: { type: "string", description: "Short id such as S1, referenced by questions" },
      kind: { type: "string", enum: ["passage", "figure", "table", "data_set", "text"] },
      title: { type: "string" },
      attribution: { type: "string" },
      ...(domains.length ? { domain: { type: "string", enum: domains } } : {}),
      content: { type: "string" },
      page: { type: "integer", description: "1-based page of the question paper PDF where the figure appears" },
      figure_box: { type: "array", items: { type: "number" }, minItems: 4, maxItems: 4, description: "Tight box around the figure on that page as fractions 0-1: [left, top, right, bottom]" },
    },
    required: ["ref", "kind", "content"],
  } as const;
}

export function questionSchemaJson(opts: { topics: string[]; skills: string[]; requireKey: boolean; requireExplanation: boolean }) {
  const option = { type: "string" };
  return {
    type: "object",
    properties: {
      number: { type: "integer" },
      stimulus_ref: { type: "string", description: "ref of the shared stimulus this question uses, if any" },
      marker: { type: "integer", description: "passage marker number, for passage-linked questions" },
      stem: { type: "string" },
      options: {
        type: "object",
        properties: { A: option, B: option, C: option, D: option, E: { type: "string", description: "Fifth option, only when the paper prints an E choice" } },
        required: ["A", "B", "C", "D"],
      },
      correct: { type: "string", enum: ["A", "B", "C", "D", "E"] },
      explanation: { type: "string" },
      ...(opts.topics.length ? { topic: { type: "string", enum: opts.topics } } : {}),
      ...(opts.skills.length ? { skill: { type: "string", enum: opts.skills } } : {}),
      cognitive_level: { type: "string", enum: ["knowledge", "application", "reasoning", "synthesis"] },
      difficulty: { type: "string", enum: ["easy", "medium", "hard"] },
      has_figure: { type: "boolean", description: "true if the question depends on a graph, diagram or image not representable as text/table" },
      page: { type: "integer", description: "1-based page of the question paper PDF where the figure appears" },
      figure_box: { type: "array", items: { type: "number" }, minItems: 4, maxItems: 4, description: "Tight box around the figure on that page as fractions 0-1: [left, top, right, bottom]" },
    },
    required: [
      "stem",
      "options",
      ...(opts.requireKey ? ["correct"] : []),
      ...(opts.requireExplanation ? ["explanation", "difficulty", "cognitive_level"] : []),
    ],
  } as const;
}
