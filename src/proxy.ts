import { NextResponse, type NextRequest } from "next/server";
import { DEVICE_COOKIE } from "@/lib/device";
import { updateSession } from "@/lib/supabase/proxy-session";

// Optimistic gate only: real authorization happens in server code and RLS.
const PROTECTED = ["/dashboard", "/exam", "/results", "/account", "/admin", "/checkout", "/practice"];

export async function proxy(request: NextRequest) {
  // A first-party device id for the account-sharing signals (how many devices use one login).
  const newDevice = request.cookies.get(DEVICE_COOKIE) ? null : crypto.randomUUID();
  if (newDevice) request.cookies.set(DEVICE_COOKIE, newDevice);

  const { pathname, search } = request.nextUrl;
  // Supabase falls back to the Site URL (home page) when a redirect isn't allow-listed: finish the sign-in anyway.
  if (pathname === "/" && request.nextUrl.searchParams.has("code")) {
    return NextResponse.redirect(new URL(`/auth/confirm${search}`, request.url));
  }

  const { response, userId } = await updateSession(request);

  let res = response;
  if (!userId && PROTECTED.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
    const url = request.nextUrl.clone();
    url.pathname = "/sign-in";
    url.search = `?next=${encodeURIComponent(pathname + search)}`;
    res = NextResponse.redirect(url);
  }
  if (newDevice) {
    res.cookies.set(DEVICE_COOKIE, newDevice, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 400,
    });
  }
  return res;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|api/webhooks|icon.svg|favicon.ico|apple-icon|opengraph-image|robots.txt|sitemap.xml|manifest.webmanifest|.*\\.(?:png|jpg|jpeg|svg|webp|woff2?)$).*)"],
};
