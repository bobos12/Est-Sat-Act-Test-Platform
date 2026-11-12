import "server-only";
import { z } from "zod";
import { callTool, pool } from "./client";
import { FORMAT_GUIDE, LABELS, aiQuestion, aiStimulus, questionSchemaJson, stimulusSchemaJson, type AiQuestion, type AiStimulus } from "./schemas";

export type Difficulty = "easy" | "medium" | "hard";

export type GenerationSpec = {
  subjectCode: string;
  subjectName: string;
  topics: string[]; // official topic names to cover (Math) — may be empty for Literacy
  topicWeights?: Record<string, number>; // relative share per topic (defaults to equal)
  skills: string[]; // official skill names (Literacy)
  domains: string[]; // official passage domains (Literacy)
  questionCount: number;
  difficultyMix: Record<Difficulty, number>; // percentages
  references: string[]; // sample source questions (style reference only)
  blueprint: string;
};

export type GeneratedBatch = { stimuli: AiStimulus[]; questions: (AiQuestion & { review_note?: string })[] };

/** Split `total` across keys in proportion to `weights` (largest remainder). */
export function apportion<K extends string>(total: number, weights: Record<K, number>): Record<K, number> {
  const keys = Object.keys(weights) as K[];
  const sum = keys.reduce((s, k) => s + Math.max(0, weights[k]), 0) || 1;
  const raw = keys.map((k) => ({ k, v: (total * Math.max(0, weights[k])) / sum }));
  const out = Object.fromEntries(raw.map(({ k, v }) => [k, Math.floor(v)])) as Record<K, number>;
  let left = total - keys.reduce((s, k) => s + out[k], 0);
  for (const { k } of raw.sort((a, b) => (b.v % 1) - (a.v % 1))) {
    if (left-- <= 0) break;
    out[k] += 1;
  }
  return out;
}

const SYSTEM = `You are a senior assessment writer for the EST (Egyptian Scholastic Test) used by American Diploma students.
You write ORIGINAL exam-quality multiple-choice questions that match the official EST I blueprint in topic, style, length and difficulty.
Rules:
- Never copy or lightly paraphrase the reference questions; they show style and level only.
- Exactly four options A–D, exactly one correct. Distractors must reflect real student mistakes.
- Every explanation shows the full working or reasoning a student needs, concisely.
- Check every calculation twice. If a question could have two defensible answers, rewrite it.
- Use international, culturally neutral contexts appropriate for Egyptian high-school students.
- Any passage you write is your own original text; attribute it as "Original passage".`;

function chunks(total: number, size: number) {
  const out: number[] = [];
  for (let left = total; left > 0; left -= size) out.push(Math.min(size, left));
  return out;
}

async function generateChunk(spec: GenerationSpec, plan: string, schemaTopics: string[], withPassage: boolean): Promise<GeneratedBatch> {
  const references = spec.references.length
    ? `\n\nStyle references from past official papers (DO NOT reuse their content, numbers or contexts):\n${spec.references.map((r, i) => `--- Reference ${i + 1} ---\n${r}`).join("\n")}`
    : "";

  const result = await callTool<{ stimuli?: unknown[]; questions?: unknown[] }>({
    system: SYSTEM,
    maxTokens: 24000,
    content: [
      {
        type: "text",
        text: `Subject: ${spec.subjectName}\n\nOfficial blueprint:\n${spec.blueprint}\n\nWrite this set:\n${plan}\n\n${FORMAT_GUIDE}${references}`,
      },
    ],
    tool: {
      name: "save_questions",
      description: "Save the newly written questions and any shared stimuli.",
      input_schema: {
        type: "object",
        properties: {
          stimuli: { type: "array", items: stimulusSchemaJson(withPassage ? spec.domains : []) },
          questions: {
            type: "array",
            items: questionSchemaJson({ topics: schemaTopics, skills: spec.skills, requireKey: true, requireExplanation: true }),
          },
        },
        required: ["stimuli", "questions"],
      },
    },
  });

  const stimuli = z.array(aiStimulus).catch([]).parse(result.stimuli ?? []);
  const questions = (result.questions ?? [])
    .map((q) => aiQuestion.safeParse(q))
    .filter((r) => r.success)
    .map((r) => r.data)
    .filter((q) => q.correct && LABELS.every((l) => q.options[l]?.trim()) && new Set(LABELS.map((l) => q.options[l].trim())).size === 4);
  return { stimuli, questions };
}

/** Independent second pass: solve without the key; disagreements are flagged for the reviewer. */
async function verify(batch: GeneratedBatch): Promise<GeneratedBatch> {
  if (!batch.questions.length) return batch;
  const stimText = batch.stimuli.map((s) => `[${s.ref}]\n${s.content}`).join("\n\n");
  const qText = batch.questions
    .map((q, i) => `Q${i + 1}${q.stimulus_ref ? ` (uses ${q.stimulus_ref})` : ""}: ${q.stem}\n${LABELS.map((l) => `${l}. ${q.options[l]}`).join("\n")}`)
    .join("\n\n");
  try {
    const res = await callTool<{ answers?: { index: number; answer: string; confident: boolean }[] }>({
      system: "You are a meticulous exam checker. Solve each question yourself, step by step internally, and report only your final choice.",
      maxTokens: 4000,
      content: [{ type: "text", text: `${stimText ? `Shared material:\n${stimText}\n\n` : ""}${qText}` }],
      tool: {
        name: "report_answers",
        description: "Report your answer for each question.",
        input_schema: {
          type: "object",
          properties: {
            answers: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  index: { type: "integer", description: "1-based question number" },
                  answer: { type: "string", enum: ["A", "B", "C", "D", "AMBIGUOUS"] },
                  confident: { type: "boolean" },
                },
                required: ["index", "answer", "confident"],
              },
            },
          },
          required: ["answers"],
        },
      },
    });
    const byIndex = new Map((res.answers ?? []).map((a) => [a.index, a]));
    return {
      ...batch,
      questions: batch.questions.map((q, i) => {
        const a = byIndex.get(i + 1);
        if (!a) return { ...q, review_note: "Independent check did not return an answer — verify the key." };
        if (a.answer === "AMBIGUOUS") return { ...q, review_note: "Independent check found this question ambiguous." };
        if (a.answer !== q.correct) return { ...q, review_note: `Independent check chose ${a.answer}, but the key says ${q.correct}. Verify before approving.` };
        if (!a.confident) return { ...q, review_note: "Independent check agreed with the key but was not confident." };
        return q;
      }),
    };
  } catch {
    return { ...batch, questions: batch.questions.map((q) => ({ ...q, review_note: "Independent check failed to run — verify the key." })) };
  }
}

function difficultyLine(n: number, mix: Record<Difficulty, number>) {
  const d = apportion(n, mix);
  return `Difficulty: ${d.easy} easy, ${d.medium} medium, ${d.hard} hard.`;
}

/** Generates one exam's worth of questions as reviewable batches. */
export async function generateExamContent(spec: GenerationSpec): Promise<GeneratedBatch> {
  const isLiteracy = spec.subjectCode.includes("literacy");
  let jobs: { plan: string; topics: string[]; passage: boolean }[];

  if (isLiteracy) {
    // One passage per job, 6–11 questions each, rotating official domains.
    const sizes = chunks(spec.questionCount, 10);
    const domains = spec.domains.length ? spec.domains : ["Analysis in Literature"];
    jobs = sizes.map((n, i) => ({
      passage: true,
      topics: [],
      plan: `One ORIGINAL reading passage of 350–500 words (domain: ${domains[i % domains.length]}), with exactly ${n} questions about it.
Mix question types like the official Literacy test: editing questions tied to passage markers [[n|…]] (grammar — Standard English Conventions; clarity, transitions, concision — Expression of Ideas; vocabulary — Words in Context, with "NO CHANGE" as option A where appropriate) and comprehension questions about the whole passage.
Number markers 1..${n} in passage order; set each question's marker accordingly (comprehension questions may omit it). Tag each question's skill when it is one of: ${spec.skills.join(", ")}.
${difficultyLine(n, spec.difficultyMix)}`,
    }));
  } else {
    const topics = spec.topics.length ? spec.topics : ["Foundational Algebra"];
    const perTopic = apportion(spec.questionCount, Object.fromEntries(topics.map((t) => [t, spec.topicWeights?.[t] ?? 1])));
    // Batches of ≤10 questions, keeping each topic's questions together.
    const queue = topics.flatMap((t) => Array.from({ length: perTopic[t] }, () => t));
    jobs = [];
    for (let i = 0; i < queue.length; i += 10) {
      const slice = queue.slice(i, i + 10);
      const counts = apportion(slice.length, Object.fromEntries([...new Set(slice)].map((t) => [t, slice.filter((x) => x === t).length])));
      jobs.push({
        passage: false,
        topics: Object.keys(counts),
        plan: `Exactly ${slice.length} questions: ${Object.entries(counts)
          .map(([t, n]) => `${n} on "${t}"`)
          .join(", ")}.
Use realistic contexts, and where natural include ONE shared data table or scenario used by 2–3 consecutive questions (put it in stimuli and reference it).
Avoid questions that need a drawn graph or diagram unless it can be given as a table. Calculators are allowed.
${difficultyLine(slice.length, spec.difficultyMix)}`,
      });
    }
  }

  const batches = await pool(jobs, 3, async (job, i) => {
    const raw = await generateChunk(spec, job.plan, isLiteracy ? [] : job.topics, job.passage);
    // Namespace stimulus refs per batch so they never collide across batches.
    const prefix = `B${i + 1}-`;
    const batch: GeneratedBatch = {
      stimuli: raw.stimuli.map((s) => ({ ...s, ref: prefix + s.ref })),
      questions: raw.questions.map((q) => ({ ...q, stimulus_ref: q.stimulus_ref ? prefix + q.stimulus_ref : null })),
    };
    return verify(batch);
  });

  return {
    stimuli: batches.flatMap((b) => b.stimuli),
    questions: batches.flatMap((b) => b.questions),
  };
}
