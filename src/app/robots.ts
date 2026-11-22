import type { MetadataRoute } from "next";
import { brand } from "@/lib/brand";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        // Signed-in application, admin and payment routes: private, and useless in search results.
        disallow: ["/admin", "/dashboard", "/exam/", "/results/", "/practice", "/checkout", "/api/", "/auth/", "/welcome", "/reset-password"],
      },
    ],
    sitemap: `${brand.url}/sitemap.xml`,
    host: brand.url,
  };
}
