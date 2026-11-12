import "server-only";
import { z } from "zod";
import { aiConcurrency, callTool, pool } from "./client";
import { FORMAT_GUIDE, aiQuestion, aiStimulus, questionSchemaJson, stimulusSchemaJson } from "./schemas";

/**
 * Reads an official EST paper (and its answer key, when available) and returns
 * structured questions for the knowledge base. Output is reference material only.
 */
export async function extractPaper(input: {
  subjectName: string;
  paper: Buffer;
  answerKey?: Buffer;
  topics: string[];
  skills: string[];
  domains: string[];
  /** Question ranges to extract in parallel, e.g. "Module 2 (questions 1-25)". One chunk = one model call. */
  chunks?: string[];
}) {
  const chunks = input.chunks?.length ? input.chunks : ["the whole paper"];
  const parts = await pool(chunks, aiConcurrency(3), (scope, idx) => extractChunk(input, scope, `c${idx}-`));
  const stimuli = parts.flatMap((p) => p.stimuli);
  const questions = parts.flatMap((p) => p.questions);
  if (!questions.length) throw new Error("No questions could be extracted from this document.");
  return { stimuli, questions };
}

/** Splits a paper into ranges small enough to extract quickly and never hit the output limit. */
export function planChunks(sections: number, questionCount: number): string[] {
  if (sections === 3) return ["Module 1 (questions 1-35)", "Module 2 (questions 1-25)", "Module 3 (questions 1-25)"];
  const n = Math.max(1, Math.ceil(questionCount / 25));
  const size = Math.ceil(questionCount / n);
  return Array.from({ length: n }, (_, i) => `questions ${i * size + 1}-${Math.min(questionCount, (i + 1) * size)}`);
}

/** Page-range chunks for any PDF, whatever its length or subject (a question belongs to the chunk where it starts). */
export function planPageChunks(numPages: number, pagesPerChunk = 6): string[] {
  const n = Math.max(1, Math.ceil(numPages / pagesPerChunk));
  const size = Math.ceil(numPages / n);
  return Array.from({ length: n }, (_, i) => `the questions that START on pages ${i * size + 1}-${Math.min(numPages, (i + 1) * size)} (PDF pages)`);
}

async function extractChunk(
  input: { subjectName: string; paper: Buffer; answerKey?: Buffer; topics: string[]; skills: string[]; domains: string[] },
  scope: string,
  refPrefix: string,
) {
  const content: Parameters<typeof callTool>[0]["content"] = [
    { type: "document", source: { type: "base64", media_type: "application/pdf", data: input.paper.toString("base64") }, title: "Question paper" },
  ];
  if (input.answerKey) {
    content.push({
      type: "document",
      source: { type: "base64", media_type: "application/pdf", data: input.answerKey.toString("base64") },
      title: "Answer key with topic distribution table",
    });
  }
  content.push({
    type: "text",
    text: `Extract every multiple-choice question in ${scope} of this ${input.subjectName} paper, in order. Ignore questions outside that scope.
- Copy question wording and answer choices faithfully (this is for internal analysis). Include every choice: if the paper prints a fifth choice E, put it in options.E.
- Shared passages, data tables and scenarios ("Questions 25–27 refer to…") go in "stimuli" once, referenced by each question's stimulus_ref.
- For Literacy passages, keep the numbered markers: "[3] compel and obliged" becomes [[3|compel and obliged]]; questions linked to a marker get marker=3.
- If a question depends on a graph, diagram or picture, describe it briefly in square brackets in the stem, set has_figure=true, and give page (1-based PDF page of the question paper) and figure_box ([left, top, right, bottom] as 0-1 fractions of the page, tight around the figure only, not the question text). A shared figure belongs in a stimulus of kind "figure" with the same page and figure_box.
${input.answerKey ? "- Take the correct answer and the topic/skill/cognitive level of each question from the answer key's tables." : "- No answer key was provided: leave correct empty unless you are certain."}
- Number questions as printed (per module for Literacy, restarting at 1).
${FORMAT_GUIDE}`,
  });

  const result = await callTool<{ stimuli?: unknown[]; questions?: unknown[] }>({
    system: "You digitise standardised-test papers accurately. You never invent questions that are not in the document.",
    content,
    maxTokens: 64000,
    tool: {
      name: "save_extraction",
      description: "Save the extracted questions and shared stimuli.",
      input_schema: {
        type: "object",
        properties: {
          stimuli: { type: "array", items: stimulusSchemaJson(input.domains) },
          questions: {
            type: "array",
            items: questionSchemaJson({ topics: input.topics, skills: input.skills, requireKey: false, requireExplanation: false }),
          },
        },
        required: ["stimuli", "questions"],
      },
    },
  });

  const stimuli = z
    .array(aiStimulus)
    .catch([])
    .parse(result.stimuli ?? [])
    .map((st) => ({ ...st, ref: refPrefix + st.ref }));
  const questions = (result.questions ?? [])
    .map((q) => aiQuestion.safeParse(q))
    .filter((r) => r.success)
    .map((r) => ({ ...r.data, stimulus_ref: r.data.stimulus_ref ? refPrefix + r.data.stimulus_ref : r.data.stimulus_ref }));
  return { stimuli, questions };
}
