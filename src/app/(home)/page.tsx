import { HomePage } from "@/components/home/HomePage";
import { getActivePlans } from "@/lib/catalog";
import { getShelfExams } from "@/lib/shelf";

export default async function Page() {
  const [exams, plans] = await Promise.all([getShelfExams(), getActivePlans()]);
  return <HomePage exams={exams} plans={plans} />;
}
