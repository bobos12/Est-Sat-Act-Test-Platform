import type { MetadataRoute } from "next";
import { brand } from "@/lib/brand";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: `${brand.name}: EST, SAT & ACT Practice Tests`,
    short_name: brand.name,
    description: brand.description,
    start_url: "/dashboard",
    scope: "/",
    display: "standalone",
    background_color: "#F5F7FC",
    theme_color: brand.themeColor,
    categories: ["education"],
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml" },
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
