import type { MetadataRoute } from "next";
import { getPublishedExams } from "@/lib/catalog";
import { getTrackCounts } from "@/lib/tracks";
import { absoluteUrl } from "@/lib/seo";

/** Public, canonical, indexable pages only. Regenerates with the catalog cache, so new exams appear automatically. */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [exams, counts] = await Promise.all([getPublishedExams(), getTrackCounts()]);
  const latest = exams.reduce<string | undefined>((max, e) => (!max || e.updated_at > max ? e.updated_at : max), undefined);

  const tracks = (["est", "sat", "act"] as const)
    .filter((t) => counts[t] > 0)
    .map((t) => ({ url: absoluteUrl(`/${t}`), lastModified: latest, changeFrequency: "weekly" as const, priority: 0.9 }));

  return [
    { url: absoluteUrl("/"), lastModified: latest, changeFrequency: "weekly", priority: 1 },
    ...tracks,
    { url: absoluteUrl("/exams"), lastModified: latest, changeFrequency: "weekly", priority: 0.8 },
    { url: absoluteUrl("/pricing"), changeFrequency: "monthly", priority: 0.6 },
    ...exams.map((e) => ({ url: absoluteUrl(`/exams/${e.slug}`), lastModified: e.updated_at, changeFrequency: "monthly" as const, priority: 0.6 })),
  ];
}
