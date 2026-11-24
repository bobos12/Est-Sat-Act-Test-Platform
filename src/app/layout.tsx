import type { Metadata, Viewport } from "next";
import { Caveat, Instrument_Sans, Instrument_Serif, JetBrains_Mono } from "next/font/google";
import { Suspense } from "react";
import { WelcomeDialog } from "@/components/auth/welcome-dialog";
import { brand } from "@/lib/brand";
import { JsonLd, siteGraph } from "@/lib/seo";
import "./globals.css";
import "@/styles/targetscore.css";

const sans = Instrument_Sans({ subsets: ["latin"], axes: ["wdth"], variable: "--f-sans", display: "swap" });
const serif = Instrument_Serif({ subsets: ["latin"], weight: "400", style: ["normal", "italic"], variable: "--f-serif", display: "swap" });
const mono = JetBrains_Mono({ subsets: ["latin"], weight: ["400", "500", "600"], variable: "--f-mono", display: "swap" });
// Decorative (sticky notes only): not preloaded, so it never competes with the hero for bandwidth.
const hand = Caveat({ subsets: ["latin"], weight: ["500", "700"], variable: "--f-hand", display: "swap", preload: false });

export const metadata: Metadata = {
  metadataBase: new URL(brand.url),
  title: { default: `${brand.name}: EST, SAT & ACT Practice Tests`, template: `%s | ${brand.name}` },
  description: brand.description,
  applicationName: brand.name,
  authors: [{ name: brand.name, url: brand.url }],
  creator: brand.name,
  publisher: brand.name,
  category: "education",
  formatDetection: { telephone: false, email: false, address: false },
  openGraph: { type: "website", siteName: brand.name, locale: "en_US", url: "/" },
  twitter: { card: "summary_large_image" },
  verification: {
    google: process.env.GOOGLE_SITE_VERIFICATION || undefined,
    other: process.env.BING_SITE_VERIFICATION ? { "msvalidate.01": process.env.BING_SITE_VERIFICATION } : undefined,
  },
};

export const viewport: Viewport = {
  themeColor: "#F5F7FC",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${sans.variable} ${serif.variable} ${mono.variable} ${hand.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col" suppressHydrationWarning>
        <JsonLd data={siteGraph} />
        {children}
        <Suspense fallback={null}>
          <WelcomeDialog />
        </Suspense>
      </body>
    </html>
  );
}
