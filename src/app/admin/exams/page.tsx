import Link from "next/link";
import { ButtonLink } from "@/components/ui/button";
import { DataTable, Empty, Panel, PageHeader, StatusBadge, Td, Th, adminDay } from "@/components/admin/ui";
import { adminClient } from "@/lib/admin/server";
import { cn } from "@/lib/utils";

export const metadata = { title: "Exams" };

const filters = [
  { key: "", label: "All" },
  { key: "draft", label: "Draft" },
  { key: "in_review", label: "In review" },
  { key: "published", label: "Published" },
  { key: "archived", label: "Archived" },
];

export default async function AdminExams({ searchParams }: PageProps<"/admin/exams">) {
  const { supabase } = await adminClient();
  const { status } = await searchParams;
  const current = typeof status === "string" ? status : "";

  let query = supabase
    .from("exams")
    .select("id, title, status, access, kind, duration_minutes, question_count, origin, updated_at, subjects(name)")
    .order("updated_at", { ascending: false });
  if (current) query = query.eq("status", current);
  const { data: exams, error } = await query;
  if (error) throw new Error(error.message);

  return (
    <>
      <PageHeader
        title="Exams"
        description="Create, review and publish exams. Nothing reaches students until it is published."
        actions={
          <>
            <ButtonLink href="/admin/generate" variant="secondary">
              Generate with AI
            </ButtonLink>
            <ButtonLink href="/admin/exams/new">New exam</ButtonLink>
          </>
        }
      />
      <div className="mb-4 flex flex-wrap gap-1.5">
        {filters.map((f) => (
          <Link
            key={f.key}
            href={f.key ? `/admin/exams?status=${f.key}` : "/admin/exams"}
            className={cn(
              "rounded-full px-3 py-1.5 text-sm",
              current === f.key ? "bg-ink-950 text-paper" : "bg-white text-ink-600 ring-1 ring-line hover:text-ink-950",
            )}
          >
            {f.label}
          </Link>
        ))}
      </div>
      <Panel>
        {exams?.length ? (
          <DataTable>
            <thead>
              <tr>
                <Th>Exam</Th>
                <Th>Questions</Th>
                <Th>Access</Th>
                <Th>Status</Th>
                <Th>Updated</Th>
              </tr>
            </thead>
            <tbody>
              {exams.map((e) => {
                const subject = Array.isArray(e.subjects) ? e.subjects[0] : e.subjects;
                return (
                  <tr key={e.id} className="hover:bg-paper">
                    <Td>
                      <Link href={`/admin/exams/${e.id}`} className="font-medium text-ink-950 hover:underline">
                        {e.title}
                      </Link>
                      <p className="text-xs text-ink-500">
                        {subject?.name} · {e.kind === "full_mock" ? "Full mock" : "Practice"} · {e.duration_minutes} min
                        {e.origin === "ai_generated" ? " · AI-generated" : ""}
                      </p>
                    </Td>
                    <Td className="tabular">{e.question_count}</Td>
                    <Td className="capitalize">{e.access}</Td>
                    <Td>
                      <StatusBadge status={e.status} />
                    </Td>
                    <Td className="text-ink-500">{adminDay.format(new Date(e.updated_at))}</Td>
                  </tr>
                );
              })}
            </tbody>
          </DataTable>
        ) : (
          <Empty>No exams{current ? ` with status “${current.replace("_", " ")}”` : ""} yet.</Empty>
        )}
      </Panel>
    </>
  );
}
