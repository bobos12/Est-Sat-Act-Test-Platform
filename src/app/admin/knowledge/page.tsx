import Link from "next/link";
import { SearchBox, Tabs } from "@/components/admin/client";
import { btn } from "@/components/admin/btn";
import { Callout, DataTable, Empty, Panel, PageHeader, StatCard, StatusBadge, Td, Th, adminDay, one } from "@/components/admin/ui";
import { adminClient } from "@/lib/admin/server";
import { aiConfigured } from "@/lib/ai/client";
import { requestTime } from "@/lib/time";
import { BulkImport } from "./bulk-import";
import { ReadyExamForm } from "./ready-exam-form";
import { UploadForm } from "./upload-form";

export const maxDuration = 300; // Vercel Hobby limit

export const metadata = { title: "PDF imports" };

const RECENT = 5;

export default async function Knowledge({ searchParams }: PageProps<"/admin/knowledge">) {
  const { supabase } = await adminClient();
  const sp = await searchParams;
  const showAll = sp.all === "1";
  const q = typeof sp.q === "string" ? sp.q.trim().slice(0, 80) : "";

  let docsQuery = supabase
    .from("source_documents")
    .select("id, title, kind, session_label, status, status_detail, page_count, extracted_question_count, created_at, updated_at, subjects(name)", { count: "exact" })
    .order("created_at", { ascending: false });
  if (q) docsQuery = docsQuery.ilike("title", `%${q.replace(/[%_\\]/g, " ")}%`);
  if (!showAll && !q) docsQuery = docsQuery.limit(RECENT);

  const [{ data: docs, count }, { data: subjects }, { count: sourceQuestions }, { data: papers }, { count: failed }, { count: processing }, { count: allDocs }] = await Promise.all([
    docsQuery,
    supabase.from("subjects").select("id, name, official_duration_minutes").order("sort_order"),
    supabase.from("questions").select("id", { count: "exact", head: true }).eq("origin", "source").neq("status", "retired"),
    supabase.from("source_documents").select("id, title").eq("kind", "question_paper").order("created_at", { ascending: false }),
    supabase.from("source_documents").select("id", { count: "exact", head: true }).eq("status", "failed"),
    supabase.from("source_documents").select("id", { count: "exact", head: true }).eq("status", "processing"),
    supabase.from("source_documents").select("id", { count: "exact", head: true }),
  ]);
  const total = count ?? 0;
  const now = requestTime();

  return (
    <>
      <PageHeader title="PDF imports" description="Turn an exam PDF into a ready exam, or add official papers and answer keys to the knowledge base the AI learns from." />

      {!aiConfigured() ? (
        <div className="mb-6">
          <Callout tone="warning">
            Uploads work now. To read papers and build exams, add <code>GEMINI_API_KEY</code> (free) or <code>ANTHROPIC_API_KEY</code> to the server environment.
          </Callout>
        </div>
      ) : null}

      <Tabs
        initial={typeof sp.tab === "string" ? sp.tab : undefined}
        tabs={[
          {
            id: "exam",
            label: "Upload an exam",
            icon: "sparkle",
            content: (
              <Panel title="Upload a ready exam PDF" description="The AI reads every question, matches the answer key and builds the exam in a few minutes." icon="exams">
                <div className="p-5">
                  <ReadyExamForm subjects={(subjects ?? []).map((s) => ({ id: s.id, name: s.name, minutes: s.official_duration_minutes }))} />
                </div>
              </Panel>
            ),
          },
          {
            id: "bulk",
            label: "Import official papers",
            icon: "book",
            content: (
              <Panel title="Import official papers (auto-publish)" description="Drop several papers with their answer keys; each pair becomes a published exam." icon="book">
                <div className="p-5">
                  <BulkImport />
                </div>
              </Panel>
            ),
          },
          {
            id: "doc",
            label: "Add a reference document",
            icon: "plus",
            content: (
              <Panel title="Add a single document" description="Stored for reference and AI analysis only. Nothing is shown to students." icon="plus">
                <div className="p-5">
                  <UploadForm subjects={(subjects ?? []).map((s) => ({ id: s.id, name: s.name }))} papers={(papers ?? []).map((p) => ({ id: p.id, title: p.title }))} />
                </div>
              </Panel>
            ),
          },
        ]}
      />

      <div className="mt-10 grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Documents" value={allDocs ?? 0} note="papers, keys and references" icon="book" />
        <StatCard label="Reference questions" value={(sourceQuestions ?? 0).toLocaleString("en")} note="never shown to students" icon="bank" tone="brand" />
        <StatCard label="Processing" value={processing ?? 0} note={processing ? "being read right now" : "nothing running"} icon="clock" tone={processing ? "warning" : "neutral"} />
        <StatCard label="Failed" value={failed ?? 0} note={failed ? "open one to retry" : "no failed imports"} icon="alert" tone={failed ? "danger" : "success"} />
      </div>

      <Panel
        className="mt-6"
        title={showAll || q ? `Documents (${total})` : "Latest documents"}
        icon="book"
        actions={
          <div className="flex items-center gap-2">
            <SearchBox placeholder="Search documents" className="w-56" />
            {!q ? (
              <Link href={showAll ? "/admin/knowledge" : "/admin/knowledge?all=1"} scroll={false} className={btn("secondary", "sm")}>
                {showAll ? "Show latest only" : `Show all (${total})`}
              </Link>
            ) : null}
          </div>
        }
      >
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
                const s = one(d.subjects);
                const stale = d.status === "processing" && now - Date.parse(d.updated_at) > 6 * 60_000;
                const live = d.status === "processing" && !stale ? /^(\d{1,3})% · (.*)$/.exec(d.status_detail ?? "") : null;
                return (
                  <tr key={d.id} className="hover:bg-paper">
                    <Td>
                      <Link href={`/admin/knowledge/${d.id}`} className="font-medium text-ink-950 hover:text-mark-600">
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
                      {stale ? <StatusBadge status="failed" label="Timed out · open to retry" /> : <StatusBadge status={d.status} label={live ? `Processing ${live[1]}%` : undefined} />}
                      {d.status === "failed" && d.status_detail ? <p className="mt-1 max-w-56 text-xs text-danger-600">{d.status_detail}</p> : null}
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </DataTable>
        ) : (
          <Empty icon="book">{q ? `No documents match “${q}”.` : "No documents yet. Upload an exam PDF above to get started."}</Empty>
        )}
        {!showAll && !q && total > RECENT ? (
          <Link href="/admin/knowledge?all=1" scroll={false} className="block border-t border-line px-5 py-3 text-center text-sm font-medium text-mark-600 hover:bg-paper">
            Show all {total} documents
          </Link>
        ) : null}
      </Panel>
    </>
  );
}
