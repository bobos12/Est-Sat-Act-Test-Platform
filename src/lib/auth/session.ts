import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";

export type Viewer = {
  id: string;
  email: string;
  fullName: string;
  role: "student" | "admin";
  hasPremium: boolean;
};

/** The current user, verified against Supabase Auth. Cached per request. */
export const getViewer = cache(async (): Promise<Viewer | null> => {
  if (!isSupabaseConfigured()) return null;
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
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
  if (!viewer) redirect(next ? `/sign-in?next=${encodeURIComponent(next)}` : "/sign-in");
  return viewer;
}

/** Server-side admin check. Use at the top of every admin page and admin server action. */
export async function requireAdmin() {
  const viewer = await requireViewer("/admin");
  if (viewer.role !== "admin") redirect("/");
  return viewer;
}
