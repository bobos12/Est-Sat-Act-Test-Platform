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

export type SubjectKey = "math" | "lit" | "m1" | "m2" | "bio" | "chem";
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
};

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
];

export const FREE_START_HREF = "/exams/foundational-algebra-practice-1";
export const examHref = (e: ShelfExam) => (e.access === "soon" ? "/exams" : `/exams/${e.id}`);
