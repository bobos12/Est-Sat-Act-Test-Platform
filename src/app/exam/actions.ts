"use server";

import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import type { SaveResult } from "@/lib/exam-types";

const saveInput = z.object({
  attemptId: z.string().uuid(),
  questionId: z.string().uuid(),
  optionId: z.string().uuid().nullable(),
  setOption: z.boolean(),
  flagged: z.boolean().nullable(),
});

export type SaveOutcome = { ok: true; result: SaveResult } | { ok: false; retry: boolean; message: string };

/** Persist one answer/flag. Ownership, deadline and option validity are checked in the database. */
export async function saveAnswer(input: z.input<typeof saveInput>): Promise<SaveOutcome> {
  const parsed = saveInput.safeParse(input);
  if (!parsed.success) return { ok: false, retry: false, message: "Invalid answer" };
  const { attemptId, questionId, optionId, setOption, flagged } = parsed.data;

  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("save_answer", {
      p_attempt: attemptId,
      p_question: questionId,
      p_option: optionId,
      p_set_option: setOption,
      p_flagged: flagged,
    });
    if (error) {
      const permanent = /INVALID_|ATTEMPT_NOT_FOUND/.test(error.message);
      return { ok: false, retry: !permanent, message: error.message };
    }
    return { ok: true, result: data as SaveResult };
  } catch (e) {
    return { ok: false, retry: true, message: e instanceof Error ? e.message : "Network error" };
  }
}

export async function submitAttempt(attemptId: string): Promise<{ ok: boolean; message?: string }> {
  if (!z.string().uuid().safeParse(attemptId).success) return { ok: false, message: "Invalid attempt" };
  const supabase = await createClient();
  const { error } = await supabase.rpc("submit_attempt", { p_attempt: attemptId });
  if (error) return { ok: false, message: "We couldn't submit right now. Your answers are saved — please try again." };
  return { ok: true };
}
