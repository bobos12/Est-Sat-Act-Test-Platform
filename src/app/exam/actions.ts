"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { redirectIfRevoked } from "@/lib/auth/single-session";
import { getViewer } from "@/lib/auth/session";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import type { SaveResult } from "@/lib/exam-types";

const saveInput = z.object({
  attemptId: z.string().uuid(),
  questionId: z.string().uuid(),
  optionId: z.string().uuid().nullable(),
  response: z.string().max(12).nullable().default(null),
  setOption: z.boolean(),
  flagged: z.boolean().nullable(),
});

export type SaveOutcome = { ok: true; result: SaveResult } | { ok: false; retry: boolean; message: string };

/** Persist one answer/flag. Ownership, deadline and option validity are checked in the database. */
export async function saveAnswer(input: z.input<typeof saveInput>): Promise<SaveOutcome> {
  const parsed = saveInput.safeParse(input);
  if (!parsed.success) return { ok: false, retry: false, message: "Invalid answer" };
  const { attemptId, questionId, optionId, response, setOption, flagged } = parsed.data;

  let res;
  try {
    const supabase = await createClient();
    res = await supabase.rpc("save_answer", {
      p_attempt: attemptId,
      p_question: questionId,
      p_option: optionId,
      p_set_option: setOption,
      p_flagged: flagged,
      p_response: response,
    });
  } catch (e) {
    return { ok: false, retry: true, message: e instanceof Error ? e.message : "Network error" };
  }
  const { data, error } = res;
  if (error) {
    redirectIfRevoked(error, `/exam/${attemptId}`);
    const permanent = /INVALID_|ATTEMPT_NOT_FOUND/.test(error.message);
    return { ok: false, retry: !permanent, message: error.message };
  }
  return { ok: true, result: data as SaveResult };
}

export async function submitAttempt(attemptId: string): Promise<{ ok: boolean; message?: string }> {
  if (!z.string().uuid().safeParse(attemptId).success) return { ok: false, message: "Invalid attempt" };
  const supabase = await createClient();
  const { error } = await supabase.rpc("submit_attempt", { p_attempt: attemptId });
  redirectIfRevoked(error, `/exam/${attemptId}`);
  if (error) return { ok: false, message: "We couldn't submit right now. Your answers are saved — please try again." };
  return { ok: true };
}

/**
 * Discard an unfinished attempt (and its saved answers) so it no longer shows as in progress.
 * Students can't delete attempts through RLS, so this checks ownership here and deletes with the service key.
 */
export async function cancelAttempt(attemptId: string): Promise<{ ok: boolean; message?: string }> {
  if (!z.string().uuid().safeParse(attemptId).success) return { ok: false, message: "Invalid attempt" };
  const viewer = await getViewer();
  if (!viewer) return { ok: false, message: "Please sign in again." };
  let svc;
  try {
    svc = createServiceClient();
  } catch {
    return { ok: false, message: "Cancelling isn't available right now." };
  }
  const { data, error } = await svc
    .from("exam_attempts")
    .delete()
    .eq("id", attemptId)
    .eq("user_id", viewer.id)
    .eq("status", "in_progress")
    .select("id");
  if (error) return { ok: false, message: "We couldn't cancel this exam. Please try again." };
  if (!data?.length) return { ok: false, message: "This exam has already finished." };
  revalidatePath("/dashboard");
  revalidatePath("/exams");
  return { ok: true };
}
