import type { RichContent } from "@/lib/content";

export type AttemptPayload = {
  attempt: { id: string; status: "in_progress"; started_at: string; deadline_at: string; server_now: string };
  exam: { id: string; title: string; duration_minutes: number; subject: { code: string; name: string } };
  sections: { id: string; position: number; title: string; instructions: RichContent }[];
  questions: {
    id: string;
    position: number;
    section_id: string;
    stem: RichContent;
    stimulus_id: string | null;
    stimulus_marker: number | null;
    options: { id: string; label: string; content: RichContent }[];
  }[];
  stimuli: { id: string; kind: string; title: string | null; attribution: string | null; content: RichContent }[];
  answers: { question_id: string; option_id: string | null; flagged: boolean }[];
};

export type ClosedPayload = { attempt: { id: string; status: "submitted" | "expired" } };

export type SaveResult = { closed: boolean; status?: string; saved_at?: string };
