"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { getViewer } from "@/lib/auth/session";
import { redirectIfRevoked } from "@/lib/auth/single-session";
import { createClient } from "@/lib/supabase/server";

const input = z.object({ examId: z.string().uuid(), slug: z.string().min(1).max(200) });

/** Start or resume an attempt. Access rules are enforced again inside start_attempt. */
export async function startExam(formData: FormData) {
  const parsed = input.safeParse({ examId: formData.get("examId"), slug: formData.get("slug") });
  if (!parsed.success) redirect("/exams");
  const { examId, slug } = parsed.data;

  const viewer = await getViewer();
  if (!viewer) redirect(`/sign-in?next=${encodeURIComponent(`/exams/${slug}`)}`);

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("start_attempt", { p_exam: examId });
  if (error) {
    redirectIfRevoked(error, `/exams/${slug}`);
    if (error.message.includes("SUBSCRIPTION_REQUIRED")) redirect(`/pricing?exam=${encodeURIComponent(slug)}`);
    if (error.message.includes("EXAM_UNAVAILABLE")) redirect("/exams");
    if (error.message.includes("DAILY_LIMIT")) redirect(`/exams/${encodeURIComponent(slug)}?limit=daily`);
    throw new Error("We couldn't start this exam. Please try again.");
  }
  redirect(`/exam/${data as string}`);
}
