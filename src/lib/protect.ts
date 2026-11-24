import "server-only";
import { signQuestionMedia } from "@/lib/media";
import { requestTime } from "@/lib/time";
import { fingerprintContent, watermarkCode } from "@/lib/watermark";

/** Question content on its way to a student: their hidden leak mark in the text, signed image links. */
export function protectPayload<T>(data: T, userId: string): Promise<T> {
  return signQuestionMedia(fingerprintContent(data, userId));
}

/** Props for <ContentGuard>: the student's code and today's date. */
export function watermarkFor(userId: string) {
  return { code: watermarkCode(userId), date: new Date(requestTime()).toISOString().slice(0, 10) };
}
