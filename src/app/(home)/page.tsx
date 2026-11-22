import { HomePage } from "@/components/home/HomePage";
import { getActivePlans } from "@/lib/catalog";
import { pageMetadata } from "@/lib/seo";
import { getShelfExams } from "@/lib/shelf";

export const metadata = pageMetadata({
  title: "TargetScore: American Diploma EST, SAT & ACT Practice Tests",
  absoluteTitle: true,
  description:
    "Online EST, SAT and ACT practice tests for American Diploma students in Egypt: timed mock exams, explained answers and a score by topic. Start free.",
  path: "/",
});

export default async function Page() {
  const [exams, plans] = await Promise.all([getShelfExams(), getActivePlans()]);
  return <HomePage exams={exams} plans={plans} />;
}
