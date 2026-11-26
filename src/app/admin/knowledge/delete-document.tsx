import { ConfirmSubmit } from "@/components/admin/client";
import { deleteDocument } from "./import-actions";

/** Delete button with a confirmation that says exactly what goes and what stays. */
export function DeleteDocument({ id, title, kind, compact }: { id: string; title: string; kind: string; compact?: boolean }) {
  return (
    <form action={deleteDocument}>
      <input type="hidden" name="id" value={id} />
      <ConfirmSubmit
        size={compact ? "xs" : "md"}
        variant={compact ? "ghost" : "danger-outline"}
        icon="trash"
        title={`Delete “${title}”?`}
        confirmLabel="Delete for good"
        pendingLabel="Deleting…"
        body={
          <ul className="list-disc space-y-1 pl-5">
            <li>The PDF{kind === "question_paper" ? " and its answer key are" : " is"} removed from the knowledge base.</li>
            {kind === "question_paper" ? <li>Reference questions read from it are deleted.</li> : null}
            <li>
              Any exam already built from it <b>stays</b>, with students&apos; results. Archive the exam separately if you don&apos;t want it.
            </li>
            <li>This can&apos;t be undone.</li>
          </ul>
        }
      >
        {compact ? <span className="sr-only">Delete</span> : "Delete"}
      </ConfirmSubmit>
    </form>
  );
}
