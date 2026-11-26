import { importProgress } from "../actions";

/**
 * Progress of a running PDF import, polled by the upload form.
 * A route handler, not a server action: the browser runs server actions one at a time,
 * so a poll action would wait behind the import itself.
 */
export async function GET(request: Request) {
  const title = new URL(request.url).searchParams.get("title") ?? "";
  const progress = await importProgress(title);
  return Response.json(progress, { headers: { "Cache-Control": "no-store" } });
}
