import type { Metadata, Viewport } from "next";
import { Caveat, Instrument_Sans, Instrument_Serif, JetBrains_Mono } from "next/font/google";
import { brand } from "@/lib/brand";
import "./globals.css";
import "@/styles/16hundred.css";

const sans = Instrument_Sans({ subsets: ["latin"], axes: ["wdth"], variable: "--f-sans", display: "swap" });
const serif = Instrument_Serif({ subsets: ["latin"], weight: "400", style: ["normal", "italic"], variable: "--f-serif", display: "swap" });
const mono = JetBrains_Mono({ subsets: ["latin"], weight: ["400", "500", "600"], variable: "--f-mono", display: "swap" });
const hand = Caveat({ subsets: ["latin"], weight: ["500", "700"], variable: "--f-hand", display: "swap" });

export const metadata: Metadata = {
  title: { default: `${brand.name}: EST mock exams for American Diploma students`, template: `%s · ${brand.name}` },
  description: brand.description,
  icons: { icon: "/icon.svg" },
};

export const viewport: Viewport = {
  themeColor: "#F5F7FC",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${sans.variable} ${serif.variable} ${mono.variable} ${hand.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col" suppressHydrationWarning>{children}</body>
    </html>
  );
}
