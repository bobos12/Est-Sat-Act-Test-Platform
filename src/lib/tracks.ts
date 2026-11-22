import "server-only";
import { getPublishedExams, getSubjects, type CatalogExam, type Subject } from "@/lib/catalog";
import type { Track } from "@/lib/exam-catalog";

export const trackOfFamily = (family: string): Track => (family === "SAT" ? "sat" : family === "ACT" ? "act" : "est");

export type TrackGroup = { subject: Subject; exams: CatalogExam[] };

/** Published exams for one track, grouped by subject in catalog order. Subjects with no exams are dropped. */
export async function getTrackGroups(track: Track): Promise<TrackGroup[]> {
  const [subjects, exams] = await Promise.all([getSubjects(), getPublishedExams()]);
  return subjects
    .filter((s) => trackOfFamily(s.test_family) === track)
    .map((subject) => ({ subject, exams: exams.filter((e) => e.subject_id === subject.id) }))
    .filter((g) => g.exams.length > 0);
}

/** Live exam count per track, for honest copy ("live now" vs "coming soon"). */
export async function getTrackCounts(): Promise<Record<Track, number>> {
  const [subjects, exams] = await Promise.all([getSubjects(), getPublishedExams()]);
  const family = new Map(subjects.map((s) => [s.id, s.test_family]));
  const out: Record<Track, number> = { est: 0, sat: 0, act: 0 };
  for (const e of exams) out[trackOfFamily(family.get(e.subject_id) ?? "")]++;
  return out;
}

type Faq = { q: string; a: string };

export type TrackContent = {
  key: Track;
  path: `/${Track}`;
  name: string;
  full: string;
  metaTitle: string;
  metaDescription: string;
  h1: string;
  intro: string;
  /** Plain-language definition of the exam: crawlable, quotable by search and AI answer engines. */
  about: string[];
  format: { section: string; questions: string; time: string; notes: string }[];
  scoring: string;
  comingSoon: string;
  faqs: Faq[];
};

export const TRACK_CONTENT: Record<Track, TrackContent> = {
  est: {
    key: "est",
    path: "/est",
    name: "EST",
    full: "Egyptian Scholastic Test",
    metaTitle: "EST Practice Tests Online: EST I Math & Literacy Mock Exams",
    metaDescription:
      "Take full-length EST practice tests online. Timed EST I Math and Literacy mock exams and EST II Math, built for American Diploma students in Egypt, with explanations and a score by topic.",
    h1: "EST practice tests online",
    intro:
      "Full-length, timed EST mock exams for American Diploma students. Practise EST I Math and EST I Literacy on screen, in the real format, then see your score by official topic and an explanation for every question.",
    about: [
      "The EST (Egyptian Scholastic Test) is a standardized admissions test taken by American Diploma students in Egypt. It has two parts: EST I, which covers Math and Literacy, and EST II, a set of subject tests such as Math Level 1, Math Level 2, Biology and Chemistry.",
      "TargetScore's EST practice tests follow the structure of recent EST sessions: the same sections, question counts, timing and official topic names, so a practice score tells you where you really stand.",
    ],
    format: [
      { section: "EST I Math", questions: "50 multiple-choice", time: "75 minutes", notes: "Calculator allowed. Foundational Algebra, Data Analysis and Probability, Advanced Algebra and Functions, Geometry and Trigonometry." },
      { section: "EST I Literacy", questions: "85 multiple-choice", time: "90 minutes", notes: "Three modules: editing in context, reading comprehension, and short mixed passages." },
      { section: "EST II Math Level 1 / Level 2", questions: "40 multiple-choice", time: "60 minutes", notes: "Level 2 includes a formula sheet." },
    ],
    scoring:
      "Each TargetScore EST practice test gives you a raw score, an estimated scaled score out of 800, and a breakdown by the official EST topics, so your weakest topic is named after every test.",
    comingSoon: "",
    faqs: [
      { q: "What is the EST exam?", a: "The EST (Egyptian Scholastic Test) is a standardized test taken by American Diploma students in Egypt. EST I covers Math and Literacy; EST II is a set of subject tests including Math Level 1, Math Level 2, Biology and Chemistry." },
      { q: "How long is the EST I Math test?", a: "EST I Math has 50 multiple-choice questions in 75 minutes, and a calculator is allowed. TargetScore's EST Math practice tests use the same question count and timing." },
      { q: "How is EST I Literacy structured?", a: "EST I Literacy has 85 multiple-choice questions in 90 minutes, split into three modules: editing in context, reading comprehension, and short mixed passages." },
      { q: "Are TargetScore's EST practice tests official?", a: "No. TargetScore is an independent practice platform. Our EST mock exams are written to match the official format, topics and timing; they are not official EST papers." },
      { q: "Can I take an EST practice test for free?", a: "Yes. Create a free account to take every exam marked Free. A membership unlocks the full EST library." },
    ],
  },
  sat: {
    key: "sat",
    path: "/sat",
    name: "SAT",
    full: "SAT",
    metaTitle: "SAT Practice Tests Online: Full-Length Math & Reading and Writing",
    metaDescription:
      "Full-length SAT practice tests online for American Diploma students: timed SAT Math and Reading and Writing sections, instant scoring and an explanation for every question.",
    h1: "SAT practice tests online",
    intro:
      "Full-length SAT practice tests you take on screen, section by section and timed like test day. Every question has an explanation, and every test is scored by skill so you know exactly what to work on.",
    about: [
      "The SAT is a standardized college admissions test from the College Board, accepted by universities in the US and around the world. Many American Diploma students take it alongside or instead of the EST.",
      "The SAT has two sections, Reading and Writing, and Math. Each section is scored from 200 to 800, for a total score from 400 to 1600.",
      "On test day the SAT is adaptive, with the counts below. TargetScore's full-length SAT practice tests use the linear (non-adaptive) practice-test format, which has more questions and more time per section: 66 Reading and Writing questions in 78 minutes, and 54 Math questions in 86 minutes. That makes them a slightly longer, stamina-building version of the real thing.",
    ],
    format: [
      { section: "Reading and Writing", questions: "54 questions in 2 modules", time: "64 minutes", notes: "Short passages: craft and structure, information and ideas, standard English conventions, expression of ideas." },
      { section: "Math", questions: "44 questions in 2 modules", time: "70 minutes", notes: "Algebra, advanced math, problem-solving and data analysis, geometry and trigonometry. Some answers are typed in rather than chosen." },
    ],
    scoring:
      "Each TargetScore SAT practice section gives you an estimated section score from 200 to 800, a breakdown by skill, and an explanation for every question. Your results are saved so you can compare attempts over time.",
    comingSoon: "",
    faqs: [
      { q: "How long is the SAT?", a: "On test day the SAT has two sections: Reading and Writing (54 questions, 64 minutes) and Math (44 questions, 70 minutes), each split into two modules, for 2 hours 14 minutes in total." },
      { q: "Why are TargetScore's SAT practice tests longer than the real SAT?", a: "They use the linear (non-adaptive) practice-test format: 66 Reading and Writing questions in 78 minutes and 54 Math questions in 86 minutes. The skills and question types are the same as the adaptive test; there are simply more questions and more time." },
      { q: "How is the SAT scored?", a: "Each section is scored from 200 to 800, for a total from 400 to 1600. TargetScore estimates a section score after every SAT practice test." },
      { q: "Does TargetScore support SAT grid-in questions?", a: "Yes. SAT Math questions that ask for a typed answer (student-produced responses) are answered by typing, as on the real test." },
      { q: "Is TargetScore affiliated with the College Board?", a: "No. TargetScore is an independent practice platform and is not affiliated with or endorsed by the College Board. SAT® is a trademark of the College Board." },
    ],
  },
  act: {
    key: "act",
    path: "/act",
    name: "ACT",
    full: "ACT",
    metaTitle: "ACT Practice Tests Online: English, Math & Science",
    metaDescription:
      "ACT practice tests for American Diploma students: timed ACT English, Math and Science sections with explanations and a score by topic.",
    h1: "ACT practice tests",
    intro:
      "Timed ACT practice for American Diploma students: ACT English, Math and Science, with an explanation for every question and a score by topic.",
    about: [
      "The ACT is a standardized college admissions test accepted by universities in the US and internationally. It measures English, Math and Reading, with an optional Science section, and reports a composite score from 1 to 36.",
    ],
    format: [
      { section: "English", questions: "50 questions", time: "35 minutes", notes: "Grammar, usage and rhetorical skills in passage context." },
      { section: "Math", questions: "45 questions", time: "50 minutes", notes: "Algebra, functions, geometry, statistics and probability. Calculator allowed." },
      { section: "Science (optional)", questions: "40 questions", time: "40 minutes", notes: "Interpreting data, scientific investigation and evaluating models." },
    ],
    scoring: "Each ACT practice test on TargetScore will be scored by topic, with an explanation for every question.",
    comingSoon:
      "ACT practice tests are being prepared and open as soon as the first full sections are published. Create a free account and you can start with EST and SAT practice today.",
    faqs: [
      { q: "When will ACT practice tests be available?", a: "ACT practice tests open on TargetScore as soon as the first full sections are published. EST and SAT practice tests are available now." },
      { q: "Is TargetScore affiliated with ACT, Inc.?", a: "No. TargetScore is an independent practice platform and is not affiliated with or endorsed by ACT, Inc. ACT® is a trademark of ACT, Inc." },
    ],
  },
};
