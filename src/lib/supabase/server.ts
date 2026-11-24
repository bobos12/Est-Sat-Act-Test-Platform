import "server-only";
import { cookies, headers } from "next/headers";
import { connection } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { DEVICE_COOKIE } from "@/lib/device";
import { publicEnv, serverSecret } from "@/lib/env";

/** Supabase client acting as the signed-in user (RLS applies). */
export async function createClient() {
  // The session check reads the clock, so make this a request-time call (never prerendered).
  await connection();
  const env = publicEnv();
  const [cookieStore, requestHeaders] = await Promise.all([cookies(), headers()]);
  return createServerClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    global: { headers: gateHeaders(requestHeaders, cookieStore.get(DEVICE_COOKIE)?.value) },
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
 * Headers the content-protection gate checks (see 20261123000001_content_protection.sql):
 * the shared server secret, plus the student's real IP, browser, device and rough
 * location (Vercel IP geo) for the risk log.
 */
function gateHeaders(h: Headers, deviceId: string | undefined): Record<string, string> {
  const ascii = (v: string, max: number) => v.replace(/[^\x20-\x7e]/g, "").slice(0, max);
  const out: Record<string, string> = {};
  const secret = process.env.SUPABASE_GATE_SECRET;
  if (secret) out["x-ts-gate"] = secret;
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip");
  if (ip) out["x-ts-client-ip"] = ascii(ip, 64);
  const ua = h.get("user-agent");
  if (ua) out["x-ts-user-agent"] = ascii(ua, 300);
  if (deviceId && /^[0-9a-f-]{36}$/.test(deviceId)) out["x-ts-device"] = deviceId;
  const country = h.get("x-vercel-ip-country");
  if (country && /^[A-Z]{2}$/.test(country)) out["x-ts-country"] = country;
  const city = h.get("x-vercel-ip-city");
  if (city) out["x-ts-city"] = ascii(safeDecode(city), 80);
  const lat = h.get("x-vercel-ip-latitude");
  const lon = h.get("x-vercel-ip-longitude");
  if (lat && lon && /^-?\d{1,3}(\.\d+)?$/.test(lat) && /^-?\d{1,3}(\.\d+)?$/.test(lon)) {
    out["x-ts-lat"] = lat;
    out["x-ts-lon"] = lon;
  }
  return out;
}

function safeDecode(v: string) {
  try {
    return decodeURIComponent(v);
  } catch {
    return v;
  }
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
