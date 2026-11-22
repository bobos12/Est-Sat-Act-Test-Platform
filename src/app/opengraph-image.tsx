import { ogCard, ogSize } from "@/lib/og";

export const alt = "TargetScore: EST, SAT and ACT practice tests for American Diploma students";
export const size = ogSize;
export const contentType = "image/png";

export default function Image() {
  return ogCard({ eyebrow: "For American Diploma students", title: "EST, SAT & ACT practice tests", subtitle: "Timed full-length mock exams, an explanation for every answer and a score by topic." });
}
