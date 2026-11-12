import "server-only";
import { aiConcurrency, callTool, pool } from "./client";
import { optionLabels, type PAPER_LABELS, type AiQuestion, type AiStimulus } from "./schemas";

/**
 * For papers uploaded without an answer key: the model solves each question without a key.
 * Only confident answers are filled in and they are flagged for review; the rest stay blank,
 * which keeps the exam in review instead of publishing a guess.
 */
export async function solveMissingAnswers(data: { stimuli: AiStimulus[]; questions: (AiQuestion & { review_note?: string })[] }) {
  const todo = data.questions.map((q, i) => ({ q, i })).filter(({ q }) => !q.correct);
  if (!todo.length) return 0;
  const stim = new Map(data.stimuli.map((s) => [s.ref, s]));
  const batches: (typeof todo)[] = [];
  for (let i = 0; i < todo.length; i += 15) batches.push(todo.slice(i, i + 15));
  let solved = 0;
  await pool(batches, aiConcurrency(3), async (batch) => {
    const refs = [...new Set(batch.map(({ q }) => q.stimulus_ref).filter(Boolean))] as string[];
    const shared = refs.map((r) => stim.get(r)).filter(Boolean).map((s) => `[${s!.ref}]\n${s!.content}`).join("\n\n");
    const text = batch
      .map(({ q, i }) => `Q${i + 1}${q.stimulus_ref ? ` (uses ${q.stimulus_ref})` : ""}: ${q.stem}\n${optionLabels(q).map((l) => `${l}. ${q.options[l]}`).join("\n")}`)
      .join("\n\n");
    try {
      const res = await callTool<{ answers?: { index: number; answer: string; confident: boolean }[] }>({
        system: "You are a meticulous exam solver. Work each question out carefully and report only your final choice.",
        maxTokens: 4000,
        content: [{ type: "text", text: `${shared ? `Shared material:\n${shared}\n\n` : ""}${text}` }],
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
                    index: { type: "integer", description: "The number after Q" },
                    answer: { type: "string", enum: ["A", "B", "C", "D", "E", "AMBIGUOUS"] },
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
      for (const a of res.answers ?? []) {
        const hit = batch.find(({ i }) => i + 1 === a.index);
        if (hit && a.confident && (optionLabels(hit.q) as readonly string[]).includes(a.answer)) {
          hit.q.correct = a.answer as (typeof PAPER_LABELS)[number];
          hit.q.review_note = "No answer key was uploaded: the answer was worked out by AI. Verify before relying on it.";
          solved++;
        }
      }
    } catch {
      // Leave this batch unanswered; the exam will wait in review.
    }
  });
  return solved;
}
