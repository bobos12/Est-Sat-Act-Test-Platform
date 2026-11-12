// Merge into your existing src/app/layout.tsx: keep your providers, add the fonts + CSS.
import { Instrument_Sans, Instrument_Serif, JetBrains_Mono } from "next/font/google";
import "@/styles/16hundred.css";

const sans = Instrument_Sans({ subsets: ["latin"], axes: ["wdth"], variable: "--font-sans", display: "swap" });
const serif = Instrument_Serif({ subsets: ["latin"], weight: "400", style: ["normal", "italic"], variable: "--font-serif", display: "swap" });
const mono = JetBrains_Mono({ subsets: ["latin"], weight: ["400", "500", "600"], variable: "--font-mono", display: "swap" });

export const metadata = {
  title: "16hundred: EST mock exams for American Diploma students",
  description: "Timed EST I and EST II mock exams built from the official blueprint and scored by topic. Aim for 1600. Your first exam is free.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${sans.variable} ${serif.variable} ${mono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
