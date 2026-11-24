import type { NextConfig } from "next";

const dev = process.env.NODE_ENV !== "production";
const supabase = (() => {
  try {
    return new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").origin;
  } catch {
    return "";
  }
})();
const turnstile = "https://challenges.cloudflare.com";

// Scripts, frames and connections only from our own origin, Supabase and the Turnstile bot check.
// 'unsafe-inline' stays for scripts because Next.js inlines its bootstrap scripts.
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline' ${turnstile}${dev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  `img-src 'self' data: blob: ${supabase}`,
  "font-src 'self' data:",
  `connect-src 'self' ${supabase} ${supabase.replace(/^http/, "ws")} ${turnstile}${dev ? " ws: http://localhost:*" : ""}`,
  `frame-src ${turnstile}`,
  "frame-ancestors 'none'",
  "object-src 'none'",
  "base-uri 'self'",
  `form-action 'self' ${supabase} https://accept.paymob.com https://accounts.google.com`,
  ...(dev ? [] : ["upgrade-insecure-requests"]),
].join("; ");

const nextConfig: NextConfig = {
  cacheComponents: true,
  serverExternalPackages: ["@napi-rs/canvas"],
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  experimental: {
    // Admin uploads of EST paper PDFs (validated to ≤ 50 MB in the action itself).
    serverActions: { bodySizeLimit: "52mb" },
    proxyClientMaxBodySize: "52mb",
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          { key: "Content-Security-Policy", value: csp },
          ...(dev ? [] : [{ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" }]),
        ],
      },
    ];
  },
};

export default nextConfig;
