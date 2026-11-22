import { ogCard, ogSize } from "@/lib/og";

export const alt = "TargetScore: ACT practice tests";
export const size = ogSize;
export const contentType = "image/png";

export default function Image() {
  return ogCard({ eyebrow: "English · Math · Science", title: "ACT practice tests", subtitle: "Timed ACT practice with explanations and a score by topic." });
}
