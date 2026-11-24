import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { signedOutElsewhereUrl } from "@/lib/auth/single-session";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";

export type Viewer = {
  id: string;
  email: string;
  fullName: string;
  role: "student" | "admin";
  hasPremium: boolean;
};

/** Supabase Auth check, once per request. `revoked`: this device was signed out by a sign-in elsewhere. */
const authCheck = cache(async () => {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();
  return { supabase, user: data.user, revoked: error?.code === "session_not_found" };
});

/** The current user, verified against Supabase Auth. Cached per request. */
export const getViewer = cache(async (): Promise<Viewer | null> => {
  if (!isSupabaseConfigured()) return null;
  const { supabase, user } = await authCheck();
  const auth = { user };
  if (!auth.user) return null;

  const [{ data: profile }, { data: premium }] = await Promise.all([
    supabase.from("profiles").select("email, full_name, role").eq("id", auth.user.id).single(),
    supabase.rpc("has_premium_access", { uid: auth.user.id }),
  ]);
  if (!profile) return null;

  return {
    id: auth.user.id,
    email: profile.email,
    fullName: profile.full_name,
    role: profile.role,
    hasPremium: Boolean(premium),
  };
});

export async function requireViewer(next?: string) {
  const viewer = await getViewer();
  if (!viewer) {
    if (isSupabaseConfigured() && (await authCheck()).revoked) redirect(signedOutElsewhereUrl(next));
    redirect(next ? `/sign-in?next=${encodeURIComponent(next)}` : "/sign-in");
  }
  return viewer;
}

/**
 * True once this session has passed 2-step verification, or was opened from an email sign-in link
 * (proves control of the admin's inbox). The database's is_admin() accepts the same two.
 */
export const isAdminVerified = cache(async () => {
  const { supabase } = await authCheck();
  const { data } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (data?.currentLevel === "aal2") return true;
  const { data: c } = await supabase.auth.getClaims();
  const amr = c?.claims?.amr;
  return Array.isArray(amr) && amr.some((e) => typeof e === "object" && (e.method === "otp" || e.method === "magiclink"));
});

/**
 * True when this session was opened from an email link in the last 15 minutes.
 * It proves control of the account's inbox, which is what 2-step recovery accepts.
 */
export const isRecentEmailLogin = cache(async () => {
  const { supabase } = await authCheck();
  const { data } = await supabase.auth.getClaims();
  const amr = data?.claims?.amr;
  const since = Date.now() / 1000 - 15 * 60;
  return Array.isArray(amr) && amr.some((e) => typeof e === "object" && (e.method === "otp" || e.method === "magiclink") && e.timestamp >= since);
});

/** Server-side admin check. Use at the top of every admin page and admin server action. */
export async function requireAdmin() {
  const viewer = await requireViewer("/admin");
  if (viewer.role !== "admin") redirect("/");
  if (!(await isAdminVerified())) redirect("/two-step");
  return viewer;
}
