import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/admin/ui";
import { adminClient } from "@/lib/admin/server";
import { contentToText, type RichContent } from "@/lib/content";
import { StimulusForm } from "../../../stimulus-form";

export const metadata = { title: "Passage" };

export default async function StimulusEditor({ params }: PageProps<"/admin/exams/[id]/stimuli/[sid]">) {
  const { supabase } = await adminClient();
  const { id, sid } = await params;
  const { data: exam } = await supabase.from("exams").select("id, title, subject_id").eq("id", id).maybeSingle();
  if (!exam) notFound();
  const { data: domains } = await supabase.from("topics").select("id, name").eq("subject_id", exam.subject_id).eq("kind", "domain").order("sort_order");

  let stimulus;
  if (sid !== "new") {
    const { data } = await supabase.from("stimuli").select("id, kind, title, attribution, domain_topic_id, content").eq("id", sid).maybeSingle();
    if (!data) notFound();
    stimulus = { ...data, content: contentToText(data.content as RichContent) };
  }
  return (
    <>
      <Link href={`/admin/exams/${id}`} className="text-sm text-ink-500 hover:text-ink-950">
        ← {exam.title}
      </Link>
      <PageHeader
        title={stimulus ? "Edit shared passage" : "New shared passage"}
        description="A passage, table or figure that several questions refer to. It stays on screen while students answer its questions."
      />
      <StimulusForm examId={id} stimulus={stimulus} domains={domains ?? []} />
    </>
  );
}
