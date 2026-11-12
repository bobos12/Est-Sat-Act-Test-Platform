import Link from "next/link";
import { DataTable, Empty, Panel, PageHeader, StatusBadge, Td, Th, adminDay } from "@/components/admin/ui";
import { adminClient } from "@/lib/admin/server";
import { aiConfigured } from "@/lib/ai/client";
import { ReadyExamForm } from "./ready-exam-form";
import { BulkImport } from "./bulk-import";
import { UploadForm } from "./upload-form";

export const maxDuration = 800;

export const metadata = { title: "Knowledge base" };

export default async function Knowledge() {
  const { supabase } = await adminClient();
  const [{ data: docs }, { data: subjects }, { count: sourceQuestions }] = await Promise.all([
    supabase
      .from("source_documents")
      .select("id, title, kind, session_label, status, status_detail, page_count, extracted_question_count, created_at, subjects(name)")
      .order("created_at", { ascending: false }),
    supabase.from("subjects").select("id, name, official_duration_minutes").order("sort_order"),
    supabase.from("questions").select("id", { count: "exact", head: true }).eq("origin", "source").neq("status", "retired"),
  ]);
  const papers = (docs ?? []).filter((d) => d.kind === "question_paper");

  return (
    <>
      <PageHeader
        title="Knowledge base"
        description={`Official EST papers and answer keys used to analyse the exam and guide AI generation. ${sourceQuestions ?? 0} reference questions extracted so far. Reference questions are never shown to students.`}
      />
      {!aiConfigured() ? (
        <div className="mb-6 rounded-[var(--radius-md)] bg-warning-50 px-4 py-3 text-sm text-warning-700">
          Uploads work now. To analyse papers and generate exams, add <code>GEMINI_API_KEY</code> (free) or <code>ANTHROPIC_API_KEY</code> to the server environment.
        </div>
      ) : null}
      <div className="grid gap-6 xl:grid-cols-[1fr_380px]">
        <Panel title={`Documents (${docs?.length ?? 0})`}>
          {docs?.length ? (
            <DataTable>
              <thead>
                <tr>
                  <Th>Document</Th>
                  <Th>Type</Th>
                  <Th>Questions</Th>
                  <Th>Status</Th>
                </tr>
              </thead>
              <tbody>
                {docs.map((d) => {
                  const s = Array.isArray(d.subjects) ? d.subjects[0] : d.subjects;
                  return (
                    <tr key={d.id} className="hover:bg-paper">
                      <Td>
                        <Link href={`/admin/knowledge/${d.id}`} className="font-medium text-ink-950 hover:underline">
                          {d.title}
                        </Link>
                        <p className="text-xs text-ink-500">
                          {s?.name}
                          {d.session_label ? ` · ${d.session_label}` : ""}
                          {d.page_count ? ` · ${d.page_count} pages` : ""} · added {adminDay.format(new Date(d.created_at))}
                        </p>
                      </Td>
                      <Td className="text-ink-600">{d.kind === "question_paper" ? "Paper" : d.kind === "answer_key" ? "Answer key" : "Reference"}</Td>
                      <Td className="tabular">{d.kind === "question_paper" ? d.extracted_question_count : "—"}</Td>
                      <Td>
                        <StatusBadge status={d.status} />
                        {d.status === "failed" && d.status_detail ? <p className="mt-1 max-w-56 text-xs text-danger-600">{d.status_detail}</p> : null}
                      </Td>
                    </tr>
                  );
                })}
              </tbody>
            </DataTable>
          ) : (
            <Empty>No documents yet. Upload the EST papers and their answer keys to build the knowledge base.</Empty>
          )}
        </Panel>
        <div className="space-y-6">
        <Panel title="Upload a ready exam PDF">
          <div className="p-5">
            <ReadyExamForm subjects={(subjects ?? []).map((s) => ({ id: s.id, name: s.name, minutes: s.official_duration_minutes }))} />
          </div>
        </Panel>
        <Panel title="Import official papers (auto-publish)">
          <div className="p-5">
            <BulkImport />
          </div>
        </Panel>
        <Panel title="Add a single document">
          <div className="p-5">
            <UploadForm subjects={(subjects ?? []).map((s) => ({ id: s.id, name: s.name }))} papers={papers.map((p) => ({ id: p.id, title: p.title }))} />
          </div>
        </Panel>
        </div>
      </div>
    </>
  );
}
