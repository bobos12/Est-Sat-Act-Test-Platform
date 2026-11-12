import "server-only";
import { cookies } from "next/headers";
import { connection } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { publicEnv, serverSecret } from "@/lib/env";

/** Supabase client acting as the signed-in user (RLS applies). */
export async function createClient() {
  // The session check reads the clock, so make this a request-time call (never prerendered).
  await connection();
  const env = publicEnv();
  const cookieStore = await cookies();
  return createServerClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // Called from a Server Component: the proxy refreshes the session instead.
        }
      },
    },
  });
}

/**
 * Service-role client: bypasses RLS. Only for trusted server work
 * (payment webhooks, document processing). Never expose to the browser.
 */
export function createServiceClient() {
  const env = publicEnv();
  return createSupabaseClient(env.NEXT_PUBLIC_SUPABASE_URL, serverSecret("SUPABASE_SERVICE_ROLE_KEY"), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
