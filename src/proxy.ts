import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy-session";

// Optimistic gate only: real authorization happens in server code and RLS.
const PROTECTED = ["/dashboard", "/exam", "/results", "/account", "/admin", "/checkout"];

export async function proxy(request: NextRequest) {
  const { response, userId } = await updateSession(request);
  const { pathname, search } = request.nextUrl;

  if (!userId && PROTECTED.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
    const url = request.nextUrl.clone();
    url.pathname = "/sign-in";
    url.search = `?next=${encodeURIComponent(pathname + search)}`;
    return NextResponse.redirect(url);
  }
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|api/webhooks|icon.svg|.*\\.(?:png|jpg|jpeg|svg|webp|woff2?)$).*)"],
};
