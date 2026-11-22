import { ogCard, ogSize } from "@/lib/og";

export const alt = "TargetScore: SAT practice tests online";
export const size = ogSize;
export const contentType = "image/png";

export default function Image() {
  return ogCard({ eyebrow: "Math · Reading and Writing", title: "SAT practice tests online", subtitle: "Full-length timed SAT sections with an explanation for every question." });
}
