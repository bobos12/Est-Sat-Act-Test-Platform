import { ogCard, ogSize } from "@/lib/og";

export const alt = "TargetScore: EST practice tests online";
export const size = ogSize;
export const contentType = "image/png";

export default function Image() {
  return ogCard({ eyebrow: "EST I · EST II", title: "EST practice tests online", subtitle: "Timed EST I Math and Literacy mock exams in the real format, scored by official topic." });
}
