import "server-only";
import { redirect } from "next/navigation";
import type { SupabaseClient } from "@supabase/supabase-js";

/** Where a device lands after its session was replaced by a sign-in elsewhere. */
export function signedOutElsewhereUrl(next?: string) {
  const qs = new URLSearchParams({ reason: "elsewhere", ...(next ? { next } : {}) });
  return `/sign-in?${qs}`;
}

/**
 * One active session per account: call right after any sign-in. Every other device is
 * signed out (their next request is refused by Supabase and by the content gate),
 * and the sign-in is logged with this device for the account-sharing signals.
 * Never blocks the sign-in itself.
 */
export async function claimSession(supabase: SupabaseClient) {
  const { error: outError } = await supabase.auth.signOut({ scope: "others" });
  if (outError) console.error("claimSession: could not sign out other sessions", outError.message);
  const { error: logError } = await supabase.rpc("record_sign_in");
  if (logError) console.error("claimSession: could not record sign-in", logError.message);
}

/** In server actions: send a device whose session was revoked to sign in again. */
export function redirectIfRevoked(error: { message?: string } | null | undefined, next?: string) {
  if (error?.message?.includes("SESSION_REVOKED")) redirect(signedOutElsewhereUrl(next));
}
