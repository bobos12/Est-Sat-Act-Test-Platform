/**
 * 16hundred exam catalog — the shape the homepage shelf renders.
 *
 * `FALLBACK_CATALOG` mirrors the EST blueprint (24 official papers in TESTS/):
 * EST I Math + Literacy for the Sample / Jan / Mar / May 2026 sessions, and the
 * four EST II subjects (stored, not launched → "soon").
 *
 * IMPORTANT: the "<session> format" mocks are ORIGINAL questions generated to match
 * that session's topic split — official EST questions stay reference-only
 * (blocked from student exams by a DB rule). Until those mocks are generated and
 * published in Admin, `getShelfExams()` shows only what is really published, plus
 * the catalog entries marked "soon".
 */

export type SubjectKey = "math" | "lit" | "m1" | "m2" | "bio" | "chem" | "satm" | "sate" | "actm" | "acte" | "actb";
export type Track = "est" | "sat" | "act";
export type Access = "free" | "pro" | "soon";

export interface ShelfExam {
  id: string;            // slug used in /exams/[slug]
  subject: SubjectKey;
  title: string;
  kind: string;          // "Full-length mock", "Topic practice set", …
  questions: number;
  minutes: number;
  modules: number[];     // question count per section, drives the dot sheet
  access: Access;
  live?: boolean;
}

export const SUBJECTS: Record<SubjectKey, { label: string; color: string; shades?: string[] }> = {
  math: { label: "EST I · Math", color: "#1559ED" },
  lit: { label: "EST I · Literacy", color: "#0A0F1C", shades: ["#0A0F1C", "#3B4458", "#7A8499"] },
  m1: { label: "EST II · Math L1", color: "#6AA4FF" },
  m2: { label: "EST II · Math L2", color: "#6AA4FF" },
  bio: { label: "EST II · Biology", color: "#14A6B8" },
  chem: { label: "EST II · Chemistry", color: "#7C8BFF" },
  satm: { label: "SAT · Math", color: "#0B3FC2" },
  sate: { label: "SAT · English", color: "#3B4458" },
  actm: { label: "ACT · Math", color: "#1559ED" },
  acte: { label: "ACT · English", color: "#0A0F1C" },
  actb: { label: "ACT · Biology", color: "#14A6B8" },
};

export const TRACK_OF: Record<SubjectKey, Track> = {
  math: "est", lit: "est", m1: "est", m2: "est", bio: "est", chem: "est",
  satm: "sat", sate: "sat", actm: "act", acte: "act", actb: "act",
};

/** Subject codes in the database for each shelf key. */
export const SUBJECT_BY_CODE: Record<string, SubjectKey> = {
  "est1-math": "math", "est1-literacy": "lit", "est2-math1": "m1", "est2-math2": "m2", "est2-biology": "bio", "est2-chemistry": "chem",
  "sat-math": "satm", "sat-english": "sate", "act-math": "actm", "act-english": "acte", "act-biology": "actb",
};

/** The three tracks shown on the homepage. Section codes point at library filters. */
export const TRACKS: { key: Track; name: string; full: string; tag: string; color: string; logo: { src: string; w: number; h: number }; format: string; blurb: string; sections: { label: string; code: string }[] }[] = [
  {
    key: "est", name: "EST", full: "Egyptian Scholastic Test", tag: "Online · 01", color: "#1559ED", logo: { src: "/logos/est.png", w: 963, h: 562 }, format: "EST I + EST II · full papers",
    blurb: "Take every EST paper fully online, timed and scored by the official topics.",
    sections: [
      { label: "EST I Math", code: "est1-math" }, { label: "EST I Literacy", code: "est1-literacy" },
      { label: "EST II Math 1", code: "est2-math1" }, { label: "EST II Math 2", code: "est2-math2" },
    ],
  },
  {
    key: "sat", name: "SAT", full: "Digital SAT", tag: "College · 02", color: "#0A1A3A", logo: { src: "/logos/sat-blue.png", w: 308, h: 171 }, format: "2 sections · 98 questions · 2h 14m",
    blurb: "The exam US colleges know best. Sharpen Math and Reading & Writing module by module.",
    sections: [{ label: "Math", code: "sat-math" }, { label: "Reading & Writing", code: "sat-english" }],
  },
  {
    key: "act", name: "ACT", full: "ACT", tag: "Pace · 03", color: "#14A6B8", logo: { src: "/logos/act.png", w: 505, h: 305 }, format: "3 sections · 135 questions · 2h 5m",
    blurb: "Build pace and precision across ACT Math, English and Science.",
    sections: [{ label: "Math", code: "act-math" }, { label: "English", code: "act-english" }, { label: "Biology", code: "act-biology" }],
  },
];

const mathMock = (id: string, session: string, access: Access): ShelfExam => ({
  id, subject: "math", title: `Math Full Mock: ${session} format`, kind: "Full-length mock",
  questions: 50, minutes: 75, modules: [50], access,
});
const litMock = (id: string, session: string, access: Access): ShelfExam => ({
  id, subject: "lit", title: `Literacy Full Mock: ${session} format`, kind: "Full-length mock · 3 modules",
  questions: 85, minutes: 90, modules: [35, 25, 25], access,
});

export const FALLBACK_CATALOG: ShelfExam[] = [
  { id: "foundational-algebra-practice-1", subject: "math", title: "Foundational Algebra Practice 1",
    kind: "Topic practice set", questions: 10, minutes: 15, modules: [10], access: "free", live: true },
  mathMock("est1-math-sample", "Sample", "free"),
  litMock("est1-lit-sample", "Sample", "free"),
  mathMock("est1-math-jan26", "January 2026", "pro"),
  mathMock("est1-math-mar26", "March 2026", "pro"),
  mathMock("est1-math-may26", "May 2026", "pro"),
  litMock("est1-lit-jan26", "January 2026", "pro"),
  litMock("est1-lit-mar26", "March 2026", "pro"),
  litMock("est1-lit-may26", "May 2026", "pro"),
  { id: "est2-math1", subject: "m1", title: "EST II Math Level 1", kind: "Full-length mock", questions: 40, minutes: 60, modules: [40], access: "soon" },
  { id: "est2-math2", subject: "m2", title: "EST II Math Level 2", kind: "Full-length mock · formula sheet", questions: 40, minutes: 60, modules: [40], access: "soon" },
  { id: "est2-bio", subject: "bio", title: "EST II Biology", kind: "Full-length mock", questions: 60, minutes: 60, modules: [60], access: "soon" },
  { id: "est2-chem", subject: "chem", title: "EST II Chemistry", kind: "Full-length mock", questions: 60, minutes: 60, modules: [60], access: "soon" },
  { id: "sat-math", subject: "satm", title: "SAT Math", kind: "Full-length mock · 2 modules", questions: 44, minutes: 70, modules: [22, 22], access: "soon" },
  { id: "sat-english", subject: "sate", title: "SAT Reading and Writing", kind: "Full-length mock · 2 modules", questions: 54, minutes: 64, modules: [27, 27], access: "soon" },
  { id: "act-math", subject: "actm", title: "ACT Math", kind: "Full-length mock", questions: 45, minutes: 50, modules: [45], access: "soon" },
  { id: "act-english", subject: "acte", title: "ACT English", kind: "Full-length mock", questions: 50, minutes: 35, modules: [50], access: "soon" },
  { id: "act-biology", subject: "actb", title: "ACT Science (Biology)", kind: "Full-length mock", questions: 40, minutes: 40, modules: [40], access: "soon" },
];

export const FREE_START_HREF = "/exams/foundational-algebra-practice-1";
export const examHref = (e: ShelfExam) => (e.access === "soon" ? "/exams" : `/exams/${e.id}`);
