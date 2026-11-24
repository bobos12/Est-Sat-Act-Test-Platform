import "server-only";
import { MEDIA_BUCKET, MEDIA_PUBLIC_MARK } from "@/lib/content";
import { createServiceClient } from "@/lib/supabase/server";

// Long enough to outlast the longest timed exam on one page load.
const SIGNED_FOR_SECONDS = 6 * 60 * 60;
const MEDIA_URL = new RegExp(`https?://[^\\s"'()\\\\]+${MEDIA_PUBLIC_MARK.replace(/[/.]/g, "\\$&")}([^\\s"'()\\\\?#]+)`, "g");

/**
 * Question images live in a private bucket. Content stores public-style URLs;
 * this swaps every one in a payload for a short-lived signed URL.
 */
export async function signQuestionMedia<T>(data: T): Promise<T> {
  if (data == null) return data;
  const json = JSON.stringify(data);
  const paths = [...new Set([...json.matchAll(MEDIA_URL)].map((m) => m[1]))];
  if (!paths.length) return data;

  try {
    const decoded = paths.map((p) => {
      try {
        return decodeURIComponent(p);
      } catch {
        return p;
      }
    });
    const { data: signed, error } = await createServiceClient().storage.from(MEDIA_BUCKET).createSignedUrls(decoded, SIGNED_FOR_SECONDS);
    if (error) throw error;
    const byPath = new Map<string, string>();
    signed.forEach((s, i) => {
      if (s.signedUrl) byPath.set(paths[i], s.signedUrl);
    });
    return JSON.parse(json.replace(MEDIA_URL, (match, path: string) => byPath.get(path) ?? match)) as T;
  } catch (err) {
    console.error("signQuestionMedia: could not sign question images", err);
    return data;
  }
}
