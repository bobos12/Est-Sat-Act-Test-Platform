import { requestTime } from "@/lib/time";
import Link from "next/link";
import { DataTable, Empty, Panel, PageHeader, StatusBadge, Td, Th, adminDate } from "@/components/admin/ui";
import { adminClient } from "@/lib/admin/server";
import { aiConfigured } from "@/lib/ai/client";
import { GenerateForm } from "./generate-form";

export const metadata = { title: "Generate exams" };
export const maxDuration = 300;

export default async function Generate() {
  const { supabase } = await adminClient();
  const [{ data: subjects }, { data: topics }, { data: jobs }, { count: refCount }] = await Promise.all([
    supabase.from("subjects").select("id, code, name, official_duration_minutes, official_question_count").eq("is_active", true).order("sort_order"),
    supabase.from("topics").select("id, subject_id, kind, name").order("sort_order"),
    supabase.from("generation_jobs").select("id, status, status_detail, questions_per_exam, exam_count, result_exam_ids, created_at, subjects(name)").order("created_at", { ascending: false }).limit(20),
    supabase.from("questions").select("id", { count: "exact", head: true }).eq("origin", "source").neq("status", "retired"),
  ]);
  const ai = aiConfigured();
  const now = requestTime();

  return (
    <>
      <PageHeader title="Generate exams" description="Write original EST-style exams with AI, guided by the official blueprint and your knowledge base." />
      {!ai ? (
        <div className="mb-6 rounded-[var(--radius-md)] bg-warning-50 px-4 py-3 text-sm text-warning-700">
          Add <code>GEMINI_API_KEY</code> (free) or <code>ANTHROPIC_API_KEY</code> to the server environment to enable generation.
        </div>
      ) : !refCount ? (
        <div className="mb-6 rounded-[var(--radius-md)] bg-info-50 px-4 py-3 text-sm text-info-600">
          Tip: analyse a few official papers in the <Link href="/admin/knowledge" className="underline">knowledge base</Link> first — generation then
          matches their style and level more closely.
        </div>
      ) : null}
      <div className="grid gap-6 xl:grid-cols-[1fr_400px]">
        <Panel className="p-6">
          <GenerateForm subjects={subjects ?? []} topics={topics ?? []} disabled={!ai} />
        </Panel>
        <Panel title="Recent jobs">
          {jobs?.length ? (
            <DataTable className="[&_table]:min-w-0">
              <thead>
                <tr>
                  <Th>Job</Th>
                  <Th>Status</Th>
                </tr>
              </thead>
              <tbody>
                {jobs.map((j) => {
                  const s = Array.isArray(j.subjects) ? j.subjects[0] : j.subjects;
                  const stale = j.status === "running" && now - Date.parse(j.created_at) > 10 * 60 * 1000;
                  return (
                    <tr key={j.id}>
                      <Td>
                        <p className="font-medium text-ink-900">
                          {s?.name} · {j.exam_count}×{j.questions_per_exam}
                        </p>
                        <p className="text-xs text-ink-500">{adminDate.format(new Date(j.created_at))}</p>
                        {j.result_exam_ids?.map((id: string, i: number) => (
                          <Link key={id} href={`/admin/exams/${id}`} className="mr-2 text-xs text-ink-950 underline">
                            Exam {i + 1}
                          </Link>
                        ))}
                        {j.status_detail && j.status === "failed" ? <p className="text-xs text-danger-600">{j.status_detail}</p> : null}
                      </Td>
                      <Td>
                        <StatusBadge status={stale ? "failed" : j.status} />
                        {stale ? <p className="text-xs text-ink-500">Interrupted</p> : null}
                      </Td>
                    </tr>
                  );
                })}
              </tbody>
            </DataTable>
          ) : (
            <Empty>No generation jobs yet.</Empty>
          )}
        </Panel>
      </div>
    </>
  );
}
