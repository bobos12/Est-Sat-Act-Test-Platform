import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

/**
 * Landing for every auth link:
 *  - email links with ?token_hash=...&type=...   (our branded email templates; works on any device)
 *  - PKCE links with ?code=...                   (Google sign-in and Supabase's default templates)
 * Email confirmations go through a short "You're confirmed" screen; everything else goes straight on.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const nextParam = searchParams.get("next") ?? "/dashboard";
  const next = nextParam.startsWith("/") && !nextParam.startsWith("//") ? nextParam : "/dashboard";
  const welcome = searchParams.get("welcome") === "1" || type === "signup";

  const supabase = await createClient();
  let ok = false;
  if (tokenHash && type) {
    ok = !(await supabase.auth.verifyOtp({ type, token_hash: tokenHash })).error;
  } else if (code) {
    ok = !(await supabase.auth.exchangeCodeForSession(code)).error;
  }
  if (!ok) return NextResponse.redirect(new URL("/sign-in?error=confirmation", request.url));

  if (type === "recovery" || next === "/reset-password") return NextResponse.redirect(new URL("/reset-password", request.url));
  if (welcome) return NextResponse.redirect(new URL(`/welcome?next=${encodeURIComponent(next)}`, request.url));
  return NextResponse.redirect(new URL(next, request.url));
}
