import type { RichContent } from "@/lib/content";
import type { Difficulty } from "@/lib/catalog";

export type BankMode = "new" | "mistakes" | "bookmarked" | "all";

export type BankSubject = {
  id: string;
  code: string;
  name: string;
  short_name: string;
  family: string;
  total: number;
  available: number;
  answered: number;
  correct: number;
  mistakes: number;
  bookmarked: number;
};

export type BankCategory = {
  id: string | null;
  subject_id: string;
  name: string;
  kind: "topic" | "skill" | "domain" | null;
  total: number;
  available: number;
  answered: number;
  correct: number;
  mistakes: number;
  easy: number;
  medium: number;
  hard: number;
};

export type BankSessionSummary = {
  id: string;
  mode: BankMode;
  tutor: boolean;
  created_at: string;
  completed_at?: string | null;
  subject: string;
  total: number;
  answered: number;
  correct?: number;
};

export type BankOverview = {
  premium: boolean;
  subjects: BankSubject[];
  categories: BankCategory[];
  totals: { answers: number; correct: number; minutes: number; sessions: number };
  open_session: BankSessionSummary | null;
  recent: BankSessionSummary[];
};

export type BankAnswer = {
  option_id: string | null;
  time_ms: number | null;
  revealed: boolean;
  is_correct?: boolean | null;
  correct_option_id?: string | null;
  explanation?: RichContent | null;
  peer_correct?: number | null;
};

export type BankQuestion = {
  id: string;
  n: number;
  stem: RichContent;
  stimulus_id: string | null;
  stimulus_marker: number | null;
  difficulty: Difficulty;
  category: string | null;
  bookmarked: boolean;
  options: { id: string; label: string; content: RichContent }[];
  answer: BankAnswer | null;
  key: { correct_option_id: string | null; explanation: RichContent | null } | null;
};

export type BankStimulus = { id: string; kind: string; title: string | null; attribution: string | null; content: RichContent };

export type BankSessionPayload = {
  session: {
    id: string;
    mode: BankMode;
    tutor: boolean;
    created_at: string;
    completed_at: string | null;
    subject: { id: string; code: string; name: string };
  };
  questions: BankQuestion[];
  stimuli: BankStimulus[];
};

export const modeLabel: Record<BankMode, string> = {
  new: "New questions",
  mistakes: "Mistakes review",
  bookmarked: "Bookmarked",
  all: "Mixed practice",
};
