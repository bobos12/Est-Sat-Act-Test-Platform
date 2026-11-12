import Link from "next/link";
import { Panel, PageHeader } from "@/components/admin/ui";
import { adminClient } from "@/lib/admin/server";
import { loadTaxonomy } from "@/lib/admin/data";
import { createExam } from "../actions";
import { ExamForm } from "../exam-form";

export const metadata = { title: "New exam" };

export default async function NewExam() {
  const { supabase } = await adminClient();
  const { subjects, topics } = await loadTaxonomy(supabase);
  return (
    <>
      <Link href="/admin/exams" className="text-sm text-ink-500 hover:text-ink-950">
        ← Exams
      </Link>
      <PageHeader title="New exam" description="Set up the exam, then add questions and passages. It stays a draft until you publish it." />
      <Panel className="p-6">
        <ExamForm action={createExam} subjects={subjects} topics={topics} />
      </Panel>
    </>
  );
}
