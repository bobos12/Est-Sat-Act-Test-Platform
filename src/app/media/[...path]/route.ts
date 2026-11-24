import { NextResponse, type NextRequest } from "next/server";
import { getViewer, isAdminVerified } from "@/lib/auth/session";
import { MEDIA_BUCKET } from "@/lib/content";
import { createServiceClient } from "@/lib/supabase/server";

/**
 * Question images for admin views (editors, previews). Students never use this:
 * their exam, review and practice payloads already carry signed URLs.
 */
export async function GET(_req: NextRequest, ctx: RouteContext<"/media/[...path]">) {
  const viewer = await getViewer();
  if (viewer?.role !== "admin" || !(await isAdminVerified())) return new NextResponse("Not found", { status: 404 });

  const { path } = await ctx.params;
  const { data, error } = await createServiceClient().storage.from(MEDIA_BUCKET).createSignedUrl(path.join("/"), 600);
  if (error || !data) return new NextResponse("Not found", { status: 404 });
  const res = NextResponse.redirect(data.signedUrl, 302);
  res.headers.set("Cache-Control", "private, no-store");
  return res;
}
