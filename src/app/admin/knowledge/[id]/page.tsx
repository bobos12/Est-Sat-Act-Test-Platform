import Link from "next/link";
import { notFound } from "next/navigation";
import { RichContentView } from "@/components/exam/rich-content";
import { FormMessage } from "@/components/ui/field";
import { Empty, Panel, PageHeader, StatusBadge, adminDate } from "@/components/admin/ui";
import { adminClient } from "@/lib/admin/server";
import type { RichContent } from "@/lib/content";
import { cn } from "@/lib/utils";
import { markReviewed, processDocument, retireQuestion } from "../actions";

export const metadata = { title: "Document" };
export const maxDuration = 300; // extraction of a full paper can take a few minutes

export default async function DocumentPage({ params, searchParams }: PageProps<"/admin/knowledge/[id]">) {
  const { supabase } = await adminClient();
  const { id } = await params;
  const sp = await searchParams;
  const { data: doc } = await supabase
    .from("source_documents")
    .select("id, title, kind, session_label, status, status_detail, page_count, file_size_bytes, extracted_question_count, processed_at, created_at, subjects(name)")
    .eq("id", id)
    .maybeSingle();
  if (!doc) notFound();

  const { data: questions } = await supabase
    .from("questions")
    .select("id, source_question_number, stem, status, review_notes, stimulus_id, topics:topic_id(name), skills:skill_id(name), question_options(label, content, is_correct)")
    .eq("source_document_id", id)
    .order("created_at");
  const subject = Array.isArray(doc.subjects) ? doc.subjects[0] : doc.subjects;
  const noKey = (questions ?? []).filter((q) => !(q.question_options ?? []).some((o) => o.is_correct)).length;

  return (
    <>
      <Link href="/admin/knowledge" className="text-sm text-ink-500 hover:text-ink-950">
        ← Knowledge base
      </Link>
      <PageHeader
        title={doc.title}
        description={
          <span className="inline-flex flex-wrap items-center gap-2">
            <StatusBadge status={doc.status} />
            {subject?.name}
            {doc.session_label ? ` · ${doc.session_label}` : ""} · {doc.page_count ?? "?"} pages · {(doc.file_size_bytes / 1024 / 1024).toFixed(1)} MB
          </span>
        }
        actions={
          <>
            {doc.kind === "question_paper" && doc.extracted_question_count === 0 && doc.status !== "processing" ? (
              <form action={processDocument}>
                <input type="hidden" name="id" value={doc.id} />
                <button className="h-10 rounded-[var(--radius-md)] bg-ink-950 px-4 text-sm font-medium text-paper hover:bg-ink-800">
                  {doc.status === "failed" ? "Retry analysis" : "Analyse with AI"}
                </button>
              </form>
            ) : null}
            {doc.status === "extracted" ? (
              <form action={markReviewed}>
                <input type="hidden" name="id" value={doc.id} />
                <button className="h-10 rounded-[var(--radius-md)] bg-white px-4 text-sm font-medium text-ink-950 ring-1 ring-inset ring-line-strong hover:bg-paper-2">
                  Mark reviewed
                </button>
              </form>
            ) : null}
          </>
        }
      />
      {typeof sp.ok === "string" ? <div className="mb-6"><FormMessage tone="success">{sp.ok}</FormMessage></div> : null}
      {typeof sp.error === "string" ? <div className="mb-6"><FormMessage>{sp.error}</FormMessage></div> : null}
      {doc.status_detail ? <p className="mb-6 text-sm text-ink-600">{doc.status_detail}{doc.processed_at ? ` · ${adminDate.format(new Date(doc.processed_at))}` : ""}</p> : null}
      {doc.kind === "question_paper" && doc.status === "uploaded" ? (
        <p className="mb-6 max-w-2xl text-sm text-ink-600">
          Upload this paper&apos;s answer key first (and link it), then press <strong>Analyse with AI</strong>. The paper and key are read together so
          every question gets its correct answer and official topic. Analysis takes 1–4 minutes.
        </p>
      ) : null}

      {doc.kind === "question_paper" ? (
        <Panel title={`Extracted questions (${questions?.length ?? 0})${noKey ? ` · ${noKey} without a key` : ""}`}>
          {questions?.length ? (
            <ol className="divide-y divide-line">
              {questions.map((q) => {
                const topic = Array.isArray(q.topics) ? q.topics[0] : q.topics;
                const skill = Array.isArray(q.skills) ? q.skills[0] : q.skills;
                return (
                  <li key={q.id} className={cn("px-5 py-4", q.status === "retired" && "opacity-50")}>
                    <div className="flex items-start justify-between gap-4">
                      <p className="text-xs font-medium text-ink-500">
                        Q{q.source_question_number ?? "?"} · {skill?.name ?? topic?.name ?? "No topic"}
                        {q.stimulus_id ? " · shared passage" : ""}
                        {q.status === "retired" ? " · excluded" : ""}
                      </p>
                      {q.status !== "retired" ? (
                        <form action={retireQuestion}>
                          <input type="hidden" name="id" value={q.id} />
                          <input type="hidden" name="doc" value={doc.id} />
                          <button className="text-xs text-ink-500 hover:text-danger-600">Exclude</button>
                        </form>
                      ) : null}
                    </div>
                    <RichContentView content={q.stem as RichContent} className="mt-2 font-reading leading-relaxed text-ink-950" />
                    <div className="mt-2 grid gap-1 sm:grid-cols-2">
                      {(q.question_options ?? [])
                        .sort((a, b) => a.label.localeCompare(b.label))
                        .map((o) => (
                          <div key={o.label} className={cn("flex gap-2 rounded px-2 py-1 text-sm", o.is_correct && "bg-success-50 text-success-700")}>
                            <span className="font-semibold">{o.label}</span>
                            <RichContentView content={o.content as RichContent} className="[&_p]:my-0" />
                          </div>
                        ))}
                    </div>
                    {q.review_notes ? <p className="mt-2 text-xs text-warning-700">{q.review_notes}</p> : null}
                  </li>
                );
              })}
            </ol>
          ) : (
            <Empty>{doc.status === "processing" ? "Analysis in progress — refresh in a minute." : "Nothing extracted yet."}</Empty>
          )}
        </Panel>
      ) : (
        <Panel>
          <Empty>Answer keys are read together with their question paper. Open the paper to run the analysis.</Empty>
        </Panel>
      )}
    </>
  );
}
