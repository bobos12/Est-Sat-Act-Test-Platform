import Link from "next/link";
import { requestTime } from "@/lib/time";
import { SubmitButton } from "@/components/admin/client";
import { notFound } from "next/navigation";
import { RichContentView } from "@/components/exam/rich-content";
import { FormMessage } from "@/components/ui/field";
import { Callout, Empty, Panel, PageHeader, StatusBadge, adminDate, relative } from "@/components/admin/ui";
import { adminClient } from "@/lib/admin/server";
import type { RichContent } from "@/lib/content";
import { cn } from "@/lib/utils";
import { markReviewed, retireQuestion } from "../actions";
import { DeleteDocument } from "../delete-document";
import { RunImportButton, StopImportButton } from "../import-runner";

export const metadata = { title: "Document" };
export const maxDuration = 300; // extraction of a full paper can take a few minutes

export default async function DocumentPage({ params, searchParams }: PageProps<"/admin/knowledge/[id]">) {
  const { supabase } = await adminClient();
  const { id } = await params;
  const sp = await searchParams;
  const { data: doc } = await supabase
    .from("source_documents")
    .select("id, title, kind, session_label, status, status_detail, page_count, file_size_bytes, extracted_question_count, processed_at, created_at, updated_at, subjects(name)")
    .eq("id", id)
    .maybeSingle();
  if (!doc) notFound();
  // No progress for 6 minutes: the server time limit cut the run off, so it can be retried.
  const now = requestTime();
  const stale = doc.status === "processing" && now - Date.parse(doc.updated_at) > 6 * 60_000;
  const running = doc.status === "processing";
  const canRun = doc.kind === "question_paper" && doc.extracted_question_count === 0 && (!running || stale);
  const live = running ? /^(\d{1,3})% · (.*)$/.exec(doc.status_detail ?? "") : null;

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
            {doc.status !== "processing" || stale ? <DeleteDocument id={doc.id} title={doc.title} kind={doc.kind} /> : null}
            {doc.status === "extracted" ? (
              <form action={markReviewed}>
                <input type="hidden" name="id" value={doc.id} />
                <SubmitButton variant="secondary" icon="check" pendingLabel="Saving…">
                  Mark reviewed
                </SubmitButton>
              </form>
            ) : null}
          </>
        }
      />
      {typeof sp.ok === "string" ? <div className="mb-6"><FormMessage tone="success">{sp.ok}</FormMessage></div> : null}
      {typeof sp.error === "string" ? <div className="mb-6"><FormMessage>{sp.error}</FormMessage></div> : null}
      {canRun || running ? (
        <div className="mb-6 rounded-[var(--radius-lg)] bg-white p-5 ring-1 ring-line">
          {running && !stale ? (
            <div className="flex flex-wrap items-center gap-4">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-ink-950">Importing now{live ? ` · ${live[1]}%` : ""}</p>
                <p className="text-sm text-ink-600">
                  {live ? live[2] : doc.status_detail} · last update {relative(doc.updated_at, now)}
                </p>
                {live ? (
                  <div className="mt-2 h-2 max-w-md overflow-hidden rounded-full bg-paper-2">
                    <div className="h-full rounded-full bg-mark-500" style={{ width: `${live[1]}%` }} />
                  </div>
                ) : null}
              </div>
              <StopImportButton docId={doc.id} />
            </div>
          ) : (
            <div className="space-y-4">
              {stale ? (
                <Callout tone="warning" title="This import stopped responding">
                  No progress since {relative(doc.updated_at, now)} (it was probably started before step-by-step imports, or the tab was closed). Run it again; parts that finished are kept.
                </Callout>
              ) : doc.status === "failed" ? (
                <Callout tone="danger" title="The last import didn't finish">
                  {doc.status_detail}
                </Callout>
              ) : (
                <p className="text-sm text-ink-600">This paper hasn&apos;t been imported yet. The AI reads it part by part and publishes it as an exam.</p>
              )}
              <div className="flex flex-wrap items-center gap-2">
                <RunImportButton docId={doc.id} title={doc.title} label={doc.status === "failed" || stale ? "Run import again" : "Run import"} fallback={{ title: doc.title, anyPdf: true }} />
                {stale ? <StopImportButton docId={doc.id} /> : null}
              </div>
            </div>
          )}
        </div>
      ) : doc.status_detail ? (
        <p className="mb-6 text-sm text-ink-600">
          {doc.status_detail}
          {doc.processed_at ? ` · ${adminDate.format(new Date(doc.processed_at))}` : ""}
        </p>
      ) : null}
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
                          <SubmitButton variant="ghost" size="xs" pendingLabel="Excluding…">
                            Exclude
                          </SubmitButton>
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
            <Empty>{doc.status === "processing" && !stale ? "Import in progress. Questions appear here when it finishes." : "Nothing imported yet."}</Empty>
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
