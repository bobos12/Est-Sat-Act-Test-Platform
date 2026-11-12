import "server-only";
import { requireAdmin } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

/**
 * Supabase client for admin pages and actions. Verifies the admin role first;
 * queries still run as the signed-in user, so RLS (is_admin()) applies as a second check.
 */
export async function adminClient() {
  const viewer = await requireAdmin();
  const supabase = await createClient();
  return { supabase, viewer };
}
