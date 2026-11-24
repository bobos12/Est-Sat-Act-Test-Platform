"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import type { BankAnswer } from "@/lib/bank-types";
import { redirectIfRevoked } from "@/lib/auth/single-session";
import { getViewer } from "@/lib/auth/session";
import { signQuestionMedia } from "@/lib/media";
import { fingerprintContent } from "@/lib/watermark";
import { createClient } from "@/lib/supabase/server";

export type CreateState = { error?: string } | undefined;

const uuid = z.string().uuid();
const createInput = z.object({
  subject: uuid,
  categories: z.array(uuid).max(40),
  difficulties: z.array(z.enum(["easy", "medium", "hard"])).max(3),
  mode: z.enum(["new", "mistakes", "bookmarked", "all"]),
  count: z.coerce.number().int().min(1).max(100),
  tutor: z.boolean(),
});

/** Build a practice session from the bank filters and open it. */
export async function createPracticeSession(_: CreateState, formData: FormData): Promise<CreateState> {
  const parsed = createInput.safeParse({
    subject: formData.get("subject"),
    categories: formData.getAll("category").map(String).filter(Boolean),
    difficulties: formData.getAll("difficulty").map(String).filter(Boolean),
    mode: formData.get("mode"),
    count: formData.get("count"),
    tutor: formData.get("tutor") !== "test",
  });
  if (!parsed.success) return { error: "Pick a subject and how many questions you want." };
  const v = parsed.data;

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("bank_create_session", {
    p_subject: v.subject,
    p_categories: v.categories.length ? v.categories : null,
    p_difficulties: v.difficulties.length ? v.difficulties : null,
    p_mode: v.mode,
    p_count: v.count,
    p_tutor: v.tutor,
  });
  if (error) {
    redirectIfRevoked(error, "/practice");
    if (error.message.includes("NO_QUESTIONS")) {
      return {
        error:
          v.mode === "new"
            ? "You've already answered every question that matches. Try Mixed practice or widen your filters."
            : v.mode === "mistakes"
              ? "No mistakes to review here. Nice work."
              : v.mode === "bookmarked"
                ? "You haven't bookmarked any questions that match these filters yet."
                : "No questions match these filters yet.",
      };
    }
    if (error.message.includes("AUTH_REQUIRED")) redirect("/sign-in?next=/practice");
    if (error.message.includes("DAILY_LIMIT")) return { error: "You've reached today's practice limit. More questions open up within 24 hours." };
    return { error: "We couldn't start the session. Please try again." };
  }
  redirect(`/practice/${data as string}`);
}

/** Start a quick session in one click (used by the "Review mistakes" / "Bookmarked" cards). */
export async function quickSession(formData: FormData) {
  const fd = new FormData();
  for (const [k, v] of formData.entries()) fd.append(k, v);
  if (!fd.get("count")) fd.set("count", "20");
  const res = await createPracticeSession(undefined, fd);
  if (res?.error) redirect(`/practice?subject=${encodeURIComponent(String(formData.get("subject") ?? ""))}&error=${encodeURIComponent(res.error)}`);
}

export type AnswerOutcome =
  | { ok: true; answer: BankAnswer }
  | { ok: false; message: string; finished?: boolean };

export async function submitPracticeAnswer(input: { sessionId: string; questionId: string; optionId: string; timeMs: number }): Promise<AnswerOutcome> {
  const parsed = z
    .object({ sessionId: uuid, questionId: uuid, optionId: uuid, timeMs: z.number().int().min(0).max(3_600_000) })
    .safeParse(input);
  if (!parsed.success) return { ok: false, message: "Invalid answer" };
  const { sessionId, questionId, optionId, timeMs } = parsed.data;
  let res;
  try {
    const supabase = await createClient();
    res = await supabase.rpc("bank_answer", {
      p_session: sessionId,
      p_question: questionId,
      p_option: optionId,
      p_time_ms: timeMs,
    });
  } catch {
    return { ok: false, message: "Network error. Your answer wasn't saved; try again." };
  }
  redirectIfRevoked(res.error, `/practice/${sessionId}`);
  try {
    const { data, error } = res;
    if (error) {
      return { ok: false, message: "We couldn't save that answer. Check your connection and try again.", finished: error.message.includes("SESSION_FINISHED") };
    }
    const viewer = await getViewer();
    const d = (await signQuestionMedia(viewer ? fingerprintContent(data, viewer.id) : data)) as { option_id: string; is_correct?: boolean; correct_option_id?: string; explanation?: BankAnswer["explanation"]; peer_correct?: number | null; time_ms?: number };
    return {
      ok: true,
      answer: {
        option_id: d.option_id,
        time_ms: d.time_ms ?? timeMs,
        revealed: d.correct_option_id !== undefined,
        is_correct: d.is_correct ?? null,
        correct_option_id: d.correct_option_id ?? null,
        explanation: d.explanation ?? null,
        peer_correct: d.peer_correct ?? null,
      },
    };
  } catch {
    return { ok: false, message: "Network error. Your answer wasn't saved; try again." };
  }
}

export async function finishPracticeSession(sessionId: string): Promise<{ ok: boolean }> {
  if (!uuid.safeParse(sessionId).success) return { ok: false };
  const supabase = await createClient();
  const { error } = await supabase.rpc("bank_finish_session", { p_session: sessionId });
  redirectIfRevoked(error, `/practice/${sessionId}`);
  return { ok: !error };
}

/** Wipe the student's answers and sessions for one subject (bookmarks stay). */
export async function resetProgress(subjectId: string): Promise<{ ok: boolean }> {
  if (!uuid.safeParse(subjectId).success) return { ok: false };
  const supabase = await createClient();
  const { error } = await supabase.rpc("bank_reset_progress", { p_subject: subjectId });
  redirectIfRevoked(error, "/practice");
  return { ok: !error };
}

/** Same questions, fresh start. */
export async function restartSession(formData: FormData) {
  const id = uuid.safeParse(formData.get("session"));
  if (!id.success) redirect("/practice");
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("bank_restart_session", { p_session: id.data });
  redirectIfRevoked(error, "/practice");
  if (error) redirect(`/practice?error=${encodeURIComponent("We couldn't restart that session. Please try again.")}`);
  redirect(`/practice/${data as string}`);
}

export async function toggleBookmark(questionId: string): Promise<{ ok: boolean; bookmarked?: boolean }> {
  if (!uuid.safeParse(questionId).success) return { ok: false };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("bank_toggle_bookmark", { p_question: questionId });
  redirectIfRevoked(error);
  if (error) return { ok: false };
  return { ok: true, bookmarked: Boolean(data) };
}
