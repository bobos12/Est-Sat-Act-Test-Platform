import { Caladea } from "next/font/google";

/** Metric-compatible with Cambria, the typeface used on official EST papers. */
export const paperFont = Caladea({ subsets: ["latin"], weight: ["400", "700"], style: ["normal", "italic"], variable: "--f-paper", display: "swap" });
