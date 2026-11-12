import { HomePage } from "@/components/home/HomePage";
import { FALLBACK_CATALOG } from "@/lib/exam-catalog";
// import { getShelfExams } from "@/lib/shelf";   // ← see INTEGRATE.md step 3

export default async function Page() {
  // const exams = await getShelfExams();
  const exams = FALLBACK_CATALOG;
  return <HomePage exams={exams} />;
}
