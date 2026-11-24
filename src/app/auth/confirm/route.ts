import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { claimSession } from "@/lib/auth/single-session";
import { createClient } from "@/lib/supabase/server";

/**
 * Landing for every auth link:
 *  - email links with ?token_hash=...&type=...   (our branded email templates; works on any device)
 *  - PKCE links with ?code=...                   (Google sign-in and Supabase's default templates)
 * New accounts land on the site signed in with ?welcome=1 (the "You're all set" popup); everything else goes straight on.
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
  if (!ok) {
    // A signup link opened in another browser/app: Supabase already confirmed the email, this browser just can't hold the session.
    const reason = code && welcome ? "confirmed" : "confirmation";
    return NextResponse.redirect(new URL(`/sign-in?error=${reason}&next=${encodeURIComponent(next)}`, request.url));
  }
  await claimSession(supabase);
  const { data: auth } = await supabase.auth.getUser();

  // An admin opening an email sign-in link goes straight to the dashboard (the link counts as 2-step verification).
  if (type === "email" || type === "magiclink") {
    const { data: profile } = auth.user ? await supabase.from("profiles").select("role").eq("id", auth.user.id).single() : { data: null };
    if (profile?.role === "admin") return NextResponse.redirect(new URL(next.startsWith("/admin") ? next : "/admin", request.url));
  }

  if (type === "recovery" || next === "/reset-password") return NextResponse.redirect(new URL("/reset-password", request.url));

  // Land on the site signed in, with the "You're all set" popup for new accounts (email signup, or a first Google sign-in).
  const newGoogleUser = !!code && !!auth.user && Date.now() - new Date(auth.user.created_at).getTime() < 2 * 60_000;
  const dest = new URL(next, request.url);
  if (welcome || newGoogleUser) dest.searchParams.set("welcome", "1");
  return NextResponse.redirect(dest);
}
